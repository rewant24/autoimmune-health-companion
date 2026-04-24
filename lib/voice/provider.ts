/**
 * Provider factory. Reads `process.env.VOICE_PROVIDER` and returns the
 * matching adapter. Default is `web-speech`.
 *
 * Keep this file *thin* — it must not import adapter implementations
 * eagerly if we later need tree-shaking per target. For Cycle 1, direct
 * imports are fine because both adapters are tiny.
 */

import { WebSpeechAdapter } from './web-speech-adapter'
import { OpenAIRealtimeAdapter } from './openai-realtime-adapter'
import type { VoiceProvider, VoiceProviderName } from './types'

/**
 * Read the configured provider name from env. Exposed for tests so they can
 * assert factory selection without relying on mutating `process.env`.
 *
 * Recognised values: `web-speech`, `openai-realtime`. Anything else (missing,
 * typo, empty string) falls back to `web-speech`.
 */
export function resolveVoiceProviderName(
  raw: string | undefined = typeof process !== 'undefined'
    ? process.env.VOICE_PROVIDER
    : undefined,
): VoiceProviderName {
  if (raw === 'openai-realtime') return 'openai-realtime'
  return 'web-speech'
}

/**
 * Factory. Returns a fresh adapter instance per call (adapters hold event
 * subscribers and a live recognition handle, so they must not be singletons).
 */
export function getVoiceProvider(
  name: VoiceProviderName = resolveVoiceProviderName(),
): VoiceProvider {
  switch (name) {
    case 'openai-realtime':
      return new OpenAIRealtimeAdapter()
    case 'web-speech':
    default:
      return new WebSpeechAdapter()
  }
}
