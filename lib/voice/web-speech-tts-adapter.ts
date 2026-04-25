/**
 * Web Speech `speechSynthesis` adapter.
 *
 * Originally `lib/voice/tts-adapter.ts` (Feature 01, Cycle 2, Chunk 2.E,
 * story TTS.US-1.H.1). Renamed during voice C1 pre-flight (ADR-026) to
 * make room for `sarvam-tts-adapter.ts`. A re-export shim lives at the
 * old path until the resolver wires Sarvam in (Wave 2).
 *
 * The adapter wraps the browser's `speechSynthesis` API so the rest of
 * the app calls a thin, typed interface (`TtsProvider` from `./types`)
 * and gets a Promise that resolves on `end` or rejects on `error`.
 *
 * Voice selection (loaded once and cached):
 *   1. First voice with `lang === 'en-IN'`.
 *   2. Else the first voice whose `lang` starts with `'en'`.
 *   3. Else `null` (let the browser pick the platform default).
 *
 * The module is React-free; the SpokenOpener component composes it.
 */

import type { TtsProvider, TtsSpeakOptions } from './types'

/**
 * Back-compat alias for the original cycle-2 name. New code should
 * import `TtsProvider` from `./types` directly.
 */
export type TtsAdapter = TtsProvider

interface SpeechSynthesisGlobal {
  speechSynthesis?: SpeechSynthesis
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance
}

function getSynthesis(): SpeechSynthesis | undefined {
  if (typeof globalThis === 'undefined') return undefined
  return (globalThis as unknown as SpeechSynthesisGlobal).speechSynthesis
}

function getUtteranceCtor(): typeof SpeechSynthesisUtterance | undefined {
  if (typeof globalThis === 'undefined') return undefined
  return (globalThis as unknown as SpeechSynthesisGlobal).SpeechSynthesisUtterance
}

/**
 * `true` iff a usable Web Speech synthesis API is reachable in the
 * current environment. Components gate auto-speak + speaker-icon
 * visibility on this.
 */
export function isTtsAvailable(): boolean {
  if (typeof globalThis === 'undefined') return false
  if (!('speechSynthesis' in (globalThis as object))) return false
  return getSynthesis() !== undefined
}

// --- Voice cache ----------------------------------------------------------

let cachedVoice: SpeechSynthesisVoice | null | undefined

/**
 * Test-only — clears the module-level voice cache between fixtures so
 * each test sees a fresh voice list. Not part of the public API.
 */
export function resetVoiceCacheForTests(): void {
  cachedVoice = undefined
}

/**
 * Pick the best Web Speech voice from a list. Exported because the
 * provider resolver and tests both call it directly.
 */
export function selectVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const enIN = voices.find((v) => v.lang === 'en-IN')
  if (enIN) return enIN
  const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  if (anyEn) return anyEn
  return null
}

function resolveVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice
  const synth = getSynthesis()
  if (!synth) {
    cachedVoice = null
    return null
  }
  const voices = synth.getVoices()
  cachedVoice = selectVoice(voices)
  return cachedVoice
}

// --- Adapter --------------------------------------------------------------

export function createTtsAdapter(): TtsProvider {
  return {
    speak(text: string, opts: TtsSpeakOptions = {}): Promise<void> {
      const synth = getSynthesis()
      const Utterance = getUtteranceCtor()
      if (!synth || !Utterance) return Promise.resolve()

      return new Promise<void>((resolve, reject) => {
        const utterance = new Utterance(text)
        if (typeof opts.rate === 'number') utterance.rate = opts.rate
        if (typeof opts.pitch === 'number') utterance.pitch = opts.pitch

        // `opts.voice` is `unknown` at the interface boundary because
        // the Sarvam adapter accepts a string speaker name. Web Speech
        // only honours real `SpeechSynthesisVoice` objects; anything
        // else falls back to the cached default.
        const overrideVoice =
          opts.voice && typeof opts.voice === 'object'
            ? (opts.voice as SpeechSynthesisVoice)
            : undefined
        const voice =
          overrideVoice !== undefined ? overrideVoice : resolveVoice()
        if (voice) utterance.voice = voice

        utterance.onend = (): void => resolve()
        utterance.onerror = (): void =>
          reject(new Error('speechSynthesis error'))

        synth.speak(utterance)
      })
    },

    cancel(): void {
      const synth = getSynthesis()
      if (!synth) return
      synth.cancel()
    },

    isAvailable(): boolean {
      return isTtsAvailable()
    },
  }
}
