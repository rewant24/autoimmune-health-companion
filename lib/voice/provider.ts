/**
 * Provider factories — STT (`getVoiceProvider`) and TTS (`getTtsProvider`).
 *
 * Each reads its own env flag and returns the matching adapter. Defaults
 * are `web-speech` for both, so dev/test environments work without any
 * env file. Keep this file *thin* — it must not import adapter
 * implementations eagerly if we later need per-target tree-shaking. For
 * cycle 1 the adapters are small enough that direct imports are fine.
 *
 * Sarvam adapters land in V.B (STT) and V.C (TTS); the resolver branches
 * for `'sarvam'` are NotImplementedError placeholders during pre-flight
 * so tests can assert the resolver shape before the adapters exist.
 */

import { WebSpeechAdapter } from './web-speech-adapter'
import { OpenAIRealtimeAdapter } from './openai-realtime-adapter'
import { createTtsAdapter } from './web-speech-tts-adapter'
import type {
  TtsProvider,
  TtsProviderName,
  VoiceProvider,
  VoiceProviderName,
} from './types'

// --- STT ------------------------------------------------------------------

/**
 * Read the configured STT provider name from env. Exposed for tests so
 * they can assert factory selection without mutating `process.env`.
 *
 * Recognised: `web-speech`, `openai-realtime`, `sarvam`. Anything else
 * (missing, typo, empty string) falls back to `web-speech`.
 */
export function resolveVoiceProviderName(
  raw: string | undefined = typeof process !== 'undefined'
    ? process.env.VOICE_PROVIDER
    : undefined,
): VoiceProviderName {
  if (raw === 'openai-realtime') return 'openai-realtime'
  if (raw === 'sarvam') return 'sarvam'
  return 'web-speech'
}

/**
 * STT factory. Returns a fresh adapter instance per call (adapters hold
 * event subscribers and a live recognition handle, so they must not be
 * singletons).
 */
export function getVoiceProvider(
  name: VoiceProviderName = resolveVoiceProviderName(),
): VoiceProvider {
  switch (name) {
    case 'openai-realtime':
      return new OpenAIRealtimeAdapter()
    case 'sarvam':
      throw new Error('NotImplementedError: Sarvam STT — pending V.B')
    case 'web-speech':
    default:
      return new WebSpeechAdapter()
  }
}

// --- TTS ------------------------------------------------------------------

/**
 * Read the configured TTS provider name from env. Recognised: `web-speech`,
 * `sarvam`. Anything else falls back to `web-speech`.
 */
export function resolveTtsProviderName(
  raw: string | undefined = typeof process !== 'undefined'
    ? process.env.VOICE_TTS_PROVIDER
    : undefined,
): TtsProviderName {
  if (raw === 'sarvam') return 'sarvam'
  return 'web-speech'
}

/**
 * TTS factory. Returns a fresh adapter instance per call. The Sarvam
 * branch is a placeholder during pre-flight; V.C replaces it with the
 * real `SarvamTtsAdapter`.
 */
export function getTtsProvider(
  name: TtsProviderName = resolveTtsProviderName(),
): TtsProvider {
  switch (name) {
    case 'sarvam':
      throw new Error('NotImplementedError: Sarvam TTS — pending V.C')
    case 'web-speech':
    default:
      return createTtsAdapter()
  }
}
