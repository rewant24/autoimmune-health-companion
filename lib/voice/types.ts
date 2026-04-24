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
  capabilities: VoiceCapabilities
}

/**
 * Env flag values recognised by the provider factory.
 */
export type VoiceProviderName = 'web-speech' | 'openai-realtime'
