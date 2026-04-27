/**
 * Sarvam STT adapter — browser-side `VoiceProvider` that streams PCM
 * mic audio to `/api/transcribe?lang=<code>` and consumes a tiny SSE
 * stream of `partial` / `final` / `error` events back from the route.
 *
 * Architecture (locked in pre-flight, see
 * `docs/research/sarvam-format-spikes.md` and
 * `docs/features/voice-cycle-1-plan.md`):
 *
 *   getUserMedia → MediaStream
 *      → SarvamRecorder (WebAudio downsample to 16 kHz mono PCM s16le)
 *      → ReadableStream<Uint8Array>  (streaming mode)
 *        OR Uint8Array buffer        (buffered mode — local HTTP/1.1)
 *      → fetch('/api/transcribe?lang=<code>',
 *              { method: 'POST', body: stream|buffer, duplex: 'half' (streaming only) })
 *      → response body (text/event-stream)
 *      → SSE parser
 *      → onPartial(text) | resolve final transcript | typed VoiceError
 *
 * Sarvam's streaming STT does NOT accept WebM/Opus at the protocol
 * layer — only `wav` / `pcm_s16le` / `pcm_l16` / `pcm_raw`. The
 * recorder always emits raw PCM s16le; the route on the server side
 * forwards it as `audio/wav`.
 *
 * `language_code` is mandatory in the constructor (no default
 * fallback). It flows through to the route via the `?lang=…` query
 * param and on to Sarvam as `'language-code'`.
 *
 * **Streaming vs buffered:** Chrome rejects streaming request bodies
 * (`fetch` with a `ReadableStream` body and `duplex: 'half'`) on
 * HTTP/1.1 — there is no localhost exception. Vercel deploys are
 * HTTP/2+ so streaming works there; `next dev` is HTTP/1.1 so
 * streaming fails. The adapter picks a mode at start():
 *   - `streamingMode: 'streaming'` → fire fetch on start(), enqueue
 *     each PCM chunk to the request stream as recorder emits it,
 *     close the stream on stop(). Server emits SSE partials in real
 *     time → live word-by-word UI.
 *   - `streamingMode: 'buffered'` → buffer chunks during recording,
 *     fire one POST at stop() with the concatenated body. Server
 *     processes and returns the SSE final frame; no live partials.
 *   - `streamingMode: 'auto'` (default) → streaming if
 *     `window.location.protocol === 'https:'` (Vercel deploys, HTTPS
 *     localhost dev with --experimental-https), buffered otherwise.
 */

import { SarvamRecorder } from './sarvam-recorder'
import type {
  Transcript,
  VoiceCapabilities,
  VoiceError,
  VoiceProvider,
} from './types'

/** Mode resolution at start(). See class doc-comment. */
export type SarvamUploadMode = 'auto' | 'streaming' | 'buffered'

/** Constructor args. `language_code` is mandatory (e.g. `en-IN`, `hi-IN`). */
export interface SarvamAdapterOptions {
  language_code: string
  /**
   * Override the upload endpoint. Defaults to `/api/transcribe`. Used
   * by tests that stand up a fake fetch and want to inspect the URL.
   */
  endpoint?: string
  /**
   * Test seam: replace the global `fetch`. Defaults to
   * `globalThis.fetch.bind(globalThis)`. Lets tests assert request shape
   * without monkey-patching `globalThis`.
   */
  fetchImpl?: typeof fetch
  /**
   * Test seam: replace `navigator.mediaDevices.getUserMedia`. Defaults
   * to the browser implementation.
   */
  getUserMediaImpl?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  /**
   * Test seam: provide a recorder factory. Production code constructs
   * a real `SarvamRecorder`; tests inject a fake that emits scripted
   * chunks via `feedSamples` or by calling `onChunk` listeners
   * directly.
   */
  recorderFactory?: (stream: MediaStream) => SarvamRecorderLike
  /**
   * Override the AbortController constructor for tests.
   */
  abortControllerCtor?: typeof AbortController
  /**
   * Upload mode. `'auto'` (default) picks streaming on HTTPS,
   * buffered on HTTP. Tests usually pin `'buffered'` so jsdom (which
   * has no streaming support) doesn't complicate request-body
   * assertions; the streaming path has its own test file.
   */
  streamingMode?: SarvamUploadMode
}

/**
 * Subset of `SarvamRecorder` the adapter actually depends on. Lets
 * tests pass a hand-rolled fake without satisfying the full class
 * shape.
 */
export interface SarvamRecorderLike {
  onChunk(cb: (chunk: Uint8Array) => void): void
  onSilenceDetected?(cb: () => void): void
  start(): Promise<void>
  stop(): Promise<void>
}

/** Shape of an SSE event the adapter dispatches on. */
interface ParsedSseEvent {
  event: string
  data: string
}

export class SarvamAdapter implements VoiceProvider {
  readonly capabilities: VoiceCapabilities = { partials: true, vad: true }

  private readonly language_code: string
  private readonly endpoint: string
  private readonly fetchImpl: typeof fetch
  private readonly getUserMediaImpl: (
    constraints: MediaStreamConstraints,
  ) => Promise<MediaStream>
  private readonly recorderFactory: (stream: MediaStream) => SarvamRecorderLike
  private readonly abortControllerCtor: typeof AbortController
  private readonly streamingModeOpt: SarvamUploadMode

  private partialListeners: Array<(partial: string) => void> = []
  private errorListeners: Array<(err: VoiceError) => void> = []
  /**
   * Fix F.1: silence-VAD listeners. Adapter fans out the recorder's
   * `onSilenceDetected` event to subscribers (the hook) instead of
   * calling `this.stop()` directly. The hook owns stop policy so the
   * reducer transitions via the same PROVIDER_STOPPED path as a tap.
   */
  private silenceListeners: Array<() => void> = []

  private mediaStream: MediaStream | null = null
  private recorder: SarvamRecorderLike | null = null
  private uploadController: AbortController | null = null
  private responseReader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private fetchPromise: Promise<Response> | null = null

  /**
   * Buffered mode: PCM chunks accumulate here during recording, get
   * concatenated and POSTed once on stop().
   */
  private pcmChunks: Uint8Array[] = []
  private pcmByteLength = 0

  /**
   * Streaming mode: chunks are pushed into this writer as they arrive
   * from the recorder; `stop()` closes the writer to signal end-of-audio
   * to the server.
   */
  private bodyWriter: WritableStreamDefaultWriter<Uint8Array> | null = null
  /** Resolved at start() — `'streaming'` or `'buffered'`. */
  private resolvedMode: 'streaming' | 'buffered' = 'buffered'

  private startedAt = 0
  private latestPartial = ''
  private finalTranscript: Transcript | null = null
  private errored: VoiceError | null = null

  /** Resolves once the SSE stream has surfaced a `final` (or errored). */
  private finalSettled: {
    resolve: (t: Transcript) => void
    reject: (err: VoiceError) => void
  } | null = null
  private finalPromise: Promise<Transcript> | null = null
  /**
   * Fix F.2: cache the in-flight stop() invocation so concurrent
   * callers (silence VAD racing a manual tap, or any future
   * double-call) share one POST + one resetTurnState. Cleared by
   * resetTurnState so the next turn re-arms cleanly.
   */
  private stopPromise: Promise<Transcript> | null = null

  private started = false
  private stopped = false

  /** Registered once the recorder is wired in start(); cleared on resetTurnState. */
  private silenceFired = false

  constructor(opts: SarvamAdapterOptions) {
    if (
      typeof opts?.language_code !== 'string' ||
      opts.language_code.trim().length === 0
    ) {
      throw new Error(
        'SarvamAdapter: language_code is required (got empty or non-string).',
      )
    }
    this.language_code = opts.language_code.trim()
    this.endpoint = opts.endpoint ?? '/api/transcribe'
    this.fetchImpl =
      opts.fetchImpl ??
      (typeof fetch !== 'undefined'
        ? fetch.bind(globalThis)
        : ((() => {
            throw new Error('SarvamAdapter: no fetch available in this environment')
          }) as unknown as typeof fetch))
    this.getUserMediaImpl =
      opts.getUserMediaImpl ??
      ((constraints: MediaStreamConstraints) => {
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== 'function'
        ) {
          return Promise.reject(
            new DOMException('mediaDevices not available', 'NotSupportedError'),
          )
        }
        return navigator.mediaDevices.getUserMedia(constraints)
      })
    this.recorderFactory =
      opts.recorderFactory ??
      ((stream: MediaStream) => new SarvamRecorder({ stream, timesliceMs: 250 }))
    this.abortControllerCtor = opts.abortControllerCtor ?? AbortController
    this.streamingModeOpt = opts.streamingMode ?? 'auto'
  }

  onPartial(cb: (partial: string) => void): void {
    this.partialListeners.push(cb)
  }

  onError(cb: (err: VoiceError) => void): void {
    this.errorListeners.push(cb)
  }

  /**
   * Fix F.1: subscribe to silence-VAD events. Fired once per turn when
   * the recorder's `onSilenceDetected` triggers. The hook calls `stop()`
   * in response so the reducer learns the transcript via the same
   * PROVIDER_STOPPED path as a manual tap.
   */
  onSilence(cb: () => void): void {
    this.silenceListeners.push(cb)
  }

  async start(): Promise<void> {
    if (this.started) {
      const err: VoiceError = {
        kind: 'aborted',
        message: 'SarvamAdapter.start: already started',
      }
      this.emitError(err)
      throw err
    }
    this.started = true
    this.startedAt = Date.now()
    this.resolvedMode = this.resolveMode()

    // Pre-arm the final-settled promise BEFORE any awaits. The hook
    // re-arms start() for the answer turn while the reducer is already
    // in `listening-answer`; if the user taps the orb to stop during the
    // getUserMedia / recorder.start window, stop() runs before this
    // would otherwise be set and would throw "finalPromise missing".
    // Allocating up-front makes start() / stop() race-safe and lets
    // error paths reject the same promise so awaiters see the failure.
    this.finalPromise = new Promise<Transcript>((resolve, reject) => {
      this.finalSettled = { resolve, reject }
    })
    // Suppress unhandled-rejection if no one awaits before reject runs.
    this.finalPromise.catch(() => undefined)

    // 1. Acquire mic.
    let stream: MediaStream
    try {
      stream = await this.getUserMediaImpl({ audio: true })
    } catch (e) {
      const err = mapMediaError(e)
      this.finalSettled?.reject(err)
      this.finalSettled = null
      this.cleanupAfterFailure()
      this.emitError(err)
      throw err
    }
    this.mediaStream = stream

    // 2. Build the recorder.
    let recorder: SarvamRecorderLike
    try {
      recorder = this.recorderFactory(stream)
    } catch (e) {
      const err: VoiceError = {
        kind: 'unsupported',
        message:
          e instanceof Error
            ? e.message
            : 'SarvamAdapter: recorder construction failed',
      }
      this.finalSettled?.reject(err)
      this.finalSettled = null
      this.cleanupAfterFailure()
      this.emitError(err)
      throw err
    }
    this.recorder = recorder

    // 3. Wire chunk + silence listeners.
    if (this.resolvedMode === 'streaming') {
      // Streaming mode: open the request stream + fire fetch BEFORE the
      // first chunk arrives so the upload is hot-pipelined.
      const ts = new TransformStream<Uint8Array, Uint8Array>()
      this.bodyWriter = ts.writable.getWriter()

      recorder.onChunk((chunk) => {
        if (this.stopped) return
        // Fire-and-forget; backpressure is acceptable, dropping a
        // chunk is not — but TransformStream's default queue handles
        // it for typical bitrates (32 KB/s).
        this.bodyWriter?.write(chunk).catch(() => undefined)
      })

      this.uploadController = new this.abortControllerCtor()
      const url = `${this.endpoint}?lang=${encodeURIComponent(this.language_code)}`
      try {
        this.fetchPromise = this.fetchImpl(url, {
          method: 'POST',
          body: ts.readable,
          signal: this.uploadController.signal,
          headers: { 'Content-Type': 'audio/wav' },
          // `duplex: 'half'` is required by the spec when the body is
          // a stream. TS lib.dom is stale on this; cast through unknown.
          duplex: 'half',
        } as unknown as RequestInit)
      } catch (e) {
        // Synchronous throw is rare but defensive. Treat as network err.
        const err: VoiceError = {
          kind: 'network',
          message:
            e instanceof Error
              ? e.message
              : 'SarvamAdapter: streaming fetch threw synchronously',
        }
        this.finalSettled?.reject(err)
        this.finalSettled = null
        this.cleanupAfterFailure()
        this.emitError(err)
        throw err
      }
      // Drain the SSE response in the background; rejections route
      // through handleResponseFailure into finalSettled.reject.
      this.consumeResponse(this.fetchPromise).catch((err) => {
        this.handleResponseFailure(err)
      })
    } else {
      // Buffered mode: chunks pile up; stop() will fire one POST.
      recorder.onChunk((chunk) => {
        if (this.stopped) return
        this.pcmChunks.push(chunk)
        this.pcmByteLength += chunk.byteLength
      })
    }

    // Silence VAD wiring (Phase 2) — fires once when the recorder
    // detects trailing silence after speech.
    //
    // Fix F.1: stop policy moved to the hook. We fan the silence event
    // out to external listeners (the hook subscribes via `onSilence`)
    // instead of calling `this.stop()` directly. The previous shape
    // discarded the Promise<Transcript> returned by stop() so the hook
    // never learned the transcript and the reducer was stranded in
    // `listening` while the audio had already been POSTed.
    if (typeof recorder.onSilenceDetected === 'function') {
      recorder.onSilenceDetected(() => {
        if (this.silenceFired || this.stopped) return
        this.silenceFired = true
        for (const cb of this.silenceListeners) {
          try {
            cb()
          } catch {
            // Listener errors are non-fatal — the hook is the only
            // subscriber today and it already routes its own failures.
          }
        }
      })
    }

    try {
      await recorder.start()
    } catch (e) {
      const err: VoiceError = {
        kind: 'unsupported',
        message:
          e instanceof Error ? e.message : 'SarvamAdapter: recorder.start failed',
      }
      this.finalSettled?.reject(err)
      this.finalSettled = null
      this.cleanupAfterFailure()
      this.emitError(err)
      throw err
    }
  }

  async stop(): Promise<Transcript> {
    if (!this.started) {
      const err: VoiceError = {
        kind: 'aborted',
        message: 'SarvamAdapter.stop: stop() called before start()',
      }
      throw err
    }
    if (this.errored) throw this.errored
    if (this.finalTranscript) return this.finalTranscript
    // Fix F.2 reentrancy: a second concurrent stop() returns the same
    // promise instead of firing another POST + racing resetTurnState.
    // Cleared in resetTurnState so the next turn re-arms cleanly. The
    // assignment must happen synchronously before any await so a
    // re-entrant caller sees the cached promise — otherwise both
    // calls progress past the guard and fire duplicate POSTs.
    if (this.stopPromise) return this.stopPromise
    this.stopped = true
    this.stopPromise = this.runStopFlow()
    return this.stopPromise
  }

  /**
   * Real stop() body, kept private so `stop()` can synchronously
   * cache the resulting promise on `this.stopPromise` before any
   * await. Concurrent stop() calls share this single in-flight
   * promise (Fix F.2).
   */
  private async runStopFlow(): Promise<Transcript> {
    // Stop the recorder first so any partial in-flight buffer flushes
    // its trailing chunk into our buffer (buffered) or stream (streaming).
    try {
      await this.recorder?.stop()
    } catch {
      // Recorder shutdown errors are non-fatal — we still try to
      // upload whatever PCM we did capture.
    }

    // Release the mic immediately. The `final` SSE event arrives over
    // the response stream of the upload below; no need to keep the
    // mic indicator lit while we wait.
    this.releaseMicTracks()

    if (this.resolvedMode === 'streaming') {
      // Close the body writer — server gets EOF on request body,
      // pumps last chunks to Sarvam, and emits the SSE `final` frame.
      const writer = this.bodyWriter
      this.bodyWriter = null
      try {
        await writer?.close()
      } catch {
        // Already closed / errored — ignore; SSE consumer handles final.
      }
    } else {
      // Buffered mode: concatenate and POST once. Chrome requires
      // HTTP/2+ for streaming bodies and there is no localhost
      // exception, so this is what works against `next dev` (HTTP/1.1).
      const body = concatChunks(this.pcmChunks, this.pcmByteLength)
      this.pcmChunks = []
      this.pcmByteLength = 0

      this.uploadController = new this.abortControllerCtor()
      const url = `${this.endpoint}?lang=${encodeURIComponent(this.language_code)}`
      this.fetchPromise = this.fetchImpl(url, {
        method: 'POST',
        body,
        signal: this.uploadController.signal,
        headers: { 'Content-Type': 'audio/wav' },
      } as RequestInit)

      // Drain SSE in background.
      this.consumeResponse(this.fetchPromise).catch((err) => {
        this.handleResponseFailure(err)
      })
    }

    if (!this.finalPromise) {
      const err: VoiceError = {
        kind: 'aborted',
        message: 'SarvamAdapter.stop: finalPromise missing',
      }
      throw err
    }
    // Reset turn-scoped state once the final settles (success or error)
    // so the same adapter instance can be re-armed by start() for the
    // next conversational turn — the hook reuses one instance across
    // listening / listening-answer turns.
    try {
      const t = await this.finalPromise
      this.resetTurnState()
      return t
    } catch (e) {
      this.resetTurnState()
      throw e
    }
  }

  /**
   * Decide streaming vs buffered for this turn. `'auto'` checks the
   * page protocol — HTTPS implies HTTP/2+ on every modern browser
   * (Vercel deploys, localhost with --experimental-https). HTTP
   * (plain `next dev`) cannot do streaming uploads in Chrome.
   */
  private resolveMode(): 'streaming' | 'buffered' {
    if (this.streamingModeOpt === 'streaming') return 'streaming'
    if (this.streamingModeOpt === 'buffered') return 'buffered'
    // 'auto'
    if (
      typeof window !== 'undefined' &&
      typeof window.location !== 'undefined' &&
      window.location.protocol === 'https:'
    ) {
      return 'streaming'
    }
    return 'buffered'
  }

  /** Reset turn-scoped state but keep listeners — see stop() for context. */
  private resetTurnState(): void {
    this.started = false
    this.stopped = false
    this.recorder = null
    this.uploadController = null
    this.responseReader = null
    this.fetchPromise = null
    this.bodyWriter = null
    this.pcmChunks = []
    this.pcmByteLength = 0
    this.startedAt = 0
    this.latestPartial = ''
    this.finalTranscript = null
    this.errored = null
    this.finalSettled = null
    this.finalPromise = null
    this.silenceFired = false
    this.stopPromise = null
  }

  // --- Internals ----------------------------------------------------------

  private async consumeResponse(fetchPromise: Promise<Response>): Promise<void> {
    let response: Response
    try {
      response = await fetchPromise
    } catch (e) {
      throw mapFetchError(e)
    }

    if (!response.ok) {
      const message = await safeReadText(response)
      throw {
        kind: 'network',
        message: `SarvamAdapter: upload failed with HTTP ${response.status}${
          message ? ` — ${message.slice(0, 200)}` : ''
        }`,
      } satisfies VoiceError
    }

    const body = response.body
    if (!body) {
      throw {
        kind: 'network',
        message: 'SarvamAdapter: response had no body',
      } satisfies VoiceError
    }

    const reader = body.getReader()
    this.responseReader = reader
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        buffer += decoder.decode(value, { stream: true })
        const events = drainSseEvents(buffer)
        buffer = events.remainder
        for (const ev of events.events) {
          this.handleSseEvent(ev)
          if (this.finalTranscript || this.errored) return
        }
      }
      // Flush trailing decoded data in case the stream ended without a
      // closing blank line.
      buffer += decoder.decode()
      const tail = drainSseEvents(buffer)
      for (const ev of tail.events) {
        this.handleSseEvent(ev)
        if (this.finalTranscript || this.errored) return
      }
      // Stream ended without a `final` event — treat as aborted.
      if (!this.finalTranscript && !this.errored) {
        const err: VoiceError = {
          kind: 'aborted',
          message: 'SarvamAdapter: response stream closed before final event',
        }
        this.errored = err
        this.finalSettled?.reject(err)
        this.finalSettled = null
        this.emitError(err)
      }
    } finally {
      this.responseReader = null
    }
  }

  private handleSseEvent(ev: ParsedSseEvent): void {
    // The route emits frames as `data: {"type":"partial"|"final"|"error",...}`
    // with no SSE `event:` line, so all frames arrive with the default
    // event name `message`. Dispatch off the JSON `type` field instead.
    let kind = ev.event
    if (kind === 'message' || !kind) {
      const trimmed = ev.data?.trim() ?? ''
      if (trimmed.startsWith('{')) {
        try {
          const peeked = JSON.parse(trimmed) as { type?: unknown }
          if (typeof peeked.type === 'string') kind = peeked.type
        } catch {
          // Not valid JSON — fall through and let the default branch ignore it.
        }
      }
    }
    switch (kind) {
      case 'partial': {
        const text = parsePartialPayload(ev.data)
        if (text === null) return
        this.latestPartial = text
        for (const cb of this.partialListeners) cb(text)
        return
      }
      case 'final': {
        const parsed = parseFinalPayload(ev.data)
        const transcript: Transcript = {
          text: parsed.text ?? this.latestPartial ?? '',
          durationMs:
            typeof parsed.durationMs === 'number'
              ? parsed.durationMs
              : Math.max(0, Date.now() - this.startedAt),
          ...(typeof parsed.confidence === 'number'
            ? { confidence: parsed.confidence }
            : {}),
        }
        this.finalTranscript = transcript
        this.finalSettled?.resolve(transcript)
        this.finalSettled = null
        return
      }
      case 'error': {
        const err = parseErrorPayload(ev.data)
        this.errored = err
        this.finalSettled?.reject(err)
        this.finalSettled = null
        this.emitError(err)
        return
      }
      default:
        // Unknown SSE event — ignore; the route is the source of truth
        // and we don't want to crash on a future event we don't model.
        return
    }
  }

  private handleResponseFailure(err: unknown): void {
    if (this.finalTranscript || this.errored) return
    const voiceErr: VoiceError =
      err && typeof err === 'object' && 'kind' in err
        ? (err as VoiceError)
        : {
            kind: 'network',
            message:
              err instanceof Error
                ? err.message
                : 'SarvamAdapter: response stream failed',
          }
    this.errored = voiceErr
    this.finalSettled?.reject(voiceErr)
    this.finalSettled = null
    this.emitError(voiceErr)
  }

  private releaseMicTracks(): void {
    const stream = this.mediaStream
    if (!stream) return
    try {
      const tracks = stream.getTracks()
      for (const t of tracks) {
        try {
          t.stop()
        } catch {
          // ignore
        }
      }
    } catch {
      // Some test stubs don't implement getTracks — that's fine.
    }
    this.mediaStream = null
  }

  /**
   * External abort. Cancels the in-flight fetch, releases mic, drops
   * pending listeners. Safe to call from any state.
   */
  abort(reason?: string): void {
    if (this.errored || this.finalTranscript) return
    this.stopped = true
    const err: VoiceError = {
      kind: 'aborted',
      message: reason ?? 'SarvamAdapter: aborted by caller',
    }
    this.errored = err
    try {
      this.uploadController?.abort()
    } catch {
      // ignore
    }
    try {
      this.responseReader?.cancel()
    } catch {
      // ignore
    }
    try {
      this.bodyWriter?.abort()
    } catch {
      // ignore
    }
    this.bodyWriter = null
    this.pcmChunks = []
    this.pcmByteLength = 0
    this.recorder?.stop().catch(() => undefined)
    this.releaseMicTracks()
    this.finalSettled?.reject(err)
    this.finalSettled = null
    this.emitError(err)
  }

  private cleanupAfterFailure(): void {
    this.releaseMicTracks()
    this.recorder = null
    this.uploadController = null
    this.bodyWriter = null
    this.pcmChunks = []
    this.pcmByteLength = 0
    // Allow callers to retry via a fresh start() after a failure.
    this.started = false
  }

  private emitError(err: VoiceError): void {
    for (const cb of this.errorListeners) cb(err)
  }
}

// --- Helpers --------------------------------------------------------------

/**
 * Map a `getUserMedia` rejection to a typed `VoiceError`. Browsers
 * surface a `DOMException` with a small set of `name` values for the
 * permission cases.
 */
function mapMediaError(err: unknown): VoiceError {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: unknown }).name ?? '')
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return {
          kind: 'permission-denied',
          message: 'Microphone permission denied.',
        }
      case 'NotFoundError':
      case 'OverconstrainedError':
      case 'NotReadableError':
        return {
          kind: 'unsupported',
          message: 'Microphone not available on this device.',
        }
      case 'AbortError':
        return { kind: 'aborted', message: 'Microphone request aborted.' }
      case 'NotSupportedError':
        return {
          kind: 'unsupported',
          message: 'getUserMedia is not supported in this environment.',
        }
    }
  }
  return {
    kind: 'unsupported',
    message:
      err instanceof Error
        ? err.message
        : 'Microphone unavailable (unknown error).',
  }
}

function mapFetchError(err: unknown): VoiceError {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: unknown }).name ?? '')
    if (name === 'AbortError') {
      return { kind: 'aborted', message: 'Upload aborted.' }
    }
  }
  return {
    kind: 'network',
    message:
      err instanceof Error ? err.message : 'SarvamAdapter: upload network error',
  }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1) return chunks[0]
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/**
 * Parse a buffer of SSE-formatted text and return any complete events
 * plus the trailing remainder. SSE events are separated by `\n\n` (or
 * `\r\n\r\n`). Each event is a series of `field: value` lines; we only
 * care about `event:` and `data:` (possibly multi-line).
 */
export function drainSseEvents(buffer: string): {
  events: ParsedSseEvent[]
  remainder: string
} {
  const events: ParsedSseEvent[] = []
  // Normalise CRLF → LF so we have a single delimiter to split on.
  const normalised = buffer.replace(/\r\n/g, '\n')
  const parts = normalised.split('\n\n')
  // The last segment is the (possibly partial) tail.
  const remainder = parts.pop() ?? ''
  for (const block of parts) {
    if (!block.trim()) continue
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const idx = line.indexOf(':')
      const field = idx === -1 ? line : line.slice(0, idx)
      let value = idx === -1 ? '' : line.slice(idx + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') dataLines.push(value)
    }
    events.push({ event, data: dataLines.join('\n') })
  }
  return { events, remainder }
}

function parsePartialPayload(data: string): string | null {
  if (!data) return null
  const trimmed = data.trim()
  if (!trimmed) return null
  // Accept either a JSON `{ text }` shape or a raw string.
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { text?: unknown }
      if (typeof parsed.text === 'string') return parsed.text
      return null
    } catch {
      return null
    }
  }
  return trimmed
}

function parseFinalPayload(data: string): {
  text?: string
  durationMs?: number
  confidence?: number
} {
  if (!data) return {}
  const trimmed = data.trim()
  if (!trimmed) return {}
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const out: { text?: string; durationMs?: number; confidence?: number } = {}
      if (typeof parsed.text === 'string') out.text = parsed.text
      if (typeof parsed.durationMs === 'number') out.durationMs = parsed.durationMs
      if (typeof parsed.confidence === 'number') out.confidence = parsed.confidence
      return out
    } catch {
      return {}
    }
  }
  return { text: trimmed }
}

function parseErrorPayload(data: string): VoiceError {
  if (data) {
    const trimmed = data.trim()
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as { kind?: unknown; message?: unknown }
        const kindRaw = typeof parsed.kind === 'string' ? parsed.kind : 'network'
        const allowed = new Set([
          'permission-denied',
          'no-speech',
          'network',
          'unsupported',
          'aborted',
        ])
        const kind = (allowed.has(kindRaw) ? kindRaw : 'network') as VoiceError['kind']
        const message =
          typeof parsed.message === 'string' ? parsed.message : 'Sarvam STT error.'
        return { kind, message }
      } catch {
        return { kind: 'network', message: trimmed.slice(0, 200) }
      }
    }
    return { kind: 'network', message: trimmed.slice(0, 200) }
  }
  return { kind: 'network', message: 'Sarvam STT error.' }
}
