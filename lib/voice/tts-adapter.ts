/**
 * Web Speech `speechSynthesis` adapter (Feature 01, Cycle 2, Chunk 2.E).
 *
 * Story TTS.US-1.H.1.
 *
 * ADR-018 locks voice output to Web Speech only — no Sarvam, no other
 * provider. This module wraps the browser's `speechSynthesis` API so
 * the rest of the app can call a thin, typed interface and get a
 * Promise that resolves on `end` or rejects on `error`.
 *
 * Voice selection (loaded once and cached):
 *   1. First voice with `lang === 'en-IN'`.
 *   2. Else the first voice whose `lang` starts with `'en'`.
 *   3. Else `null` (let the browser pick the platform default).
 *
 * The module is React-free; the SpokenOpener component composes it.
 */

export interface TtsSpeakOptions {
  rate?: number
  pitch?: number
  /**
   * Override the cached voice selection. Used by tests and future
   * settings UI; the default resolution covers the common case.
   */
  voice?: SpeechSynthesisVoice | null
}

export interface TtsAdapter {
  speak(text: string, opts?: TtsSpeakOptions): Promise<void>
  cancel(): void
}

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

function selectVoice(
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

export function createTtsAdapter(): TtsAdapter {
  return {
    speak(text: string, opts: TtsSpeakOptions = {}): Promise<void> {
      const synth = getSynthesis()
      const Utterance = getUtteranceCtor()
      if (!synth || !Utterance) return Promise.resolve()

      return new Promise<void>((resolve, reject) => {
        const utterance = new Utterance(text)
        if (typeof opts.rate === 'number') utterance.rate = opts.rate
        if (typeof opts.pitch === 'number') utterance.pitch = opts.pitch

        const voice = opts.voice !== undefined ? opts.voice : resolveVoice()
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
  }
}
