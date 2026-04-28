import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getTtsProvider,
  getVoiceProvider,
  resolveTtsProviderName,
  resolveVoiceProviderName,
} from '@/lib/voice/provider'
import { WebSpeechAdapter } from '@/lib/voice/web-speech-adapter'
import { OpenAIRealtimeAdapter } from '@/lib/voice/openai-realtime-adapter'
import { SarvamAdapter } from '@/lib/voice/sarvam-adapter'
import { SarvamTtsAdapter } from '@/lib/voice/sarvam-tts-adapter'

describe('resolveVoiceProviderName', () => {
  it('defaults to web-speech when env is undefined', () => {
    expect(resolveVoiceProviderName(undefined)).toBe('web-speech')
  })

  it('defaults to web-speech on empty / typo values', () => {
    expect(resolveVoiceProviderName('')).toBe('web-speech')
    expect(resolveVoiceProviderName('whisper')).toBe('web-speech')
  })

  it('selects openai-realtime when explicitly set', () => {
    expect(resolveVoiceProviderName('openai-realtime')).toBe('openai-realtime')
  })

  it('selects web-speech when explicitly set', () => {
    expect(resolveVoiceProviderName('web-speech')).toBe('web-speech')
  })

  // Regression lock for commit 307dd0d: the resolver reads
  // `process.env.NEXT_PUBLIC_VOICE_PROVIDER` and `process.env.VOICE_PROVIDER`
  // via *literal* property access so Next.js / Turbopack actually inlines
  // the values into the browser bundle. A prior `process.env[name]` helper
  // returned undefined in the client and silently fell back to web-speech.
  describe('reads from process.env when no arg passed', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('selects sarvam when NEXT_PUBLIC_VOICE_PROVIDER=sarvam', () => {
      vi.stubEnv('NEXT_PUBLIC_VOICE_PROVIDER', 'sarvam')
      vi.stubEnv('VOICE_PROVIDER', '')
      expect(resolveVoiceProviderName()).toBe('sarvam')
    })

    it('falls back to bare VOICE_PROVIDER when NEXT_PUBLIC_VOICE_PROVIDER is empty', () => {
      vi.stubEnv('NEXT_PUBLIC_VOICE_PROVIDER', '')
      vi.stubEnv('VOICE_PROVIDER', 'sarvam')
      expect(resolveVoiceProviderName()).toBe('sarvam')
    })

    it('treats whitespace-only env values as unset', () => {
      vi.stubEnv('NEXT_PUBLIC_VOICE_PROVIDER', '   ')
      vi.stubEnv('VOICE_PROVIDER', '')
      expect(resolveVoiceProviderName()).toBe('web-speech')
    })
  })
})

describe('getVoiceProvider factory', () => {
  it('returns a WebSpeechAdapter by default', () => {
    const provider = getVoiceProvider('web-speech')
    expect(provider).toBeInstanceOf(WebSpeechAdapter)
    expect(provider.capabilities).toEqual({ partials: true, vad: false })
  })

  it('returns an OpenAIRealtimeAdapter when requested', () => {
    const provider = getVoiceProvider('openai-realtime')
    expect(provider).toBeInstanceOf(OpenAIRealtimeAdapter)
    expect(provider.capabilities).toEqual({ partials: true, vad: true })
  })

  it('stub adapter throws NotImplementedError on start()', async () => {
    const provider = getVoiceProvider('openai-realtime')
    await expect(provider.start()).rejects.toThrow(/NotImplementedError/)
  })

  it('returns fresh instances on each call (no singleton)', () => {
    const a = getVoiceProvider('web-speech')
    const b = getVoiceProvider('web-speech')
    expect(a).not.toBe(b)
  })

  it('returns a SarvamAdapter for sarvam (Wave 2: V.B wired)', () => {
    const provider = getVoiceProvider('sarvam')
    expect(provider).toBeInstanceOf(SarvamAdapter)
    expect(provider.capabilities).toEqual({ partials: true, vad: true })
  })
})

// ---- TTS resolver (added during voice C1 pre-flight, ADR-026) ----

describe('resolveTtsProviderName', () => {
  it('defaults to web-speech when env is undefined', () => {
    expect(resolveTtsProviderName(undefined)).toBe('web-speech')
  })

  it('defaults to web-speech on empty / typo values', () => {
    expect(resolveTtsProviderName('')).toBe('web-speech')
    expect(resolveTtsProviderName('whisper')).toBe('web-speech')
  })

  it('selects sarvam when explicitly set', () => {
    expect(resolveTtsProviderName('sarvam')).toBe('sarvam')
  })

  it('selects web-speech when explicitly set', () => {
    expect(resolveTtsProviderName('web-speech')).toBe('web-speech')
  })

  // Same regression-lock as the STT resolver — see comment above.
  describe('reads from process.env when no arg passed', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('selects sarvam when NEXT_PUBLIC_VOICE_TTS_PROVIDER=sarvam', () => {
      vi.stubEnv('NEXT_PUBLIC_VOICE_TTS_PROVIDER', 'sarvam')
      vi.stubEnv('VOICE_TTS_PROVIDER', '')
      expect(resolveTtsProviderName()).toBe('sarvam')
    })

    it('falls back to bare VOICE_TTS_PROVIDER when NEXT_PUBLIC_VOICE_TTS_PROVIDER is empty', () => {
      vi.stubEnv('NEXT_PUBLIC_VOICE_TTS_PROVIDER', '')
      vi.stubEnv('VOICE_TTS_PROVIDER', 'sarvam')
      expect(resolveTtsProviderName()).toBe('sarvam')
    })

    it('treats whitespace-only env values as unset', () => {
      vi.stubEnv('NEXT_PUBLIC_VOICE_TTS_PROVIDER', '   ')
      vi.stubEnv('VOICE_TTS_PROVIDER', '')
      expect(resolveTtsProviderName()).toBe('web-speech')
    })
  })
})

describe('getTtsProvider factory', () => {
  it('returns the Web Speech TTS adapter by default', () => {
    const tts = getTtsProvider('web-speech')
    expect(typeof tts.speak).toBe('function')
    expect(typeof tts.cancel).toBe('function')
    expect(typeof tts.isAvailable).toBe('function')
  })

  it('returns a SarvamTtsAdapter for sarvam (Wave 2: V.C wired)', () => {
    const tts = getTtsProvider('sarvam')
    expect(tts).toBeInstanceOf(SarvamTtsAdapter)
    expect(tts.isAvailable()).toBe(true)
  })

  it('returns fresh instances on each call (no singleton)', () => {
    const a = getTtsProvider('web-speech')
    const b = getTtsProvider('web-speech')
    expect(a).not.toBe(b)
  })
})
