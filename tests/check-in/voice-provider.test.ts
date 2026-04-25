import { describe, it, expect } from 'vitest'
import {
  getTtsProvider,
  getVoiceProvider,
  resolveTtsProviderName,
  resolveVoiceProviderName,
} from '@/lib/voice/provider'
import { WebSpeechAdapter } from '@/lib/voice/web-speech-adapter'
import { OpenAIRealtimeAdapter } from '@/lib/voice/openai-realtime-adapter'

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

  it('throws NotImplementedError for sarvam STT (pending V.B)', () => {
    expect(() => getVoiceProvider('sarvam')).toThrow(/Sarvam STT/)
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
})

describe('getTtsProvider factory', () => {
  it('returns the Web Speech TTS adapter by default', () => {
    const tts = getTtsProvider('web-speech')
    expect(typeof tts.speak).toBe('function')
    expect(typeof tts.cancel).toBe('function')
    expect(typeof tts.isAvailable).toBe('function')
  })

  it('throws NotImplementedError for sarvam TTS (pending V.C)', () => {
    expect(() => getTtsProvider('sarvam')).toThrow(/Sarvam TTS/)
  })

  it('returns fresh instances on each call (no singleton)', () => {
    const a = getTtsProvider('web-speech')
    const b = getTtsProvider('web-speech')
    expect(a).not.toBe(b)
  })
})
