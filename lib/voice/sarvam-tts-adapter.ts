/**
 * Browser-side Sarvam TTS adapter (Voice C1, Chunk V.C, stories
 * SarvamTtsAdapter.US-V.C.3 / US-V.C.4 / US-V.C.5).
 *
 * Implements `TtsProvider` from `lib/voice/types.ts`. Pairs with the
 * server-side `app/api/speak/route.ts` (SDK wrapper in
 * `lib/voice/sarvam-tts-server.ts`).
 *
 * Flow per `speak()` call:
 *   1. POST `{ text, language_code, voice? }` to `/api/speak` with an
 *      AbortController-backed `fetch`.
 *   2. Read the response body as a single `ArrayBuffer` (REST returns one
 *      complete WAV per the spike — no streaming decode needed).
 *   3. Wrap the bytes in a `Blob({ type: 'audio/wav' })`, hand the blob
 *      URL to a fresh `<audio>` element, and `play()`.
 *   4. Resolve the promise on `audio.onended`. Reject on `audio.onerror`
 *      with `{ kind: 'playback_failed' }` or on a fetch failure with
 *      `{ kind: 'tts_failed' }`.
 *   5. `cancel()` aborts the fetch + pauses + resets the audio + revokes
 *      the blob URL + rejects the pending speak promise with
 *      `{ kind: 'aborted' }` (US-V.C.4).
 *
 * No `MediaSource`. No WebAudio decode. The spike confirmed Sarvam REST
 * `convert` returns a single fully-formed WAV; blob playback is the
 * simplest pipeline that works.
 */
import type { TtsProvider, TtsSpeakOptions } from './types'

/**
 * Typed rejection reasons callers can branch on.
 *
 * - `aborted`: `cancel()` was called while a `speak()` was pending.
 * - `tts_failed`: server returned non-2xx, or the fetch threw a non-abort
 *   network error.
 * - `playback_failed`: the `<audio>` element fired an `error` event.
 */
export type SarvamTtsErrorKind = 'aborted' | 'tts_failed' | 'playback_failed'

export interface SarvamTtsAdapterError {
  kind: SarvamTtsErrorKind
  message?: string
  status?: number
}

export interface SarvamTtsAdapterOptions {
  language_code: string
  voice?: string
}

interface PendingSession {
  audio: HTMLAudioElement
  blobUrl: string | null
  controller: AbortController
  reject: (err: SarvamTtsAdapterError) => void
  done: boolean
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = (err as { name?: unknown }).name
  return name === 'AbortError'
}

export class SarvamTtsAdapter implements TtsProvider {
  private readonly language_code: string
  private readonly voice?: string
  private pending: PendingSession | null = null

  constructor(opts: SarvamTtsAdapterOptions) {
    if (
      !opts ||
      typeof opts.language_code !== 'string' ||
      opts.language_code.trim().length === 0
    ) {
      throw new Error('SarvamTtsAdapter: `language_code` is required')
    }
    this.language_code = opts.language_code.trim()
    if (typeof opts.voice === 'string' && opts.voice.trim().length > 0) {
      this.voice = opts.voice.trim()
    }
  }

  /**
   * Always `true` — provider work happens server-side. Callers should
   * gate auto-speak on user-gesture/policy concerns separately.
   */
  isAvailable(): boolean {
    return true
  }

  // `TtsSpeakOptions` is accepted for interface compatibility with the
  // Web Speech adapter. Sarvam ignores `rate`/`pitch` (REST endpoint
  // doesn't accept them in cycle 1) and selects voice via the
  // constructor — per-call `voice` overrides go through the constructor
  // for now to keep the request body deterministic.
  async speak(text: string, _opts: TtsSpeakOptions = {}): Promise<void> {
    void _opts
    // Cancel any prior session. Per US-V.C.4 the new speak() proceeds.
    if (this.pending) {
      this.cancel()
    }

    const controller = new AbortController()
    const audio = new Audio()

    const session: PendingSession = {
      audio,
      blobUrl: null,
      controller,
      reject: () => undefined,
      done: false,
    }
    this.pending = session

    return new Promise<void>((resolve, reject) => {
      session.reject = (err: SarvamTtsAdapterError): void => {
        if (session.done) return
        session.done = true
        cleanup(session)
        if (this.pending === session) this.pending = null
        reject(err)
      }

      const finishOk = (): void => {
        if (session.done) return
        session.done = true
        cleanup(session)
        if (this.pending === session) this.pending = null
        resolve()
      }

      audio.onended = (): void => finishOk()
      audio.onerror = (): void =>
        session.reject({
          kind: 'playback_failed',
          message: 'Audio playback failed',
        })

      const body: Record<string, string> = {
        text,
        language_code: this.language_code,
      }
      if (this.voice) body.voice = this.voice

      void (async (): Promise<void> => {
        let response: Response
        try {
          response = await fetch('/api/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
        } catch (err) {
          if (isAbortError(err)) {
            session.reject({ kind: 'aborted' })
            return
          }
          session.reject({
            kind: 'tts_failed',
            message: err instanceof Error ? err.message : 'fetch failed',
          })
          return
        }

        if (!response.ok) {
          session.reject({
            kind: 'tts_failed',
            status: response.status,
            message: `Sarvam TTS responded with ${response.status}`,
          })
          return
        }

        let bytes: ArrayBuffer
        try {
          bytes = await response.arrayBuffer()
        } catch (err) {
          if (isAbortError(err)) {
            session.reject({ kind: 'aborted' })
            return
          }
          session.reject({
            kind: 'tts_failed',
            message: err instanceof Error ? err.message : 'decode failed',
          })
          return
        }

        if (session.done) return // cancel() landed mid-flight

        const blob = new Blob([bytes], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        session.blobUrl = url
        audio.src = url

        try {
          await audio.play()
        } catch (err) {
          // Autoplay policy or other user-gesture rejection — surface as
          // playback failure so callers can fall back.
          session.reject({
            kind: 'playback_failed',
            message: err instanceof Error ? err.message : 'audio.play() rejected',
          })
        }
      })()
    })
  }

  /**
   * Idempotent. Called while idle: no-op. Called while a `speak()` is
   * pending: aborts fetch, pauses + resets audio, revokes blob URL, and
   * rejects the pending promise with `{ kind: 'aborted' }`.
   */
  cancel(): void {
    const session = this.pending
    if (!session) return
    if (session.done) {
      this.pending = null
      return
    }
    session.reject({ kind: 'aborted' })
  }
}

function cleanup(session: PendingSession): void {
  // Stop network work first so an in-flight body read errors out cleanly.
  try {
    session.controller.abort()
  } catch {
    // AbortController.abort() is spec'd not to throw, but be defensive.
  }
  // Tear down the audio element. Order matters: pause before clearing
  // src or some browsers fire a stray error event.
  try {
    session.audio.pause()
  } catch {
    // ignore
  }
  try {
    session.audio.currentTime = 0
  } catch {
    // ignore — readonly until metadata loads in some engines
  }
  try {
    session.audio.src = ''
  } catch {
    // ignore
  }
  // Detach handlers so a late-firing onended can't double-resolve.
  session.audio.onended = null
  session.audio.onerror = null
  if (session.blobUrl) {
    try {
      URL.revokeObjectURL(session.blobUrl)
    } catch {
      // ignore
    }
    session.blobUrl = null
  }
}
