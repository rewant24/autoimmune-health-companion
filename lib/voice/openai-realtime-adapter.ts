/**
 * OpenAI Realtime adapter — STUB for Cycle 1.
 *
 * The interface is wired so the factory can return an instance when
 * `VOICE_PROVIDER=openai-realtime`, but `start()` throws a marker error so
 * nobody ships this accidentally. A later cycle fills in WebRTC / WS
 * transport and ephemeral token exchange.
 */

import type {
  Transcript,
  VoiceCapabilities,
  VoiceError,
  VoiceProvider,
} from './types'

export class OpenAIRealtimeAdapter implements VoiceProvider {
  readonly capabilities: VoiceCapabilities = { partials: true, vad: true }

  onPartial(_cb: (partial: string) => void): void {
    // No-op in the stub. Kept to satisfy the interface.
  }

  onError(_cb: (err: VoiceError) => void): void {
    // No-op in the stub.
  }

  async start(): Promise<void> {
    throw new Error(
      'NotImplementedError: OpenAI Realtime adapter is stubbed for Cycle 1',
    )
  }

  async stop(): Promise<Transcript> {
    throw new Error(
      'NotImplementedError: OpenAI Realtime adapter is stubbed for Cycle 1',
    )
  }
}
