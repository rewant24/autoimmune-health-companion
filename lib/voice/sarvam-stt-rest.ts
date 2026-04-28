/**
 * Sarvam STT REST batch — server-only.
 *
 * Single-shot multipart POST to `https://api.sarvam.ai/speech-to-text`.
 * Replaces the streaming-WebSocket path that drove Bug 1 (see
 * `docs/voice-c1-bug-1-options-build-plan.md`). Sarvam's streaming WS
 * is designed for real-time mic capture with VAD-based segmentation;
 * our pipeline records the entire utterance first and POSTs it as one
 * buffered upload, which is exactly what REST batch is for.
 *
 * Architecture:
 *
 *   browser                       this server (Node.js runtime)
 *   ────────────────              ─────────────────────────────────
 *   adapter buffers PCM   →       /api/transcribe receives full WAV
 *   wraps in WAV header           transcribeBatch() POSTs multipart
 *   POST audio/wav body   ──────▶ to https://api.sarvam.ai/speech-to-text
 *                                   ↳ returns { request_id, transcript,
 *                                       language_code } synchronously
 *   SSE final frame ◀─────────── route emits one SSE final frame
 *
 * Why a thin direct fetch instead of the `sarvamai` SDK: the SDK adds
 * an `Uploadable` indirection that's awkward for a `Uint8Array` payload
 * inside a Next.js route, and Sarvam's REST schema is dead simple
 * (multipart form-data with one file + four string fields). Direct
 * `fetch` + `FormData` is fewer moving parts and easier to test.
 *
 * Auth posture: `SARVAM_API_KEY` is server-only — never logged, never
 * echoed in error messages, never returned in headers.
 */

/** Endpoint URL for Sarvam REST STT. */
export const SARVAM_REST_ENDPOINT = 'https://api.sarvam.ai/speech-to-text'

/** Model — saaras:v3 supports the `mode` parameter and is the recommended STT. */
export const SARVAM_REST_MODEL = 'saaras:v3'

/** Mode — `transcribe` returns text in the original spoken language. */
export const SARVAM_REST_MODE = 'transcribe'

/**
 * Public error code returned in SSE error frames + status responses.
 * Mirrors the streaming-WS module's vocabulary so the route + adapter
 * branches don't have to change.
 */
export type SarvamRestErrorCode =
  | 'voice.provider_unconfigured'
  | 'voice.network'
  | 'voice.session_too_long'
  | 'voice.session_too_large'
  | 'voice.unprocessable'
  | 'voice.aborted'

/** Typed error class so the route can branch on `.code` without string-matching. */
export class SarvamRestError extends Error {
  readonly code: SarvamRestErrorCode
  constructor(code: SarvamRestErrorCode, message: string) {
    super(message)
    this.name = 'SarvamRestError'
    this.code = code
  }
}

/** Result of a successful REST batch transcription. */
export interface SarvamRestResult {
  /** Transcript text in the original spoken language. Empty string if Sarvam returned no text. */
  transcript: string
  /** Sarvam's request ID, useful for support tickets. Null if missing from response. */
  requestId: string | null
  /** BCP-47 detected language code (e.g. `en-IN`). Null if missing. */
  detectedLanguageCode: string | null
}

export interface SarvamRestOptions {
  /** WAV bytes ready to upload — the route owns header construction via lib/voice/wav-header.ts. */
  audio: Uint8Array
  /** BCP-47 code (`en-IN`, `hi-IN`, …). Mandatory — Sarvam's saaras:v3 expects it. */
  languageCode: string
  /** Abort signal piped from the route (client cancellation, cap timer). */
  signal?: AbortSignal
  /** Test seam: replace the global `fetch`. */
  fetchImpl?: typeof fetch
  /** Test seam: override the endpoint URL. */
  endpoint?: string
}

/**
 * Read `SARVAM_API_KEY` without logging it. Returns `null` if missing
 * or blank. Pulled out so the route can do the 503 short-circuit
 * without instantiating any fetch / form-data plumbing.
 */
export function readSarvamApiKey(): string | null {
  const raw = process.env.SARVAM_API_KEY
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Send a buffered WAV payload to Sarvam's REST batch endpoint and
 * return the synchronous transcript. Throws `SarvamRestError` for any
 * failure mode the route needs to branch on.
 */
export async function transcribeBatch(
  opts: SarvamRestOptions,
): Promise<SarvamRestResult> {
  const apiKey = readSarvamApiKey()
  if (apiKey === null) {
    throw new SarvamRestError(
      'voice.provider_unconfigured',
      'SARVAM_API_KEY is not set.',
    )
  }

  const fetchImpl = opts.fetchImpl ?? fetch
  const endpoint = opts.endpoint ?? SARVAM_REST_ENDPOINT

  // Multipart form-data: file + three string fields.
  // Sarvam accepts a wide range of audio formats but our recorder ships
  // PCM s16le 16 kHz mono wrapped in a WAV header, so `audio/wav` is
  // the only Content-Type the route hands us.
  const formData = new FormData()
  // Cast to BlobPart: TS's lib.dom typings tighten Uint8Array's buffer to
  // ArrayBuffer (not ArrayBufferLike), which breaks when the input came
  // from a Web Crypto / Node Buffer path. The runtime accepts either.
  formData.append(
    'file',
    new Blob([opts.audio as BlobPart], { type: 'audio/wav' }),
    'audio.wav',
  )
  formData.append('model', SARVAM_REST_MODEL)
  formData.append('mode', SARVAM_REST_MODE)
  formData.append('language_code', opts.languageCode)

  let response: Response
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        // Header name is case-insensitive on the wire; Sarvam's docs
        // show `api-subscription-key` lowercase so we match.
        'api-subscription-key': apiKey,
      },
      body: formData,
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SarvamRestError('voice.aborted', 'Sarvam request aborted.')
    }
    throw new SarvamRestError(
      'voice.network',
      err instanceof Error ? err.message : 'Sarvam fetch failed.',
    )
  }

  if (!response.ok) {
    const bodyText = await safeReadText(response)
    const trimmed = bodyText ? ` — ${bodyText.slice(0, 200)}` : ''
    if (response.status === 413) {
      throw new SarvamRestError(
        'voice.session_too_large',
        `Sarvam rejected the audio as too large${trimmed}`,
      )
    }
    if (response.status === 400 || response.status === 422) {
      throw new SarvamRestError(
        'voice.unprocessable',
        `Sarvam rejected the request${trimmed}`,
      )
    }
    if (response.status === 401 || response.status === 403) {
      throw new SarvamRestError(
        'voice.provider_unconfigured',
        `Sarvam rejected the API key (HTTP ${response.status}).`,
      )
    }
    throw new SarvamRestError(
      'voice.network',
      `Sarvam returned HTTP ${response.status}${trimmed}`,
    )
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new SarvamRestError(
      'voice.network',
      'Sarvam response was not valid JSON.',
    )
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new SarvamRestError(
      'voice.network',
      'Sarvam response was not a JSON object.',
    )
  }

  const obj = parsed as Record<string, unknown>
  const transcript = typeof obj.transcript === 'string' ? obj.transcript : ''
  const requestId = typeof obj.request_id === 'string' ? obj.request_id : null
  const detectedLanguageCode =
    typeof obj.language_code === 'string' ? obj.language_code : null

  return { transcript, requestId, detectedLanguageCode }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
