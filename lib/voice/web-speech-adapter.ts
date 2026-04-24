/**
 * Web Speech adapter — skeleton.
 *
 * Concrete implementation lands in US-1.A.2. For now the class satisfies the
 * `VoiceProvider` contract but refuses to start so nothing downstream can
 * call it by accident before the real logic ships.
 */

import type {
  Transcript,
  VoiceCapabilities,
  VoiceError,
  VoiceProvider,
} from './types'

export class WebSpeechAdapter implements VoiceProvider {
  readonly capabilities: VoiceCapabilities = { partials: true, vad: false }

  onPartial(_cb: (partial: string) => void): void {}

  onError(_cb: (err: VoiceError) => void): void {}

  async start(): Promise<void> {
    throw new Error(
      'WebSpeechAdapter: skeleton — implementation lands in US-1.A.2',
    )
  }

  async stop(): Promise<Transcript> {
    throw new Error(
      'WebSpeechAdapter: skeleton — implementation lands in US-1.A.2',
    )
  }
}
