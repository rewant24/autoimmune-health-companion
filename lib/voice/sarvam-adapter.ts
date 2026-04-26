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
 *      → ReadableStream<Uint8Array>
 *      → fetch('/api/transcribe?lang=<code>',
 *              { method: 'POST', body: stream, duplex: 'half' })
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
 */

import { SarvamRecorder } from './sarvam-recorder'
import type {
  Transcript,
  VoiceCapabilities,
  VoiceError,
  VoiceProvider,
} from './types'

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
}

/**
 * Subset of `SarvamRecorder` the adapter actually depends on. Lets
 * tests pass a hand-rolled fake without satisfying the full class
 * shape.
 */
export interface SarvamRecorderLike {
  onChunk(cb: (chunk: Uint8Array) => void): void
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

  private partialListeners: Array<(partial: string) => void> = []
  private errorListeners: Array<(err: VoiceError) => void> = []

  private mediaStream: MediaStream | null = null
  private recorder: SarvamRecorderLike | null = null
  private uploadController: AbortController | null = null
  private uploadStreamController: ReadableStreamDefaultController<Uint8Array> | null =
    null
  private responseReader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private fetchPromise: Promise<Response> | null = null

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

  private started = false
  private stopped = false

  constructor(opts: SarvamAdapterOptions) {
    if (
      typeof opts?.language_code !== 'string' ||
      opts.language_code.trim().length === 0
    ) {
      throw new Error(
        'SarvamAdapter: language_code is required (got empty or non-string).',
      )
    }
    this.language_code = opts.language_code
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
  }

  onPartial(cb: (partial: string) => void): void {
    this.partialListeners.push(cb)
  }

  onError(cb: (err: VoiceError) => void): void {
    this.errorListeners.push(cb)
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

    // 1. Acquire mic.
    let stream: MediaStream
    try {
      stream = await this.getUserMediaImpl({ audio: true })
    } catch (e) {
      const err = mapMediaError(e)
      this.emitError(err)
      throw err
    }
    this.mediaStream = stream

    // 2. Build the upload ReadableStream — recorder pushes 250 ms PCM
    //    chunks into it; the controller is closed when the recorder
    //    stops.
    const self = this
    const uploadBody = new ReadableStream<Uint8Array>({
      start(controller) {
        self.uploadStreamController = controller
      },
      cancel() {
        // Caller cancelled — drop our handle so we don't double-close.
        self.uploadStreamController = null
      },
    })

    // 3. Spin up the recorder before the fetch so the first bytes are
    //    queued and the stream isn't read-empty.
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
      this.cleanupAfterFailure()
      this.emitError(err)
      throw err
    }
    this.recorder = recorder

    recorder.onChunk((chunk) => {
      const ctrl = this.uploadStreamController
      if (!ctrl || this.stopped) return
      try {
        ctrl.enqueue(chunk)
      } catch {
        // Stream closed under us — ignore; upload has settled.
      }
    })

    try {
      await recorder.start()
    } catch (e) {
      const err: VoiceError = {
        kind: 'unsupported',
        message:
          e instanceof Error ? e.message : 'SarvamAdapter: recorder.start failed',
      }
      this.cleanupAfterFailure()
      this.emitError(err)
      throw err
    }

    // 4. Build abort controller + URL with the language query param.
    this.uploadController = new this.abortControllerCtor()
    const url = `${this.endpoint}?lang=${encodeURIComponent(this.language_code)}`

    // 5. Kick the fetch. `duplex: 'half'` is required by the platform
    //    when the request body is a stream that's still being written.
    this.finalPromise = new Promise<Transcript>((resolve, reject) => {
      this.finalSettled = { resolve, reject }
    })
    // Attach a no-op catch so a rejection that happens before
    // `stop()` is awaited (e.g. external `abort()` in mid-session)
    // doesn't surface as an unhandled rejection. Awaiting `stop()`
    // still receives the rejection.
    this.finalPromise.catch(() => undefined)

    this.fetchPromise = this.fetchImpl(url, {
      method: 'POST',
      body: uploadBody,
      // `duplex` is required for streaming bodies. TS's RequestInit
      // doesn't list it yet, so cast.
      ...({ duplex: 'half' } as RequestInit),
      signal: this.uploadController.signal,
      headers: { 'Content-Type': 'audio/wav' },
    } as RequestInit)

    // 6. Consume the response in the background. We do NOT await it
    //    here — `start()` resolves once the recorder is rolling and
    //    the request is in flight. `stop()` waits on `finalPromise`.
    this.consumeResponse(this.fetchPromise).catch((err) => {
      this.handleResponseFailure(err)
    })
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

    // Mark stopped so further chunks/listeners short-circuit.
    this.stopped = true

    // Stop the recorder first so any partial in-flight buffer flushes
    // through the uploadStream as the trailing chunk.
    try {
      await this.recorder?.stop()
    } catch {
      // Recorder shutdown errors are non-fatal — we still need to
      // close the upload stream so the route sees EOF.
    }

    // Close the upload stream so the server knows we're done sending
    // audio and emits its `final` SSE event.
    try {
      this.uploadStreamController?.close()
    } catch {
      // already closed — ignore
    }

    // Release the mic immediately. Sarvam's `final` arrives over the
    // already-open response stream; no need to keep the mic indicator
    // lit while we wait.
    this.releaseMicTracks()

    // Wait on the final SSE event (or a typed error).
    if (!this.finalPromise) {
      const err: VoiceError = {
        kind: 'aborted',
        message: 'SarvamAdapter.stop: response stream never started',
      }
      throw err
    }
    return this.finalPromise
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
    switch (ev.event) {
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
      this.uploadStreamController?.close()
    } catch {
      // ignore
    }
    this.recorder?.stop().catch(() => undefined)
    this.releaseMicTracks()
    this.finalSettled?.reject(err)
    this.finalSettled = null
    this.emitError(err)
  }

  private cleanupAfterFailure(): void {
    try {
      this.uploadStreamController?.close()
    } catch {
      // ignore
    }
    this.uploadStreamController = null
    this.releaseMicTracks()
    this.recorder = null
    this.uploadController = null
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
