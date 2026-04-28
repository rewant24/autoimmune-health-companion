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
  fireSilence: () => void
  startCalls: number
  stopCalls: number
  startRejectsWith?: unknown
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
    fireSilence() {
      silenceListener?.()
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
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn().mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'hi-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    // Buffered-upload contract: fetch only fires from stop(), not start().
    expect(fetchImpl).not.toHaveBeenCalled()
    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1000}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(String(url)).toBe('/api/transcribe?lang=hi-IN')
    expect((init as RequestInit).method).toBe('POST')
  })

  it('URL-encodes language_code in the lang param', async () => {
    const { stream } = makeFakeStream()
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn().mockResolvedValue(ctrl.response) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN, fallback',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => makeFakeRecorder(),
      fetchImpl,
    })
    await a.start()
    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1000}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe('/api/transcribe?lang=en-IN%2C%20fallback')
  })

  it('POSTs the concatenated PCM chunks as the request body on stop()', async () => {
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()

    let postedBody: BodyInit | null = null
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      postedBody = (init?.body as BodyInit) ?? null
      return ctrl.response
    }) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()

    // Emit two chunks while recording — they should be buffered then
    // flushed as a single concatenated body when stop() POSTs.
    const a1 = new Uint8Array([0x12, 0x34, 0x56, 0x78])
    const a2 = new Uint8Array([0x9a, 0xbc, 0xde, 0xf0])
    recorder.emit(a1)
    recorder.emit(a2)

    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1000}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()

    expect(postedBody).not.toBeNull()
    expect(postedBody).toBeInstanceOf(Uint8Array)
    const body = postedBody as unknown as Uint8Array
    // Body is now {44-byte WAV header}{concatenated PCM}. Header
    // contents are asserted in their own dedicated test below; here
    // we just verify the PCM payload is concatenated in order at the
    // expected offset.
    expect(body.byteLength).toBe(44 + 8)
    expect(Array.from(body.slice(44))).toEqual([
      0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
    ])
  })

  it('prepends a 44-byte RIFF/WAVE header to buffered PCM in stop() (Bug 1 Option B)', async () => {
    // Bug 1 Option B (HAR 2026-04-28): Sarvam's pcm_s16le codec is
    // type-accepted but silently fails to decode raw PCM. We keep
    // input_audio_codec='wav' and prepend a real WAV header so the
    // bytes ARE a valid WAV file end-to-end.
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()

    let postedBody: BodyInit | null = null
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      postedBody = (init?.body as BodyInit) ?? null
      return ctrl.response
    }) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    // 4 bytes of fake PCM s16le.
    recorder.emit(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]))
    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1000}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()

    expect(postedBody).toBeInstanceOf(Uint8Array)
    const body = postedBody as unknown as Uint8Array
    // 44-byte header + 4 PCM bytes
    expect(body.byteLength).toBe(44 + 4)
    // RIFF magic at offset 0, WAVE at offset 8
    expect(String.fromCharCode(...body.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...body.slice(8, 12))).toBe('WAVE')
    // data sub-chunk length field at offset 40 = pcmByteLength
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
    expect(view.getUint32(40, true)).toBe(4)
    // PCM bytes follow at offset 44
    expect(Array.from(body.slice(44))).toEqual([0xaa, 0xbb, 0xcc, 0xdd])
  })

  it('POSTs with Content-Type audio/wav in buffered mode', async () => {
    // Bug 1 retry (HAR 2026-04-28): pivoted from audio/pcm back to
    // audio/wav after Sarvam silently failed to decode raw PCM. The
    // adapter now prepends a real RIFF/WAVE header so the body is a
    // valid WAV file; see "prepends a WAV header" test below.
    const { stream } = makeFakeStream()
    const recorder = makeFakeRecorder()

    let postedHeaders: HeadersInit | undefined
    const ctrl = makeStreamingResponse()
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      postedHeaders = init?.headers
      return ctrl.response
    }) as unknown as typeof fetch

    const a = new SarvamAdapter({
      language_code: 'en-IN',
      getUserMediaImpl: vi.fn().mockResolvedValue(stream),
      recorderFactory: () => recorder,
      fetchImpl,
    })
    await a.start()
    recorder.emit(new Uint8Array([0x00, 0x01, 0x00, 0x01]))
    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1000}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()

    expect(postedHeaders).toBeDefined()
    const headers = postedHeaders as Record<string, string>
    expect(headers['Content-Type']).toBe('audio/wav')
  })

  it('forwards onSilence to listeners in buffered mode — Fix F.1', async () => {
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
    const silenceCb = vi.fn()
    a.onSilence(silenceCb)
    await a.start()

    recorder.fireSilence()
    expect(silenceCb).toHaveBeenCalledTimes(1)
    // Adapter must NOT auto-stop the recorder — hook owns stop policy.
    expect(recorder.stopCalls).toBe(0)
    // No fetch yet either — buffered mode only POSTs from stop().
    expect(fetchImpl).not.toHaveBeenCalled()

    // Second silence on the same turn is swallowed by silenceFired.
    recorder.fireSilence()
    expect(silenceCb).toHaveBeenCalledTimes(1)
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

    // Buffered upload: the SSE response is only opened by stop(), so
    // partials arrive in the response body that the route streams back
    // (response streaming works on HTTP/1.1; only request streaming
    // requires HTTP/2). Push the partials, then a final, then end.
    setTimeout(() => {
      ctrl.push('event: partial\ndata: {"text":"my pain"}\n\n')
      ctrl.push('event: partial\ndata: {"text":"my pain is a 7"}\n\n')
      ctrl.push(
        'event: final\ndata: {"text":"my pain is a 7","durationMs":1000}\n\n',
      )
      ctrl.end()
    }, 0)
    await a.stop()
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

  it('Fix F.2: concurrent stop() calls share one POST and resolve to the same transcript', async () => {
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

    // Push the SSE final asynchronously so both stop() calls land
    // before the response resolves.
    setTimeout(() => {
      ctrl.push(
        'event: final\ndata: {"text":"shared","durationMs":1234}\n\n',
      )
      ctrl.end()
    }, 0)

    const a1 = a.stop()
    const a2 = a.stop()
    const [t1, t2] = await Promise.all([a1, a2])
    expect(t1).toEqual(t2)
    expect(t1.text).toBe('shared')
    // The reentrancy guard means exactly one POST is fired.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('Fix F.2: serial stop() after first resolves throws (preserves !started guard)', async () => {
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
    setTimeout(() => {
      ctrl.push('event: final\ndata: {"text":"hi","durationMs":1}\n\n')
      ctrl.end()
    }, 0)
    await a.stop()

    // resetTurnState fired; a fresh stop() now hits the !started guard.
    await expect(a.stop()).rejects.toMatchObject({
      kind: 'aborted',
      message: 'SarvamAdapter.stop: stop() called before start()',
    })
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
    // Buffered-upload contract: fetch only fires from stop(). Kick stop
    // (don't await), then abort once the fetch is in flight.
    const stopPromise = a.stop().catch(() => undefined)
    // Yield so the fetch is scheduled before abort runs.
    await new Promise<void>((r) => setTimeout(r, 0))
    a.abort('test abort')
    await stopPromise
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
