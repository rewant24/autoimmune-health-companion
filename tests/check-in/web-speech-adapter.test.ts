import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  WebSpeechAdapter,
  mapNativeError,
} from '@/lib/voice/web-speech-adapter'
import type { VoiceError } from '@/lib/voice/types'

// --- Fake SpeechRecognition -----------------------------------------------

interface FakeAlt {
  transcript: string
  confidence: number
}
interface FakeResult {
  isFinal: boolean
  length: number
  [index: number]: FakeAlt
}

class FakeSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onresult: ((ev: unknown) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  onend: ((ev: unknown) => void) | null = null
  onstart: ((ev: unknown) => void) | null = null

  started = false
  stopped = false

  start(): void {
    this.started = true
    this.onstart?.(new Event('start'))
  }
  stop(): void {
    this.stopped = true
  }
  abort(): void {
    this.stopped = true
  }

  // Test helpers -----------------------------------------------------------

  /** Dispatch a `result` event with given alternatives. */
  emitResult(resultIndex: number, results: FakeResult[]): void {
    const list = Object.assign([...results], { length: results.length })
    this.onresult?.({ resultIndex, results: list })
  }

  emitError(error: string, message?: string): void {
    this.onerror?.({ error, message })
  }

  emitEnd(): void {
    this.onend?.(new Event('end'))
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true
  }
}

function installFake(): FakeSpeechRecognition {
  const held: { instance: FakeSpeechRecognition | null } = { instance: null }
  class Ctor extends FakeSpeechRecognition {
    constructor() {
      super()
      held.instance = this
    }
  }
  ;(globalThis as unknown as { SpeechRecognition?: unknown }).SpeechRecognition =
    Ctor
  return new Proxy({} as FakeSpeechRecognition, {
    get(_t, prop) {
      if (!held.instance) throw new Error('Fake not yet instantiated')
      return Reflect.get(held.instance as object, prop)
    },
  })
}

function clearGlobals(): void {
  const g = globalThis as unknown as Record<string, unknown>
  delete g.SpeechRecognition
  delete g.webkitSpeechRecognition
}

// --- Tests -----------------------------------------------------------------

describe('mapNativeError', () => {
  it('maps not-allowed to permission-denied', () => {
    expect(mapNativeError('not-allowed')).toBe('permission-denied')
    expect(mapNativeError('service-not-allowed')).toBe('permission-denied')
    expect(mapNativeError('audio-capture')).toBe('permission-denied')
  })

  it('maps no-speech, network, aborted to their own kinds', () => {
    expect(mapNativeError('no-speech')).toBe('no-speech')
    expect(mapNativeError('network')).toBe('network')
    expect(mapNativeError('aborted')).toBe('aborted')
  })

  it('falls back to aborted for unknown native errors', () => {
    expect(mapNativeError('badgrammar')).toBe('aborted')
    expect(mapNativeError('')).toBe('aborted')
  })
})

describe('WebSpeechAdapter — unsupported environment', () => {
  beforeEach(() => clearGlobals())
  afterEach(() => clearGlobals())

  it('start() rejects with kind "unsupported" when no SpeechRecognition exists', async () => {
    const adapter = new WebSpeechAdapter()
    const errors: VoiceError[] = []
    adapter.onError((e) => errors.push(e))
    await expect(adapter.start()).rejects.toMatchObject({ kind: 'unsupported' })
    expect(errors[0]?.kind).toBe('unsupported')
  })
})

describe('WebSpeechAdapter — happy path', () => {
  let handle: FakeSpeechRecognition
  beforeEach(() => {
    clearGlobals()
    handle = installFake()
  })
  afterEach(() => clearGlobals())

  it('configures locale en-IN with continuous + interim results', async () => {
    const adapter = new WebSpeechAdapter()
    await adapter.start()
    expect(handle.lang).toBe('en-IN')
    expect(handle.continuous).toBe(true)
    expect(handle.interimResults).toBe(true)
    expect(handle.started).toBe(true)
  })

  it('emits partials with interim transcript text', async () => {
    const adapter = new WebSpeechAdapter()
    const partials: string[] = []
    adapter.onPartial((p) => partials.push(p))
    await adapter.start()

    handle.emitResult(0, [
      { isFinal: false, length: 1, 0: { transcript: 'hello', confidence: 0.8 } },
    ])
    handle.emitResult(0, [
      {
        isFinal: false,
        length: 1,
        0: { transcript: 'hello world', confidence: 0.9 },
      },
    ])

    expect(partials).toEqual(['hello', 'hello world'])
  })

  it('stop() resolves with final transcript, duration, and confidence', async () => {
    const adapter = new WebSpeechAdapter()
    await adapter.start()
    // Simulate elapsed time.
    vi.useFakeTimers()
    try {
      handle.emitResult(0, [
        {
          isFinal: true,
          length: 1,
          0: { transcript: 'my pain is about a five', confidence: 0.92 },
        },
      ])
      const stopPromise = adapter.stop()
      vi.advanceTimersByTime(1500)
      handle.emitEnd()
      const t = await stopPromise
      expect(t.text).toBe('my pain is about a five')
      expect(t.confidence).toBeCloseTo(0.92)
      expect(t.durationMs).toBeGreaterThanOrEqual(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stop() before start() rejects with aborted', async () => {
    const adapter = new WebSpeechAdapter()
    await expect(adapter.stop()).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('R3-3: start() while already active rejects with aborted', async () => {
    const adapter = new WebSpeechAdapter()
    const errors: VoiceError[] = []
    adapter.onError((e) => errors.push(e))
    await adapter.start()
    await expect(adapter.start()).rejects.toMatchObject({ kind: 'aborted' })
    expect(errors[0]?.kind).toBe('aborted')
  })

  it('R3-10: listeners are cleared after session ends (no stale callbacks)', async () => {
    const adapter = new WebSpeechAdapter()
    const partials: string[] = []
    adapter.onPartial((p) => partials.push(p))
    await adapter.start()

    // Simulate clean session end via stop() + end.
    const stopPromise = adapter.stop()
    handle.emitEnd()
    await stopPromise

    // Start a new session on the same adapter. The previously registered
    // onPartial listener should NOT fire for the new session — it belonged
    // to the ended session.
    const fresh = installFake()
    await adapter.start()
    fresh.emitResult(0, [
      { isFinal: false, length: 1, 0: { transcript: 'leaked', confidence: 0.5 } },
    ])
    expect(partials).toEqual([])
  })
})

describe('WebSpeechAdapter — error mapping', () => {
  let handle: FakeSpeechRecognition
  beforeEach(() => {
    clearGlobals()
    handle = installFake()
  })
  afterEach(() => clearGlobals())

  it('emits permission-denied on not-allowed', async () => {
    const adapter = new WebSpeechAdapter()
    const errors: VoiceError[] = []
    adapter.onError((e) => errors.push(e))
    await adapter.start()
    handle.emitError('not-allowed')
    expect(errors[0]?.kind).toBe('permission-denied')
  })

  it('emits no-speech on no-speech native event', async () => {
    const adapter = new WebSpeechAdapter()
    const errors: VoiceError[] = []
    adapter.onError((e) => errors.push(e))
    await adapter.start()
    handle.emitError('no-speech')
    expect(errors[0]?.kind).toBe('no-speech')
  })

  it('emits network on network native event', async () => {
    const adapter = new WebSpeechAdapter()
    const errors: VoiceError[] = []
    adapter.onError((e) => errors.push(e))
    await adapter.start()
    handle.emitError('network')
    expect(errors[0]?.kind).toBe('network')
  })

  it('emits aborted and rejects pending stop() on error', async () => {
    const adapter = new WebSpeechAdapter()
    const errors: VoiceError[] = []
    adapter.onError((e) => errors.push(e))
    await adapter.start()
    const pending = adapter.stop()
    handle.emitError('aborted')
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' })
    expect(errors[0]?.kind).toBe('aborted')
  })
})
