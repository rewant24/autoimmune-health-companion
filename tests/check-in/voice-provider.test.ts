import { describe, it, expect } from 'vitest'
import {
  getVoiceProvider,
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
  })

  it('returns fresh instances on each call (no singleton)', () => {
    const a = getVoiceProvider('web-speech')
    const b = getVoiceProvider('web-speech')
    expect(a).not.toBe(b)
  })
})
