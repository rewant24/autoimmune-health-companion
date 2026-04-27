/**
 * POST /api/transcribe
 *
 * Vercel HTTP-streaming proxy for Sarvam streaming STT.
 *
 *   browser MediaRecorder + WAV resampler (V.B)
 *      │  POST /api/transcribe?lang=<bcp47>
 *      │  body: ReadableStream of audio/wav chunks
 *      ▼
 *   this route
 *      │  pipes each chunk to Sarvam via lib/voice/sarvam-stt-server.ts
 *      │  emits SSE frames as transcripts arrive
 *      ▼
 *   browser SSE consumer (V.B)
 *
 * SSE event shapes (one JSON object per `data:` frame, ASCII-only):
 *   { "type": "partial", "text": "..." }
 *   { "type": "final",   "text": "...", "durationMs": N, "bytes": N }
 *   { "type": "error",   "kind": "voice.session_too_long" | … , "message": "..." }
 *
 * Hard caps (cycle 1 cost guards):
 *   - Content-Type ∈ {audio/wav, audio/webm, audio/ogg} → otherwise 415.
 *     (V.B sends `audio/wav` per the pre-flight spike; the broader allowlist
 *     keeps the server compatible if the recorder ever ships a fallback.)
 *   - Connection lifetime ≤ 90s — wall-clock from the first chunk dispatch.
 *   - Aggregate audio bytes ≤ 5MB.
 *   - SARVAM_API_KEY must be set in process.env or 503 short-circuits before
 *     any socket opens.
 *
 * Response headers (always present on 200):
 *   X-Voice-Bytes        — bytes proxied to Sarvam at response start (0 on
 *                          stream open; final count is also surfaced inside
 *                          the SSE `final` frame for the client).
 *   X-Voice-Duration-Ms  — same shape; 0 on stream open.
 *
 * Auth posture: SARVAM_API_KEY is server-only — never logged, never
 * echoed in error bodies, never returned in headers.
 */

import {
  connectSarvamStt,
  readSarvamApiKey,
  type SarvamSttErrorCode,
  type SarvamSttHandle,
} from '@/lib/voice/sarvam-stt-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Content-Types we accept on the request body. V.B sends `audio/wav`. */
const ACCEPTED_CONTENT_TYPES = new Set([
  'audio/wav',
  'audio/webm',
  'audio/ogg',
])

/** 5 MB hard cap on aggregate audio bytes. */
const MAX_AUDIO_BYTES = 5 * 1024 * 1024
/** 90 s hard cap on connection lifetime. */
const MAX_DURATION_MS = 90_000
/** Default language code if the client omits the `lang` query param. */
const DEFAULT_LANGUAGE_CODE = 'en-IN'

/** Parse a Content-Type header into its bare media type (`audio/wav`). */
function bareMediaType(contentType: string | null): string | null {
  if (contentType === null) return null
  const [media] = contentType.split(';')
  return media ? media.trim().toLowerCase() : null
}

/** Build an SSE `data:` frame for a single JSON object. */
function sseFrame(payload: Record<string, unknown>): Uint8Array {
  // Single-line JSON keeps the SSE parser simple. The extra `\n\n` is the
  // standard event terminator.
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * Build a JSON error response. Used for 415 / 503 / 502 short-circuits
 * before the SSE stream opens. The `code` is the same vocabulary used in
 * the SSE `error` frames (`voice.*`) so clients can branch uniformly.
 */
function errorResponse(
  status: number,
  code: SarvamSttErrorCode | 'voice.bad_content_type' | 'voice.connect_failed',
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
        ...extraHeaders,
      },
    },
  )
}

export async function POST(request: Request): Promise<Response> {
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

  // --- open Sarvam socket -------------------------------------------------
  // We open it BEFORE returning the response so a connect failure surfaces
  // as a 502, not a half-open SSE stream. Once we have a handle we commit
  // to streaming.
  let handle: SarvamSttHandle
  // Buffer transcripts that arrive before the SSE writer is hooked up — in
  // practice almost none, but the dynamic `import()` makes this asynchronous
  // and we don't want to drop early frames.
  let pendingTranscript: string | null = null
  let pendingError:
    | { code: SarvamSttErrorCode; message: string }
    | null = null
  let pendingClose = false
  // These are reassigned once the stream starts; stub them for the connect
  // window so the SDK's event handlers don't NPE.
  let onTranscript: (text: string) => void = (text) => {
    pendingTranscript = text
  }
  let onError: (code: SarvamSttErrorCode, message: string) => void = (
    code,
    message,
  ) => {
    pendingError = { code, message }
  }
  let onClose: () => void = () => {
    pendingClose = true
  }

  try {
    handle = await connectSarvamStt({
      languageCode,
      onTranscript: (text) => onTranscript(text),
      onError: (code, message) => onError(code, message),
      onClose: () => onClose(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'connect failed'
    if (message === 'voice.provider_unconfigured') {
      return errorResponse(
        503,
        'voice.provider_unconfigured',
        'Voice provider not configured.',
      )
    }
    return errorResponse(502, 'voice.connect_failed', message)
  }

  // --- SSE stream body ----------------------------------------------------
  const startedAtMs = Date.now()
  let bytesProxied = 0
  let lastTranscript = ''
  let durationCapHit = false
  let byteCapHit = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Now wire callbacks to the live controller.
      onTranscript = (text: string) => {
        lastTranscript = text
        try {
          controller.enqueue(sseFrame({ type: 'partial', text }))
        } catch {
          // Controller already closed — happens if cap fires concurrently.
        }
      }

      onError = (code, message) => {
        try {
          controller.enqueue(
            sseFrame({ type: 'error', kind: code, message }),
          )
        } catch {
          // Already closed.
        }
      }

      onClose = () => {
        finalizeAndClose(controller, 'sarvam_close')
      }

      // Replay anything we buffered during the connect window.
      if (pendingTranscript !== null) {
        const buffered = pendingTranscript
        pendingTranscript = null
        onTranscript(buffered)
      }
      if (pendingError !== null) {
        const { code, message } = pendingError
        pendingError = null
        onError(code, message)
      }

      // 90s cap timer. Order matters: enqueue the error frame BEFORE
      // closing the upstream socket — `handle.close()` synchronously
      // triggers our `onClose` callback which finalises the controller,
      // and once the controller is closed any subsequent `enqueue()`
      // throws silently and the frame is dropped.
      const capTimer = setTimeout(() => {
        if (handle.isClosed) return
        durationCapHit = true
        try {
          controller.enqueue(
            sseFrame({
              type: 'error',
              kind: 'voice.session_too_long',
              message: `Connection exceeded ${MAX_DURATION_MS}ms cap.`,
            }),
          )
        } catch {
          // Already closed.
        }
        handle.close()
        finalizeAndClose(controller, 'duration_cap')
      }, MAX_DURATION_MS)

      // Wire abort BEFORE we begin pumping the request body so a fast
      // client cancellation cleans up promptly. Same enqueue-then-close
      // ordering as the duration cap (see comment there).
      const abortListener = (): void => {
        clearTimeout(capTimer)
        if (!handle.isClosed) {
          try {
            controller.enqueue(
              sseFrame({
                type: 'error',
                kind: 'voice.aborted',
                message: 'Client aborted the request.',
              }),
            )
          } catch {
            // Already closed.
          }
          handle.close()
        }
        finalizeAndClose(controller, 'abort')
      }
      // Some test runtimes don't expose a real AbortSignal on the request;
      // guard the call so the route still works.
      try {
        request.signal.addEventListener('abort', abortListener, { once: true })
      } catch {
        // Older runtimes — no abort signal. Cap timer + body close still
        // fire, so the worst case is a 90s-late teardown.
      }

      let finalized = false

      function finalizeAndClose(
        c: ReadableStreamDefaultController<Uint8Array>,
        _reason: string,
      ): void {
        if (finalized) return
        finalized = true
        clearTimeout(capTimer)
        const durationMs = Date.now() - startedAtMs
        try {
          c.enqueue(
            sseFrame({
              type: 'final',
              text: lastTranscript,
              durationMs,
              bytes: bytesProxied,
            }),
          )
        } catch {
          // Already closed — nothing to do.
        }
        try {
          c.close()
        } catch {
          // Already closed.
        }
        if (!handle.isClosed) handle.close()
      }

      if (pendingClose) {
        // Sarvam closed during the connect window — finalize immediately.
        finalizeAndClose(controller, 'pending_close')
        return
      }

      // --- pump request body ------------------------------------------
      const body = request.body
      if (body === null) {
        // No body to pump → flush + finalize once Sarvam closes (which
        // for an empty session typically means immediately).
        handle.flush()
        // Give Sarvam a brief tick to surface anything buffered, then
        // finalize.
        setTimeout(() => finalizeAndClose(controller, 'no_body'), 50)
        return
      }

      const reader = body.getReader()
      ;(async () => {
        try {
          while (true) {
            if (handle.isClosed || finalized) break
            const { value, done } = await reader.read()
            if (done) break
            if (value instanceof Uint8Array && value.byteLength > 0) {
              bytesProxied += value.byteLength
              if (bytesProxied > MAX_AUDIO_BYTES) {
                byteCapHit = true
                // Enqueue BEFORE closing the upstream socket so the error
                // frame doesn't get swallowed by the controller close that
                // `onClose` triggers.
                try {
                  controller.enqueue(
                    sseFrame({
                      type: 'error',
                      kind: 'voice.session_too_large',
                      message: `Audio bytes exceeded ${MAX_AUDIO_BYTES}-byte cap.`,
                    }),
                  )
                } catch {
                  // Already closed.
                }
                handle.close()
                finalizeAndClose(controller, 'byte_cap')
                return
              }
              handle.sendAudioChunk(value)
            }
          }
          // Body ended — request the final transcript and let `onClose`
          // finalize. As a safety net (Sarvam may stay open briefly), we
          // also schedule a finalize after a short delay.
          if (!handle.isClosed && !finalized) {
            handle.flush()
            // Flush gives Sarvam a chance to emit the final partial; we
            // wait briefly for the close + onClose path. If Sarvam doesn't
            // close cleanly, we close it ourselves.
            setTimeout(() => {
              if (!finalized) {
                if (!handle.isClosed) handle.close()
                finalizeAndClose(controller, 'flush_timeout')
              }
            }, 250)
          }
        } catch (err) {
          if (finalized) return
          const message =
            err instanceof Error ? err.message : 'request body read failed'
          try {
            controller.enqueue(
              sseFrame({
                type: 'error',
                kind: 'voice.network',
                message,
              }),
            )
          } catch {
            // Already closed.
          }
          if (!handle.isClosed) handle.close()
          finalizeAndClose(controller, 'body_read_error')
        }
      })().catch(() => {
        // The async IIFE catches its own errors; this is belt + suspenders
        // so an unexpected reject never leaks unhandled.
      })
    },
    cancel() {
      // Consumer cancelled (e.g., browser closed the SSE connection).
      // Mirror the abort path.
      if (!handle.isClosed) handle.close()
    },
  })

  // Surface the *current* counts (zero at stream open). The SSE `final`
  // frame carries the actual end-of-session totals for the client.
  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Voice-Bytes': String(bytesProxied),
    'X-Voice-Duration-Ms': '0',
    // X-Voice-* are cost-telemetry response headers — observability hooks
    // for the Sarvam-spend dashboard, not load-bearing for the client.
    // `Cap-Hit` flips to '1' if either the byte cap (5 MB) or the
    // duration cap (90 s) tripped during this stream. The SSE `final` /
    // `error` frames carry the canonical end-of-session totals; these
    // headers exist for proxies / log scrapers that don't parse SSE.
    'X-Voice-Cap-Hit': durationCapHit || byteCapHit ? '1' : '0',
  })

  return new Response(stream, { status: 200, headers })
}
