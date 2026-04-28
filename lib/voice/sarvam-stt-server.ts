/**
 * Sarvam STT WebSocket bridge — server-only.
 *
 * Thin wrapper around `sarvamai`'s `SpeechToTextStreamingClient` that the
 * `/api/transcribe` route consumes. Owns:
 *
 *   - Reading `SARVAM_API_KEY` from `process.env` (server-only; never logs
 *     or echoes the key).
 *   - Opening a streaming socket with the format constants from the
 *     pre-flight spike (`docs/research/sarvam-format-spikes.md`):
 *       model = 'saaras:v3'
 *       input_audio_codec = 'wav'
 *       sample_rate = '16000'
 *       high_vad_sensitivity = 'true'
 *   - Forwarding audio chunks (PCM 16-bit LE 16kHz mono / WAV per the
 *     spike). Bytes arrive as `Uint8Array` and are base64-encoded for the
 *     SDK's `socket.transcribe({ audio, sample_rate, encoding })`.
 *   - Surfacing transcript + error events through callbacks — the route
 *     turns these into SSE frames.
 *   - Flushing (signals Sarvam to finalize the in-flight buffer) and
 *     cleanly closing on demand (client abort or cap hit).
 *
 * Why a separate module: the `/api/transcribe` route handler stays focused
 * on HTTP / SSE / cap accounting; the Sarvam SDK quirks (event names,
 * close codes, base64 wrapping) live here behind a small surface that's
 * trivial to mock in tests.
 *
 * The `sarvamai` SDK is loaded via dynamic `import()` at connect time so
 * tests can `vi.mock('sarvamai', …)` without import-time side effects on
 * the route module graph.
 */

/**
 * Codec we send to Sarvam.
 *
 * Cycle 1 fix (Bug 1, HAR diagnosed 2026-04-28): the recorder produces raw
 * PCM s16le 16 kHz mono — never a real WAV. We previously labelled it `wav`,
 * which made Sarvam look for a RIFF header that wasn't there and emit zero
 * transcripts on every call. Truth-in-labelling: `pcm_s16le`.
 */
export const SARVAM_STT_AUDIO_CODEC = 'pcm_s16le' as const

/** Sample rate we capture + send. */
export const SARVAM_STT_SAMPLE_RATE = 16000 as const

/** Model selected for streaming STT. */
export const SARVAM_STT_MODEL = 'saaras:v3' as const

/** Public error code returned in SSE error frames + status responses. */
export type SarvamSttErrorCode =
  | 'voice.provider_unconfigured'
  | 'voice.session_too_long'
  | 'voice.session_too_large'
  | 'voice.network'
  | 'voice.aborted'

/** What a connected Sarvam STT session exposes back to the route handler. */
export interface SarvamSttHandle {
  /** Send one audio chunk (PCM/WAV bytes). Returns false if socket closed. */
  sendAudioChunk(chunk: Uint8Array): boolean
  /** Signal Sarvam to flush its buffer and finalize any in-flight partial. */
  flush(): void
  /** Close the socket. Idempotent — safe to call from abort handlers. */
  close(): void
  /** True once `close()` has been called or the socket emitted close/error. */
  readonly isClosed: boolean
}

export interface SarvamSttCallbacks {
  /**
   * A `data`-typed Sarvam message arrived. Sarvam's protocol does NOT
   * include a strict `is_final` flag in this SDK version, so the route
   * treats the latest transcript as the running text and promotes it to
   * "final" when the socket closes (or when the cap timer fires).
   */
  onTranscript: (text: string) => void
  /** Network / SDK errors. The route translates into SSE `error` frame. */
  onError: (code: SarvamSttErrorCode, message: string) => void
  /** Socket closed cleanly (server side or local close). */
  onClose: () => void
}

export interface SarvamSttConnectOptions extends SarvamSttCallbacks {
  /** BCP-47 code (`en-IN`, `hi-IN`, …). Mandatory — Sarvam requires it. */
  languageCode: string
}

/**
 * Read `SARVAM_API_KEY` without logging it. Returns `null` if missing/blank.
 * Pulled out so the route can do the 503 short-circuit without touching the
 * SDK at all.
 */
export function readSarvamApiKey(): string | null {
  const raw = process.env.SARVAM_API_KEY
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Open a Sarvam streaming STT socket and wire up callbacks.
 *
 * Throws if the SDK client construction or `connect()` rejects — the route
 * catches and converts into the right HTTP status.
 */
export async function connectSarvamStt(
  options: SarvamSttConnectOptions,
): Promise<SarvamSttHandle> {
  const apiKey = readSarvamApiKey()
  if (apiKey === null) {
    throw new Error('voice.provider_unconfigured')
  }

  // Dynamic import keeps `sarvamai` out of the route module's eager graph
  // and lets tests mock it via `vi.mock('sarvamai', ...)` without
  // resolution-ordering hazards.
  const { SarvamAIClient } = await import('sarvamai')
  const client = new SarvamAIClient({ apiSubscriptionKey: apiKey })

  // The SDK's connect args are typed but we pass through values verified
  // by the pre-flight spike. `as never` keeps strict TS happy if the SDK
  // narrows the literal types differently across versions.
  const socket = await client.speechToTextStreaming.connect({
    'language-code': options.languageCode as never,
    model: SARVAM_STT_MODEL as never,
    input_audio_codec: SARVAM_STT_AUDIO_CODEC as never,
    sample_rate: String(SARVAM_STT_SAMPLE_RATE),
    high_vad_sensitivity: 'true' as never,
    'Api-Subscription-Key': apiKey,
  })

  // The SDK's `connect()` returns as soon as the underlying
  // `ReconnectingWebSocket` is constructed — readyState may still be
  // CONNECTING. The first `transcribe()` call would then throw "Socket
  // is not open" via the SDK's `assertSocketIsOpen()` check. Buffered
  // uploads expose this race because the entire body is ready to send
  // immediately after connect. `waitForOpen()` is the SDK's official
  // affordance; only present on newer versions, so guard the call.
  const maybeWaitForOpen = (
    socket as unknown as { waitForOpen?: () => Promise<unknown> }
  ).waitForOpen
  if (typeof maybeWaitForOpen === 'function') {
    try {
      await maybeWaitForOpen.call(socket)
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `voice.connect_failed: ${err.message}`
          : 'voice.connect_failed',
      )
    }
  }

  let closed = false
  const markClosed = (): boolean => {
    if (closed) return false
    closed = true
    return true
  }

  // Sarvam STT response shape (see SDK):
  //   { type: 'data' | 'error' | 'events',
  //     data: SpeechToTextTranscriptionData | ErrorData | EventsData }
  // Each `data`-typed message carries a `transcript` string. Cycle 1
  // forwards every one to the route; the route concatenates / picks the
  // last as "final" on close.
  socket.on('message', (msg: unknown) => {
    if (msg === null || typeof msg !== 'object') return
    const m = msg as { type?: string; data?: unknown }
    if (m.type === 'data') {
      const d = m.data as { transcript?: unknown } | undefined
      if (d && typeof d.transcript === 'string') {
        options.onTranscript(d.transcript)
      }
      return
    }
    if (m.type === 'error') {
      const d = m.data as { error?: unknown; message?: unknown } | undefined
      const msgText =
        d && typeof d.error === 'string'
          ? d.error
          : d && typeof d.message === 'string'
            ? d.message
            : 'Sarvam error'
      options.onError('voice.network', msgText)
      return
    }
    // 'events' (VAD signals) — ignored in cycle 1.
  })

  socket.on('error', (err: Error) => {
    if (closed) return
    options.onError(
      'voice.network',
      err && typeof err.message === 'string' ? err.message : 'socket error',
    )
  })

  socket.on('close', () => {
    if (markClosed()) options.onClose()
  })

  return {
    sendAudioChunk(chunk: Uint8Array): boolean {
      if (closed) return false
      try {
        // base64 is the canonical encoding the SDK expects per its
        // `audio: string` contract on `socket.transcribe`.
        const audio = Buffer.from(
          chunk.buffer,
          chunk.byteOffset,
          chunk.byteLength,
        ).toString('base64')
        socket.transcribe({
          audio,
          sample_rate: SARVAM_STT_SAMPLE_RATE,
          encoding: `audio/${SARVAM_STT_AUDIO_CODEC}`,
        })
        return true
      } catch (err) {
        options.onError(
          'voice.network',
          (err as Error)?.message ?? 'transcribe failed',
        )
        return false
      }
    },
    flush(): void {
      if (closed) return
      try {
        socket.flush()
      } catch {
        // Swallow — we'll close immediately after anyway.
      }
    },
    close(): void {
      if (!markClosed()) return
      try {
        socket.close()
      } catch {
        // Swallow — caller is shutting down regardless.
      }
      options.onClose()
    },
    get isClosed(): boolean {
      return closed
    },
  }
}
