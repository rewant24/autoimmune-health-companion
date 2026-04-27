/**
 * Provider factories — STT (`getVoiceProvider`) and TTS (`getTtsProvider`).
 *
 * Each reads its own env flag and returns the matching adapter. Defaults
 * are `web-speech` for both, so dev/test environments work without any
 * env file. Keep this file *thin* — it must not import adapter
 * implementations eagerly if we later need per-target tree-shaking. For
 * cycle 1 the adapters are small enough that direct imports are fine.
 *
 * Wave 2 (voice C1) wires the real `SarvamAdapter` (STT, V.B) and
 * `SarvamTtsAdapter` (TTS, V.C) into both `'sarvam'` branches. Both
 * default to `'en-IN'` for cycle 1; multilingual config will route
 * through here when F03+ adds language settings.
 *
 * Browser-side env note: `process.env.VOICE_PROVIDER` and
 * `VOICE_TTS_PROVIDER` are NOT inlined into the client bundle (Next.js
 * only inlines `NEXT_PUBLIC_*`), so the resolver effectively reads them
 * server-side only. For client-side selection we also accept the
 * `NEXT_PUBLIC_*` variants so dev / preview can toggle providers
 * without code edits. `SARVAM_API_KEY` MUST stay non-public — the
 * routes (`/api/transcribe`, `/api/speak`) read it server-side.
 */

import { WebSpeechAdapter } from './web-speech-adapter'
import { OpenAIRealtimeAdapter } from './openai-realtime-adapter'
import { SarvamAdapter } from './sarvam-adapter'
import { SarvamTtsAdapter } from './sarvam-tts-adapter'
import { createTtsAdapter } from './web-speech-tts-adapter'
import type {
  TtsProvider,
  TtsProviderName,
  VoiceProvider,
  VoiceProviderName,
} from './types'

/** Default language code for cycle 1 — Indian English. */
const DEFAULT_LANGUAGE_CODE = 'en-IN'

// IMPORTANT: Next.js / Turbopack only inline `process.env.FOO` when the
// property is accessed with the literal name as a static identifier.
// Dynamic access via `process.env[varName]` (or any computed property)
// is NOT replaced and resolves to `undefined` in the browser bundle,
// because `process.env` ships empty on the client. So we must spell each
// `NEXT_PUBLIC_*` variable out by hand below — do NOT refactor back into
// a `readEnv(name)` helper.
function safeEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// --- STT ------------------------------------------------------------------

/**
 * Read the configured STT provider name from env. Exposed for tests so
 * they can assert factory selection without mutating `process.env`.
 *
 * Recognised: `web-speech`, `openai-realtime`, `sarvam`. Anything else
 * (missing, typo, empty string) falls back to `web-speech`.
 */
export function resolveVoiceProviderName(
  raw: string | undefined = safeEnv(process.env.NEXT_PUBLIC_VOICE_PROVIDER) ??
    safeEnv(process.env.VOICE_PROVIDER),
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
      return new SarvamAdapter({ language_code: DEFAULT_LANGUAGE_CODE })
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
  raw: string | undefined = safeEnv(
    process.env.NEXT_PUBLIC_VOICE_TTS_PROVIDER,
  ) ?? safeEnv(process.env.VOICE_TTS_PROVIDER),
): TtsProviderName {
  if (raw === 'sarvam') return 'sarvam'
  return 'web-speech'
}

/**
 * TTS factory. Returns a fresh adapter instance per call.
 */
export function getTtsProvider(
  name: TtsProviderName = resolveTtsProviderName(),
): TtsProvider {
  switch (name) {
    case 'sarvam':
      return new SarvamTtsAdapter({ language_code: DEFAULT_LANGUAGE_CODE })
    case 'web-speech':
    default:
      return createTtsAdapter()
  }
}
