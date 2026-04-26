/**
 * Tests for `lib/voice/sarvam-adapter.ts` (US-V.B.1 – US-V.B.4).
 *
 * Coverage shape:
 *   - Constructor + capabilities (US-V.B.1)
 *   - start(): mic permission, recorder bring-up, fetch shape (US-V.B.2)
 *   - stop(): final SSE → Transcript; SSE error → typed VoiceError (US-V.B.3)
 *   - Cleanup: tracks released, fetch aborted, no leaked mic (US-V.B.4)
 *   - SSE parser exported helper sanity (drainSseEvents)
 *
 * Spike outcome (`docs/research/sarvam-format-spikes.md`): Sarvam STT
 * accepts `wav` / `pcm_s16le` / `pcm_l16` / `pcm_raw` only — the
 * recorder ships PCM s16le and the route forwards it to Sarvam as
 * `audio/wav`. Tests inject a fake recorder so the resampler isn't
 * exercised here (it has its own test file).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ReadableStream as NodeReadableStream,
  type ReadableStreamDefaultController as NodeReadableStreamDefaultController,
} from 'node:stream/web'
import {
  SarvamAdapter,
  drainSseEvents,
  type SarvamRecorderLike,
} from '@/lib/voice/sarvam-adapter'
import type { VoiceError } from '@/lib/voice/types'

// jsdom does not expose `ReadableStream`. Polyfill from Node's web
// streams so the adapter (which builds an upload `ReadableStream`)
// and the test helpers (which build a fake response body) both run.
if (typeof globalThis.ReadableStream === 'undefined') {
  ;(globalThis as unknown as { ReadableStream: typeof ReadableStream }).ReadableStream =
    NodeReadableStream as unknown as typeof ReadableStream
}

// --- Helpers --------------------------------------------------------------

interface FakeTrack {
  stop: ReturnType<typeof vi.fn>
}

function makeFakeStream(): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = [{ stop: vi.fn() }, { stop: vi.fn() }]
  const stream = {
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  } as unknown as MediaStream
  return { stream, tracks }
}

interface FakeRecorderHandle extends SarvamRecorderLike {
  emit: (chunk: Uint8Array) => void
  startCalls: number
  stopCalls: number
  startRejectsWith?: unknown
}

function makeFakeRecorder(): FakeRecorderHandle {
  let listener: ((c: Uint8Array) => void) | null = null
  const handle: FakeRecorderHandle = {
    onChunk(cb) {
      listener = cb
    },
    async start() {
      handle.startCalls++
      if (handle.startRejectsWith) {
        throw handle.startRejectsWith
      }
    },
    async stop() {
      handle.stopCalls++
    },
    emit(chunk) {
      listener?.(chunk)
    },
    startCalls: 0,
    stopCalls: 0,
  }
  return handle
}

/**
 * Build a `Response`-shaped object whose `body.getReader()` returns a
 * controllable reader that we can feed SSE chunks into. The test holds
 * the controller and pushes chunks at its own pace.
 */
function makeStreamingResponse(opts?: {
  status?: number
  ok?: boolean
}): {
  response: Response
  push: (text: string) => void
  end: () => void
  fail: (err: unknown) => void
} {
  let controller!: NodeReadableStreamDefaultController<Uint8Array>
  const stream = new NodeReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  const status = opts?.status ?? 200
  const ok = opts?.ok ?? true
  const response = {
    ok,
    status,
    body: stream,
    text: async () => '',
  } as unknown as Response
  const enc = new TextEncoder()
  return {
    response,
    push: (text) => controller.enqueue(enc.encode(text)),
    end: () => controller.close(),
    fail: (err) => controller.error(err),
  }
}

let originalAbortController: typeof AbortController

beforeEach(() => {
  originalAbortController = globalThis.AbortController
})

afterEach(() => {
  globalThis.AbortController = originalAbortController
  vi.restoreAllMocks()
})

// --- US-V.B.1 — constructor + capabilities --------------------------------

describe('SarvamAdapter — constructor (US-V.B.1)', () => {
  it('throws when language_code is missing', () => {
    expect(
      () => new SarvamAdapter({ language_code: '' as unknown as string }),
    ).toThrow(/language_code/)
  })

  it('throws when language_code is whitespace', () => {
    expect(() => new SarvamAdapter({ language_code: '   ' })).toThrow(/language_code/)
  })

  it('exposes capabilities { partials: true, vad: true }', () => {
    const a = new SarvamAdapter({ language_code: 'en-IN' })
    expect(a.capabilities).toEqual({ partials: true, vad: true })
  })
})

// --- US-V.B.2 — start() ---------------------------------------------------

describe('SarvamAdapter — start() (US-V.B.2)', () => {
  it('requests microphone via getUserMedia({ audio: true })', async () => {
    const { stream } = makeFakeStream()
    const getUserMediaImpl = vi.fn().mockResolvedValue(stream)
    const recorder = makeFakeRecorder()
    const { response } = makeStreamingResponse()
    const fetchImpl = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl,
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    expect(getUserMediaImpl).toHaveBeenCalledWith({ audio: true })
  })

  it('maps a NotAllowedError to permission-denied and emits onError', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    const getUserMediaImpl = vi.fn().mockRejectedValue(denied)
    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl,
      recorderFactory: () => makeFakeRecorder(),
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })
    const errors: VoiceError[] = []
    a.onError((e) => errors.push(e))
    await expect(a.start()).rejects.toMatchObject({ kind: 'permission-denied' })
    expect(errors).toEqual([
      expect.objectContaining({ kind: 'permission-denied' }),
    ])
  })

  it('maps a NotFoundError to unsupported', async () => {
    const missing = Object.assign(new Error('no mic'), { name: 'NotFoundError' })
    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockRejectedValue(missing),
      recorderFactory: () => makeFakeRecorder(),
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })
    await expect(a.start()).rejects.toMatchObject({ kind: 'unsupported' })
  })

  it('maps an AbortError to aborted', async () => {
    const aborted = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockRejectedValue(aborted),
      recorderFactory: () => makeFakeRecorder(),
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })
    await expect(a.start()).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('throws on double-start', async () => {
    const { stream } = makeFakeStream()
    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => makeFakeRecorder(),
      fetchImpl: vi
        .fn()
        .mockResolvedValue(makeStreamingResponse().response) as unknown as typeof fetch,
    })
    await a.start()
    await expect(a.start()).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('flows language_code through as ?lang=… on the upload URL', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const { response } = makeStreamingResponse()
    const fetchImpl = vi.fn().mockResolvedValue(response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'hi-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(String(url)).toBe('/api/transcribe?lang=hi-IN')
    expect((init as RequestInit).method).toBe('POST')
    // Body must be a stream (recorder pushes chunks into it). We can't
    // directly assert ReadableStream identity but we can check the
    // duplex flag was passed.
    expect((init as unknown as { duplex?: string }).duplex).toBe('half')
  })

  it('URL-encodes language_code in the lang param', async () => {
    const { stream } = makeFakeStream()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeStreamingResponse().response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN, fallback',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => makeFakeRecorder(),
      fetchImpl,
    })
    await a.start()
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe('/api/transcribe?lang=en-IN%2C%20fallback')
  })

  it('passes recorder chunks into the upload stream as POSTed bytes', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()

    // We need to read from the request body the adapter constructs.
    // Capture the body at fetch time so we can read it under test.
    let postedBody: ReadableStream<Uint8Array> | null = null
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      postedBody = (init?.body as ReadableStream<Uint8Array>) ?? null
      return makeStreamingResponse().response
    }) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()

    expect(postedBody).not.toBeNull()
    const reader = (postedBody as unknown as ReadableStream<Uint8Array>).getReader()
    const chunk = new Uint8Array([0x12, 0x34, 0x56, 0x78])
    recorder.emit(chunk)
    const first = await reader.read()
    expect(first.done).toBe(false)
    expect(first.value).toEqual(chunk)
  })
})

// --- US-V.B.3 — stop() resolves on `final` SSE ----------------------------

describe('SarvamAdapter — stop() final + partials (US-V.B.3)', () => {
  it('fires onPartial in order as `partial` events arrive', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    const partials: string[] = []
    a.onPartial((p) => partials.push(p))
    await a.start()

    ctrl.push('event: partial\ndata: {"text":"my pain"}\n\n')
    ctrl.push('event: partial\ndata: {"text":"my pain is a 7"}\n\n')
    // Yield to microtasks so the consumer loop drains.
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(partials).toEqual(['my pain', 'my pain is a 7'])
  })

  it('resolves stop() with the final transcript from the `final` event', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()

    // Fire the final after stop() begins waiting.
    setTimeout(() => {
      ctrl.push(
        'event: final\ndata: {"text":"my pain is a 7","durationMs":4200,"confidence":0.91}\n\n',
      )
      ctrl.end()
    }, 0)

    const t = await a.stop()
    expect(t).toEqual({
      text: 'my pain is a 7',
      durationMs: 4200,
      confidence: 0.91,
    })
  })

  it('rejects stop() with a typed VoiceError on `error` SSE event', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    const errors: VoiceError[] = []
    a.onError((e) => errors.push(e))
    await a.start()

    setTimeout(() => {
      ctrl.push(
        'event: error\ndata: {"kind":"network","message":"sarvam upstream 502"}\n\n',
      )
      ctrl.end()
    }, 0)

    await expect(a.stop()).rejects.toMatchObject({
      kind: 'network',
      message: 'sarvam upstream 502',
    })
    expect(errors).toEqual([
      expect.objectContaining({ kind: 'network', message: 'sarvam upstream 502' }),
    ])
  })

  it('treats stream-end-without-final as aborted', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    setTimeout(() => ctrl.end(), 0)
    await expect(a.stop()).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('rejects when stop() is called before start()', async () => {
    const a = new SarvamAdapter({ language_code: 'en-IN' })
    await expect(a.stop()).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('rejects when the upload returns a non-2xx HTTP status', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse({ ok: false, status: 502 })
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    await expect(a.stop()).rejects.toMatchObject({ kind: 'network' })
  })
})

// --- US-V.B.4 — cleanup ---------------------------------------------------

describe('SarvamAdapter — cleanup (US-V.B.4)', () => {
  it('stops every track on the MediaStream when stop() resolves', async () => {
    const { stream, tracks } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1000}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()
    for (const t of tracks) {
      expect(t.stop).toHaveBeenCalledTimes(1)
    }
    expect(recorder.stopCalls).toBe(1)
  })

  it('aborts the in-flight fetch via AbortController on abort()', async () => {
    const { stream, tracks } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()

    const captured: { signal: AbortSignal | null } = { signal: null }
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      captured.signal = (init?.signal as AbortSignal) ?? null
      return ctrl.response
    }) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    const errors: VoiceError[] = []
    a.onError((e) => errors.push(e))
    await a.start()
    a.abort('test abort')
    expect(captured.signal).not.toBeNull()
    expect(captured.signal?.aborted).toBe(true)
    // Mic released, recorder told to stop.
    expect(tracks[0].stop).toHaveBeenCalled()
    expect(recorder.stopCalls).toBeGreaterThanOrEqual(1)
    // onError fires with `aborted`.
    expect(errors[errors.length - 1]).toMatchObject({ kind: 'aborted' })
  })

  it('abort() makes a subsequent stop() reject with aborted', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    a.abort()
    await expect(a.stop()).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('releases mic tracks even when getUserMedia succeeds but recorder.start fails', async () => {
    const { stream, tracks } = makeFakeStream()
    const recorder = makeFakeRecorder()
    recorder.startRejectsWith = new Error('worklet boom')
    const fetchImpl = vi.fn() as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await expect(a.start()).rejects.toMatchObject({ kind: 'unsupported' })
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

// --- SSE parser exported helper ------------------------------------------

describe('drainSseEvents', () => {
  it('parses a single complete event', () => {
    const { events, remainder } = drainSseEvents(
      'event: partial\ndata: hello\n\n',
    )
    expect(events).toEqual([{ event: 'partial', data: 'hello' }])
    expect(remainder).toBe('')
  })

  it('returns the unfinished tail as the remainder', () => {
    const { events, remainder } = drainSseEvents(
      'event: partial\ndata: one\n\nevent: partial\ndata: tw',
    )
    expect(events).toEqual([{ event: 'partial', data: 'one' }])
    expect(remainder).toBe('event: partial\ndata: tw')
  })

  it('joins multi-line data fields with a newline', () => {
    const { events } = drainSseEvents('data: line a\ndata: line b\n\n')
    expect(events).toEqual([{ event: 'message', data: 'line a\nline b' }])
  })

  it('handles CRLF line endings', () => {
    const { events } = drainSseEvents('event: final\r\ndata: bye\r\n\r\n')
    expect(events).toEqual([{ event: 'final', data: 'bye' }])
  })

  it('skips comment lines starting with :', () => {
    const { events } = drainSseEvents(': keepalive\nevent: partial\ndata: x\n\n')
    expect(events).toEqual([{ event: 'partial', data: 'x' }])
  })
})
