/**
 * Streaming-mode tests for `lib/voice/sarvam-adapter.ts`.
 *
 * The default-mode tests in `sarvam-adapter.test.ts` pin
 * `streamingMode: 'auto'` which resolves to `'buffered'` under jsdom
 * (http: protocol, no streaming-fetch support). This file pins
 * `streamingMode: 'streaming'` and locks in the live-partial contract:
 *
 *   - fetch fires on `start()`, NOT on `stop()`
 *   - request body is a `ReadableStream` (TransformStream readable side)
 *   - PCM chunks emitted by the recorder during recording flow into
 *     the request stream as they arrive (no concatenation)
 *   - SSE response is consumed in parallel; `partial` frames invoke
 *     `onPartial` listeners BEFORE `stop()` is called
 *   - `stop()` closes the request-stream writer; server-sent `final`
 *     resolves the returned Transcript
 *   - `abort()` aborts the upload controller AND the body writer
 *
 * Note on jsdom: jsdom does not implement streaming-fetch nor enforce
 * HTTP/2. Tests inject a fake `fetchImpl` so we never actually issue a
 * real fetch — we observe the `RequestInit.body` directly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReadableStream as NodeReadableStream,
  TransformStream as NodeTransformStream,
  type ReadableStreamDefaultController as NodeReadableStreamDefaultController,
} from 'node:stream/web'
import {
  SarvamAdapter,
  type SarvamRecorderLike,
} from '@/lib/voice/sarvam-adapter'

if (typeof globalThis.ReadableStream === 'undefined') {
  ;(globalThis as unknown as { ReadableStream: typeof ReadableStream }).ReadableStream =
    NodeReadableStream as unknown as typeof ReadableStream
}
if (typeof globalThis.TransformStream === 'undefined') {
  ;(globalThis as unknown as { TransformStream: typeof TransformStream }).TransformStream =
    NodeTransformStream as unknown as typeof TransformStream
}

// --- Helpers --------------------------------------------------------------

interface FakeTrack {
  stop: ReturnType<typeof vi.fn>
}
function makeFakeStream(): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = [{ stop: vi.fn() }]
  const stream = {
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  } as unknown as MediaStream
  return { stream, tracks }
}

interface FakeRecorderHandle extends SarvamRecorderLike {
  emit: (chunk: Uint8Array) => void
  fireSilence: () => void
  startCalls: number
  stopCalls: number
}

function makeFakeRecorder(): FakeRecorderHandle {
  let listener: ((c: Uint8Array) => void) | null = null
  let silenceListener: (() => void) | null = null
  const handle: FakeRecorderHandle = {
    onChunk(cb) {
      listener = cb
    },
    onSilenceDetected(cb) {
      silenceListener = cb
    },
    async start() {
      handle.startCalls++
    },
    async stop() {
      handle.stopCalls++
    },
    emit(chunk) {
      listener?.(chunk)
    },
    fireSilence() {
      silenceListener?.()
    },
    startCalls: 0,
    stopCalls: 0,
  }
  return handle
}

function makeStreamingResponse(): {
  response: Response
  push: (text: string) => void
  end: () => void
} {
  let controller!: NodeReadableStreamDefaultController<Uint8Array>
  const stream = new NodeReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  const enc = new TextEncoder()
  return {
    response: { ok: true, status: 200, body: stream, text: async () => '' } as unknown as Response,
    push: (text) => controller.enqueue(enc.encode(text)),
    end: () => controller.close(),
  }
}

/** Drain a `ReadableStream<Uint8Array>` into an array of chunks. */
async function drainBody(body: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return chunks
}

let originalAbortController: typeof AbortController
beforeEach(() => {
  originalAbortController = globalThis.AbortController
})
afterEach(() => {
  globalThis.AbortController = originalAbortController
  vi.restoreAllMocks()
})

// --- Tests ----------------------------------------------------------------

describe('SarvamAdapter — streaming mode', () => {
  it('fires fetch synchronously during start(), before any chunk arrives', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn().mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
      streamingMode: 'streaming',
    })

    await a.start()
    // fetch fires inside start(), independent of any chunk emission.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe('/api/transcribe?lang=en-IN')
    expect((init as RequestInit).method).toBe('POST')

    // Cleanup so the test doesn't leak open streams.
    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"x","durationMs":1}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()
  })

  it('uses a ReadableStream request body and forwards chunks live', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    let capturedBody: ReadableStream<Uint8Array> | null = null
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = init?.body as unknown as ReadableStream<Uint8Array>
      return ctrl.response
    }) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
      streamingMode: 'streaming',
    })

    await a.start()

    expect(capturedBody).not.toBeNull()
    // The body is a stream, not a Uint8Array. (Buffered mode posts a Uint8Array.)
    expect(capturedBody).not.toBeInstanceOf(Uint8Array)

    // Drain the body in parallel so the writer doesn't backpressure.
    const drainPromise = drainBody(capturedBody!)

    const c1 = new Uint8Array([1, 2, 3])
    const c2 = new Uint8Array([4, 5])
    recorder.emit(c1)
    recorder.emit(c2)

    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()

    const drained = await drainPromise
    const flat = drained.reduce<number[]>((acc, c) => acc.concat(Array.from(c)), [])
    expect(flat).toEqual([1, 2, 3, 4, 5])
  })

  it('fires onPartial during recording (before stop is called)', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn().mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
      streamingMode: 'streaming',
    })
    const partials: string[] = []
    a.onPartial((t) => partials.push(t))

    await a.start()

    // Drain the body so the fetch readable doesn't block.
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as
      | RequestInit
      | undefined
    void drainBody(init!.body as unknown as ReadableStream<Uint8Array>)

    // Push partials over the response stream while still "recording".
    ctrl.push('event: partial\ndata: {"text":"my"}\n\n')
    ctrl.push('event: partial\ndata: {"text":"my pain"}\n\n')
    // Yield so the SSE consumer microtask runs.
    await new Promise((r) => setTimeout(r, 0))

    expect(partials).toEqual(['my', 'my pain'])

    // Wrap up.
    ctrl.push('event: final\ndata: {"text":"my pain is high","durationMs":1}\n\n')
    ctrl.end()
    const t = await a.stop()
    expect(t.text).toBe('my pain is high')
  })

  it('closes the body writer on stop() (signals end-of-audio)', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    let capturedBody: ReadableStream<Uint8Array> | null = null
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = init?.body as unknown as ReadableStream<Uint8Array>
      return ctrl.response
    }) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
      streamingMode: 'streaming',
    })
    await a.start()

    const drainPromise = drainBody(capturedBody!)
    recorder.emit(new Uint8Array([9]))

    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"x","durationMs":1}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()

    // After stop(), the readable side completes (writer.close() fired).
    const drained = await drainPromise
    expect(drained.length).toBeGreaterThan(0)
  })

  it('forwards onSilence to listeners — Fix F.1 (hook owns stop policy)', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn().mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
      streamingMode: 'streaming',
    })
    const silenceCb = vi.fn()
    a.onSilence(silenceCb)
    await a.start()

    // Drain body so streaming doesn't backpressure.
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as
      | RequestInit
      | undefined
    void drainBody(init!.body as unknown as ReadableStream<Uint8Array>)

    recorder.fireSilence()
    // Listener fires synchronously when the adapter fans out — no await.
    expect(silenceCb).toHaveBeenCalledTimes(1)
    // Adapter must NOT auto-stop the recorder anymore — that's the
    // hook's job in production. Stale "auto-stop" was the bug F.1 fixes.
    expect(recorder.stopCalls).toBe(0)

    // Second silence fire on the same turn is swallowed by silenceFired.
    recorder.fireSilence()
    expect(silenceCb).toHaveBeenCalledTimes(1)
  })
})
