/**
 * POST /api/transcribe
 *
 * REST-batch proxy for Sarvam STT. Replaces the streaming-WebSocket
 * proxy that drove Bug 1 (see `docs/voice-c1-bug-1-history.md` and
 * `docs/voice-c1-bug-1-options-build-plan.md`).
 *
 *   browser SarvamRecorder + WAV resampler
 *      │  POST /api/transcribe?lang=<bcp47>
 *      │  body: full WAV (header + PCM s16le 16 kHz mono)
 *      │  Content-Type: audio/wav (also accepts audio/webm, audio/ogg)
 *      ▼
 *   this route
 *      │  buffers the body, hard-caps duration + bytes, then
 *      │  POSTs once to https://api.sarvam.ai/speech-to-text via
 *      │  lib/voice/sarvam-stt-rest.ts (multipart form-data)
 *      ▼
 *   one SSE `final` frame back to the browser
 *
 * SSE event shapes (one JSON object per `data:` frame, ASCII-only):
 *   { "type": "final", "text": "...", "durationMs": N, "bytes": N }
 *   { "type": "error", "kind": "voice.session_too_large" | … , "message": "..." }
 *
 * No `partial` frames — Sarvam's REST batch is synchronous, so we only
 * ever emit one `final` (or one `error`). The adapter dispatches on
 * `type` and handles a final-without-partials happily; there's nothing
 * to change on the browser side.
 *
 * Hard caps (cycle 1 cost guards, tightened post-Bug-1):
 *   - Content-Type ∈ {audio/wav, audio/webm, audio/ogg} → otherwise 415.
 *     (Recorder ships audio/wav; the broader allowlist keeps the server
 *     compatible if a future recorder ships a fallback.)
 *   - Aggregate audio bytes ≤ 1 MB. Reduced from 5 MB because Sarvam's
 *     REST batch tops out around 30 s of audio and 1 MB of WAV is a
 *     comfortable headroom over that at 16 kHz mono 16-bit (~32 KB/s).
 *   - Connection lifetime ≤ 30 s — wall-clock from request start.
 *     Reduced from 90 s for the same reason.
 *   - SARVAM_API_KEY must be set in process.env or 503 short-circuits
 *     before any upstream call.
 *
 * Response headers (always present):
 *   X-Voice-Bytes        — bytes received from the client.
 *   X-Voice-Duration-Ms  — elapsed ms on this server (request → response).
 *   X-Voice-Cap-Hit      — '1' if either the byte cap or the duration
 *                          cap tripped, '0' otherwise.
 *
 * Auth posture: SARVAM_API_KEY is server-only — never logged, never
 * echoed in error bodies, never returned in headers.
 */

import {
  readSarvamApiKey,
  SarvamRestError,
  transcribeBatch,
  type SarvamRestErrorCode,
} from '@/lib/voice/sarvam-stt-rest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Content-Types we accept on the request body. Recorder sends `audio/wav`. */
const ACCEPTED_CONTENT_TYPES = new Set([
  'audio/wav',
  'audio/webm',
  'audio/ogg',
])

/** 1 MB hard cap on aggregate audio bytes. */
export const MAX_AUDIO_BYTES = 1 * 1024 * 1024
/** 30 s hard cap on this route's lifetime (matches Sarvam REST max). */
export const MAX_DURATION_MS = 30_000
/** Default language code if the client omits the `lang` query param. */
const DEFAULT_LANGUAGE_CODE = 'en-IN'

/** Public route error vocabulary — superset of SarvamRestErrorCode. */
type RouteErrorCode =
  | SarvamRestErrorCode
  | 'voice.bad_content_type'
  | 'voice.connect_failed'

/** Parse a Content-Type header into its bare media type (`audio/wav`). */
function bareMediaType(contentType: string | null): string | null {
  if (contentType === null) return null
  const [media] = contentType.split(';')
  return media ? media.trim().toLowerCase() : null
}

/** Build an SSE `data:` frame for a single JSON object. */
function sseFrame(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * Build a JSON error response. Used for 415 / 503 short-circuits before
 * the SSE stream opens. The `code` matches the SSE `error` frame
 * vocabulary so clients can branch uniformly.
 */
function errorResponse(
  status: number,
  code: RouteErrorCode,
  message: string,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Voice-Bytes': '0',
        'X-Voice-Duration-Ms': '0',
        'X-Voice-Cap-Hit': '0',
        ...extraHeaders,
      },
    },
  )
}

/**
 * Read a request body fully into a Uint8Array, enforcing `MAX_AUDIO_BYTES`.
 * Returns `{ buffer, capHit: false }` on success, or `{ buffer: null,
 * capHit: true, bytes }` if the cap tripped (caller emits the SSE error).
 */
async function readBodyWithCap(
  body: ReadableStream<Uint8Array>,
): Promise<
  | { buffer: Uint8Array; capHit: false }
  | { buffer: null; capHit: true; bytes: number }
> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (!(value instanceof Uint8Array) || value.byteLength === 0) continue
    total += value.byteLength
    if (total > MAX_AUDIO_BYTES) {
      try {
        reader.cancel().catch(() => undefined)
      } catch {
        // ignore
      }
      return { buffer: null, capHit: true, bytes: total }
    }
    chunks.push(value)
  }
  if (chunks.length === 1) return { buffer: chunks[0], capHit: false }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { buffer: out, capHit: false }
}

/** Map a `SarvamRestError` to the SSE `error` frame fields. */
function sarvamErrorToFrame(err: SarvamRestError): {
  type: 'error'
  kind: SarvamRestErrorCode
  message: string
} {
  return { type: 'error', kind: err.code, message: err.message }
}

export async function POST(request: Request): Promise<Response> {
  const startedAtMs = Date.now()

  // --- guard: content-type ------------------------------------------------
  const contentType = bareMediaType(request.headers.get('content-type'))
  if (contentType === null || !ACCEPTED_CONTENT_TYPES.has(contentType)) {
    return errorResponse(
      415,
      'voice.bad_content_type',
      `Content-Type must be one of: ${[...ACCEPTED_CONTENT_TYPES].join(', ')}`,
    )
  }

  // --- guard: API key -----------------------------------------------------
  if (readSarvamApiKey() === null) {
    return errorResponse(
      503,
      'voice.provider_unconfigured',
      'Voice provider not configured.',
    )
  }

  // --- query: language code ----------------------------------------------
  const url = new URL(request.url)
  const languageCode = url.searchParams.get('lang') ?? DEFAULT_LANGUAGE_CODE

  // --- duration cap: arm an AbortController and a timer ------------------
  // Sarvam's REST endpoint can take a few seconds to return; we cap our
  // overall route lifetime at MAX_DURATION_MS so a hung upstream doesn't
  // pin a Vercel function. The SSE stream is opened *after* the upstream
  // call returns, so the cap covers the whole flow up to first byte.
  const abortController = new AbortController()
  const capTimer = setTimeout(() => {
    abortController.abort()
  }, MAX_DURATION_MS)
  let durationCapHit = false

  // --- read request body with byte cap -----------------------------------
  const body = request.body
  let bytesReceived = 0
  let capHitFromBody = false
  let audio: Uint8Array | null = null
  if (body !== null) {
    try {
      const result = await readBodyWithCap(body)
      if (result.capHit) {
        capHitFromBody = true
        bytesReceived = result.bytes
      } else {
        audio = result.buffer
        bytesReceived = result.buffer.byteLength
      }
    } catch (err) {
      clearTimeout(capTimer)
      const message =
        err instanceof Error ? err.message : 'request body read failed'
      return buildSseResponse({
        frame: { type: 'error', kind: 'voice.network', message },
        bytes: bytesReceived,
        startedAtMs,
        capHit: durationCapHit,
      })
    }
  } else {
    audio = new Uint8Array(0)
  }

  if (capHitFromBody) {
    clearTimeout(capTimer)
    return buildSseResponse({
      frame: {
        type: 'error',
        kind: 'voice.session_too_large',
        message: `Audio bytes exceeded ${MAX_AUDIO_BYTES}-byte cap.`,
      },
      bytes: bytesReceived,
      startedAtMs,
      capHit: true,
    })
  }

  // Empty body — nothing to transcribe. Treat as unprocessable so the
  // adapter surfaces a typed error rather than a silent empty final.
  if (audio === null || audio.byteLength === 0) {
    clearTimeout(capTimer)
    return buildSseResponse({
      frame: {
        type: 'error',
        kind: 'voice.unprocessable',
        message: 'Empty audio body.',
      },
      bytes: bytesReceived,
      startedAtMs,
      capHit: false,
    })
  }

  // --- call Sarvam REST batch --------------------------------------------
  // The route's own AbortController fires on the duration cap; the
  // upstream client's abort plus our SarvamRestError → SSE mapping
  // handles the cap and any provider-side error uniformly.
  let transcript = ''
  let restError: SarvamRestError | null = null
  try {
    const result = await transcribeBatch({
      audio,
      languageCode,
      signal: abortController.signal,
    })
    transcript = result.transcript
  } catch (err) {
    if (err instanceof SarvamRestError) {
      restError = err
    } else {
      restError = new SarvamRestError(
        'voice.network',
        err instanceof Error ? err.message : 'Sarvam call failed.',
      )
    }
  }

  // Did the duration cap fire? `signal.aborted` is the cleanest signal
  // since SarvamRestError will surface as `voice.aborted` once the
  // upstream client sees the abort.
  if (abortController.signal.aborted) {
    durationCapHit = true
  }
  clearTimeout(capTimer)

  if (restError !== null) {
    return buildSseResponse({
      frame: sarvamErrorToFrame(
        durationCapHit
          ? new SarvamRestError(
              'voice.session_too_long',
              `Connection exceeded ${MAX_DURATION_MS}ms cap.`,
            )
          : restError,
      ),
      bytes: bytesReceived,
      startedAtMs,
      capHit: durationCapHit,
    })
  }

  // --- success: one SSE final frame --------------------------------------
  return buildSseResponse({
    frame: {
      type: 'final',
      text: transcript,
      durationMs: Date.now() - startedAtMs,
      bytes: bytesReceived,
    },
    bytes: bytesReceived,
    startedAtMs,
    capHit: durationCapHit,
  })
}

/**
 * Wrap a single SSE frame into a `text/event-stream` Response with the
 * X-Voice-* telemetry headers. The route emits exactly one frame today,
 * but the SSE wrapping keeps the wire shape unchanged for the adapter
 * which expects `data: …\n\n` envelopes.
 */
function buildSseResponse(args: {
  frame: Record<string, unknown>
  bytes: number
  startedAtMs: number
  capHit: boolean
}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sseFrame(args.frame))
      controller.close()
    },
  })
  const durationMs = Date.now() - args.startedAtMs
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Voice-Bytes': String(args.bytes),
      'X-Voice-Duration-Ms': String(durationMs),
      'X-Voice-Cap-Hit': args.capHit ? '1' : '0',
    },
  })
}
