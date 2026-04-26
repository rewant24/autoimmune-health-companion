/**
 * Tests for `lib/voice/web-speech-tts-adapter.ts` (Feature 01, Cycle 2,
 * Chunk 2.E). File was originally `tts-adapter.ts`; renamed during voice
 * C1 pre-flight (ADR-026), and the re-export shim was deleted in Wave 2.
 *
 * Stories:
 *   TTS.US-1.H.1 — Web Speech `speechSynthesis` adapter exposing
 *     `isAvailable()`, `speak(text, opts)` (Promise resolves on `end`,
 *     rejects on `error`), `cancel()`, with cached voice list and
 *     en-IN > any-en > default voice preference.
 *
 * The adapter is the only Web-Speech-aware code in 2.E (ADR-018 locks
 * voice to Web Speech). Tests install a controlled fake on
 * `globalThis.speechSynthesis` so we can drive `end`/`error` events
 * deterministically without touching the real browser API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTtsAdapter,
  isTtsAvailable,
  resetVoiceCacheForTests,
} from '@/lib/voice/web-speech-tts-adapter'

// --- Fake `SpeechSynthesisUtterance` --------------------------------------

interface FakeUtteranceLike {
  text: string
  rate: number
  pitch: number
  voice: SpeechSynthesisVoice | null
  onend: ((ev: Event) => void) | null
  onerror: ((ev: Event) => void) | null
}

class FakeUtterance implements FakeUtteranceLike {
  rate = 1
  pitch = 1
  voice: SpeechSynthesisVoice | null = null
  onend: ((ev: Event) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  constructor(public text: string) {}
}

// --- Fake `speechSynthesis` -----------------------------------------------

class FakeSpeechSynthesis {
  speakCalls: FakeUtteranceLike[] = []
  cancelCalls = 0
  voices: SpeechSynthesisVoice[] = []

  speak(u: FakeUtteranceLike): void {
    this.speakCalls.push(u)
  }

  cancel(): void {
    this.cancelCalls += 1
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices
  }

  // Test helpers --------------------------------------------------------

  fireEnd(index = this.speakCalls.length - 1): void {
    const u = this.speakCalls[index]
    u?.onend?.(new Event('end'))
  }

  fireError(index = this.speakCalls.length - 1): void {
    const u = this.speakCalls[index]
    u?.onerror?.(new Event('error'))
  }
}

function makeVoice(
  name: string,
  lang: string,
  isDefault = false,
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    default: isDefault,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice
}

function installFakeSynthesis(
  voices: SpeechSynthesisVoice[] = [],
): FakeSpeechSynthesis {
  const fake = new FakeSpeechSynthesis()
  fake.voices = voices
  ;(globalThis as unknown as { speechSynthesis: FakeSpeechSynthesis }).speechSynthesis =
    fake
  ;(globalThis as unknown as {
    SpeechSynthesisUtterance: typeof FakeUtterance
  }).SpeechSynthesisUtterance = FakeUtterance
  return fake
}

function clearSynthesis(): void {
  const g = globalThis as unknown as Record<string, unknown>
  delete g.speechSynthesis
  delete g.SpeechSynthesisUtterance
}

// --- Tests -----------------------------------------------------------------

describe('isTtsAvailable', () => {
  beforeEach(() => {
    clearSynthesis()
    resetVoiceCacheForTests()
  })
  afterEach(() => clearSynthesis())

  it('returns false when speechSynthesis is missing', () => {
    expect(isTtsAvailable()).toBe(false)
  })

  it('returns true when speechSynthesis is present', () => {
    installFakeSynthesis()
    expect(isTtsAvailable()).toBe(true)
  })
})

describe('createTtsAdapter — speak()', () => {
  let fake: FakeSpeechSynthesis

  beforeEach(() => {
    clearSynthesis()
    resetVoiceCacheForTests()
    fake = installFakeSynthesis([
      makeVoice('Default', 'en-US', true),
      makeVoice('Indian English', 'en-IN'),
      makeVoice('British', 'en-GB'),
      makeVoice('Hindi', 'hi-IN'),
    ])
  })
  afterEach(() => clearSynthesis())

  it('queues an utterance via speechSynthesis.speak', async () => {
    const tts = createTtsAdapter()
    const promise = tts.speak('hello')
    expect(fake.speakCalls).toHaveLength(1)
    expect(fake.speakCalls[0]?.text).toBe('hello')
    fake.fireEnd()
    await expect(promise).resolves.toBeUndefined()
  })

  it('resolves the returned promise on the utterance end event', async () => {
    const tts = createTtsAdapter()
    const promise = tts.speak('done soon')
    let resolved = false
    void promise.then(() => {
      resolved = true
    })
    expect(resolved).toBe(false)
    fake.fireEnd()
    await promise
    expect(resolved).toBe(true)
  })

  it('rejects on the utterance error event', async () => {
    const tts = createTtsAdapter()
    const promise = tts.speak('boom')
    fake.fireError()
    await expect(promise).rejects.toBeInstanceOf(Error)
  })

  it('applies rate and pitch options to the utterance', async () => {
    const tts = createTtsAdapter()
    const promise = tts.speak('configured', { rate: 0.9, pitch: 1.1 })
    expect(fake.speakCalls[0]?.rate).toBeCloseTo(0.9)
    expect(fake.speakCalls[0]?.pitch).toBeCloseTo(1.1)
    fake.fireEnd()
    await promise
  })

  it('prefers an en-IN voice when available', async () => {
    const tts = createTtsAdapter()
    const promise = tts.speak('namaste')
    expect(fake.speakCalls[0]?.voice?.lang).toBe('en-IN')
    fake.fireEnd()
    await promise
  })

  it('falls back to any English voice when en-IN is missing', async () => {
    clearSynthesis()
    resetVoiceCacheForTests()
    fake = installFakeSynthesis([
      makeVoice('Default', 'fr-FR', true),
      makeVoice('British', 'en-GB'),
    ])
    const tts = createTtsAdapter()
    const promise = tts.speak('hello')
    expect(fake.speakCalls[0]?.voice?.lang).toBe('en-GB')
    fake.fireEnd()
    await promise
  })

  it('falls back to no explicit voice when no English voice exists', async () => {
    clearSynthesis()
    resetVoiceCacheForTests()
    fake = installFakeSynthesis([makeVoice('Hindi', 'hi-IN', true)])
    const tts = createTtsAdapter()
    const promise = tts.speak('hello')
    expect(fake.speakCalls[0]?.voice).toBeNull()
    fake.fireEnd()
    await promise
  })

  it('caches the voice list across calls (only one getVoices call)', async () => {
    const spy = vi.spyOn(fake, 'getVoices')
    const tts = createTtsAdapter()
    const p1 = tts.speak('one')
    fake.fireEnd()
    await p1
    const p2 = tts.speak('two')
    fake.fireEnd()
    await p2
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('resolves immediately when speechSynthesis is unavailable', async () => {
    clearSynthesis()
    resetVoiceCacheForTests()
    const tts = createTtsAdapter()
    await expect(tts.speak('silent')).resolves.toBeUndefined()
  })
})

describe('createTtsAdapter — cancel()', () => {
  let fake: FakeSpeechSynthesis

  beforeEach(() => {
    clearSynthesis()
    resetVoiceCacheForTests()
    fake = installFakeSynthesis()
  })
  afterEach(() => clearSynthesis())

  it('calls speechSynthesis.cancel()', () => {
    const tts = createTtsAdapter()
    tts.cancel()
    expect(fake.cancelCalls).toBe(1)
  })

  it('is a no-op when speechSynthesis is unavailable', () => {
    clearSynthesis()
    const tts = createTtsAdapter()
    expect(() => tts.cancel()).not.toThrow()
  })
})
