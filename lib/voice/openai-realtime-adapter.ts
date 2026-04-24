/**
 * OpenAI Realtime adapter — skeleton.
 *
 * Transport, session bootstrapping, and error mapping land in a later cycle.
 * The final stub-error contract is finalized in US-1.A.3.
 */

import type {
  Transcript,
  VoiceCapabilities,
  VoiceError,
  VoiceProvider,
} from './types'

export class OpenAIRealtimeAdapter implements VoiceProvider {
  readonly capabilities: VoiceCapabilities = { partials: true, vad: true }

  onPartial(_cb: (partial: string) => void): void {}

  onError(_cb: (err: VoiceError) => void): void {}

  async start(): Promise<void> {
    throw new Error('OpenAIRealtimeAdapter: skeleton')
  }

  async stop(): Promise<Transcript> {
    throw new Error('OpenAIRealtimeAdapter: skeleton')
  }
}
