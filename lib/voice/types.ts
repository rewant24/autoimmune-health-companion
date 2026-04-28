/**
 * Voice capture type contracts (Feature 01, Chunk 1.A).
 *
 * These types are the boundary between the check-in UI and voice providers
 * (Web Speech, OpenAI Realtime). The UI must never import adapter-specific
 * types — only what lives in this file.
 */

/**
 * Final result of a voice capture session, returned from `VoiceProvider.stop()`.
 *
 * `confidence` is optional because Web Speech exposes a per-result number
 * but Realtime may not surface one.
 */
export interface Transcript {
  text: string
  durationMs: number
  confidence?: number
}

/**
 * Kinds of voice errors the UI needs to distinguish.
 *
 * - `permission-denied`: user blocked the mic, or browser policy did.
 * - `no-speech`: provider started but heard nothing (timeout / silence).
 * - `network`: transient network issue (relevant for cloud providers).
 * - `unsupported`: provider cannot run in this environment (e.g., no
 *   SpeechRecognition on this browser).
 * - `aborted`: session ended before a final result (programmatic stop, tab
 *   hidden, navigation).
 */
export type VoiceErrorKind =
  | 'permission-denied'
  | 'no-speech'
  | 'network'
  | 'unsupported'
  | 'aborted'

export interface VoiceError {
  kind: VoiceErrorKind
  message?: string
}

/**
 * Declarative capability flags. The UI uses these to decide whether to show
 * live partial transcripts, rely on server-side VAD, etc.
 */
export interface VoiceCapabilities {
  partials: boolean
  vad: boolean
}

/**
 * The single interface both adapters implement. Lifecycle:
 *
 *   const p = getVoiceProvider()
 *   p.onPartial(text => ...)
 *   p.onError(err => ...)
 *   await p.start()          // may reject with VoiceError-shaped reason
 *   const transcript = await p.stop()
 */
export interface VoiceProvider {
  start(): Promise<void>
  stop(): Promise<Transcript>
  onPartial(cb: (partial: string) => void): void
  onError(cb: (err: VoiceError) => void): void
  /**
   * Optional. Adapter fires this when its source detects trailing
   * silence after speech (Sarvam: 6 chunks at <0.01 RMS after first
   * crossing 0.02 — ≈1.5s). The hook subscribes and calls `stop()` so
   * the reducer transitions via the same `PROVIDER_STOPPED` path as a
   * manual tap. Adapters without VAD (web-speech) omit this. Fix F.1.
   */
  onSilence?(cb: () => void): void
  capabilities: VoiceCapabilities
}

/**
 * Env flag values recognised by the provider factory.
 */
export type VoiceProviderName = 'web-speech' | 'openai-realtime' | 'sarvam'

// --- TTS ------------------------------------------------------------------

/**
 * Per-call options for `TtsProvider.speak()`. Adapters interpret these as
 * best-effort hints — providers may ignore values they cannot honour.
 *
 * `voice` is intentionally `unknown` at the interface boundary because the
 * concrete shape differs by adapter (Web Speech: `SpeechSynthesisVoice`;
 * Sarvam: a string speaker name). The UI does not pick voices in cycle 1.
 */
export interface TtsSpeakOptions {
  rate?: number
  pitch?: number
  voice?: unknown
}

/**
 * The TTS contract. Both Web Speech (browser `speechSynthesis`) and Sarvam
 * (server-proxied audio stream) implement this.
 *
 *   const t = getTtsProvider()
 *   if (t.isAvailable()) await t.speak('Hello.')
 *
 * `speak()` must resolve when playback ends and reject on a provider error;
 * `cancel()` aborts any in-flight utterance synchronously and is safe to
 * call when nothing is playing.
 */
export interface TtsProvider {
  speak(text: string, opts?: TtsSpeakOptions): Promise<void>
  cancel(): void
  isAvailable(): boolean
}

/**
 * Env flag values recognised by the TTS provider factory.
 */
export type TtsProviderName = 'web-speech' | 'sarvam'
