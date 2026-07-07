'use client'

/**
 * SpokenOpener — the opener-text wrapper that renders Saha's greeting
 * and (when supported) speaks it aloud once on mount.
 *
 * Feature 01, Cycle 2, Chunk 2.E, US-1.H.2 + US-1.H.3.
 *
 * Behaviour:
 *   - Renders the opener text inside an `<h1>` page heading (a11y
 *     landmark — the orb screen would otherwise have no heading) plus
 *     a small speaker-icon button labelled "Replay" that re-speaks
 *     the current text on click.
 *   - On mount (and when `variantKey` changes), auto-speaks the text
 *     if all three conditions hold:
 *       1. `isTtsAvailable()` returns true.
 *       2. `prefers-reduced-motion` is NOT requested.
 *       3. `localStorage.getItem('saha.ttsDisabled') !== 'true'`.
 *   - On unmount, calls `tts.cancel()` so the queued utterance doesn't
 *     keep speaking after the user navigates away.
 *   - When TTS is unavailable, the speaker button is hidden entirely.
 *
 * Mute long-press (US-1.H.3): a 1s press-and-hold on the speaker icon
 * opens a small popover with a "Mute Saha's voice" action when TTS
 * is currently active, or an "Un-mute Saha's voice" action when it's
 * been muted. Confirming flips `saha.ttsDisabled` in localStorage.
 * A short tap is a normal replay click.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { getTtsProvider } from '@/lib/voice/provider'
import type { TtsProvider } from '@/lib/voice/types'

const TTS_DISABLED_KEY = 'saha.ttsDisabled'
const LONG_PRESS_MS = 1000

export interface SpokenOpenerProps {
  text: string
  /**
   * Stable identity for the opener variant. Changing this re-triggers
   * the auto-speak effect — used when the page swaps openers between
   * cold-start, streak-N, re-entry, etc.
   */
  variantKey: string
  /**
   * Whether to auto-speak on mount + variant change. Defaults to `true`
   * to preserve the standalone-component behaviour. The check-in page
   * passes `false` so its state-machine-driven greeting effect owns
   * the cold-mount TTS — without this opt-out the greeting would fire
   * twice (once from this component, once from the page) and the
   * second call would cancel the first.
   */
  autoSpeak?: boolean
  /**
   * When true, draws attention to the speaker-icon button so the user
   * notices it as the way to hear the greeting they missed. The
   * check-in page passes this `true` from the `idle-ready` state when
   * `greetingBlocked === true` (Chrome blocked `audio.play()` on
   * cold-mount). Renders as a soft animated pulse ring around the
   * button, or a static ring when `prefers-reduced-motion: reduce` is
   * set. No-op when TTS isn't available (button is hidden anyway).
   * Voice C1 Fix C.
   */
  highlightSpeaker?: boolean
}

function readTtsDisabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(TTS_DISABLED_KEY) === 'true'
  } catch {
    return false
  }
}

function writeTtsDisabled(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(TTS_DISABLED_KEY, 'true')
    else window.localStorage.removeItem(TTS_DISABLED_KEY)
  } catch {
    // Ignore quota / privacy errors — the worst case is we re-speak.
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function SpokenOpener({
  text,
  variantKey,
  autoSpeak = true,
  highlightSpeaker = false,
}: SpokenOpenerProps): React.JSX.Element {
  const ttsRef = useRef<TtsProvider | null>(null)
  if (ttsRef.current === null) ttsRef.current = getTtsProvider()

  // SSR-safe availability: always start `false` so server and first
  // client render match, then flip to the real value in an effect.
  // Web Speech's `isAvailable()` reads `globalThis.speechSynthesis`,
  // which is `undefined` during SSR and defined in the browser — using
  // it directly in render produces a hydration mismatch (React #418)
  // whenever the active TTS provider is web-speech (i.e. any preview
  // branch missing `NEXT_PUBLIC_VOICE_TTS_PROVIDER`). The mismatch is
  // silent in dev (full error text) but minifies to #418 in prod.
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    setAvailable(ttsRef.current?.isAvailable() ?? false)
  }, [])

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const [muteOpen, setMuteOpen] = useState(false)
  // Re-read `ttsDisabled` whenever the popover opens so the popover's
  // action text reflects the current state. We don't subscribe to
  // localStorage changes globally — the only place that flips this is
  // the popover itself, so refreshing on open is sufficient.
  const [muted, setMuted] = useState(false)

  const speak = useCallback(
    (value: string): void => {
      const tts = ttsRef.current
      if (!tts) return
      void tts.speak(value).catch(() => {
        // Errors here are user-visible only as silence — the UI is
        // already rendered. Swallow so unhandled-rejection doesn't
        // pollute logs in dev.
      })
    },
    [],
  )

  // Auto-speak on mount and whenever the opener variant changes.
  // Skip when the parent has taken over playback by passing
  // `autoSpeak={false}` — see prop docstring.
  useEffect(() => {
    if (!autoSpeak) return
    if (!available) return
    if (prefersReducedMotion()) return
    if (readTtsDisabled()) return
    speak(text)
    return () => {
      ttsRef.current?.cancel()
    }
  }, [autoSpeak, available, speak, text, variantKey])

  const startLongPress = useCallback(() => {
    longPressFired.current = false
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setMuted(readTtsDisabled())
      setMuteOpen(true)
    }, LONG_PRESS_MS)
  }, [])

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const onReplayClick = useCallback(() => {
    // The long-press timer fires before the click event in jsdom; if
    // it has already opened the popover, suppress the replay action so
    // the user doesn't get a stray utterance over the popover.
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    speak(text)
  }, [speak, text])

  const onConfirmMute = useCallback(() => {
    writeTtsDisabled(true)
    ttsRef.current?.cancel()
    setMuted(true)
    setMuteOpen(false)
  }, [])

  const onConfirmUnmute = useCallback(() => {
    writeTtsDisabled(false)
    setMuted(false)
    setMuteOpen(false)
    // Speak immediately so the user gets confirmation that voice is back.
    if (available) speak(text)
  }, [available, speak, text])

  const onDismissMute = useCallback(() => setMuteOpen(false), [])

  return (
    <div className="relative flex flex-col items-center gap-2">
      <h1 className="text-center text-base font-normal text-ink">
        <span data-testid="spoken-opener-text">{text}</span>
        {available ? (
          <button
            type="button"
            aria-label={highlightSpeaker ? 'Tap to hear greeting' : 'Replay'}
            data-highlight={highlightSpeaker ? 'true' : undefined}
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onClick={onReplayClick}
            className={
              'ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full ' +
              'align-middle text-ink-subtle hover:bg-sage-soft ' +
              'focus-visible:outline-none focus-visible:ring-2 ' +
              'focus-visible:ring-sage focus-visible:ring-offset-2' +
              // Fix C — attention ring when greeting autoplay was blocked.
              // Animate the pulse only when reduced-motion is NOT set;
              // fall back to a static ring otherwise so the cue is still
              // visible without motion.
              (highlightSpeaker
                ? ' ring-2 ring-sage ring-offset-2 motion-safe:animate-pulse'
                : '')
            }
          >
            <SpeakerGlyph />
          </button>
        ) : null}
      </h1>

      {muteOpen ? (
        <div
          role="dialog"
          aria-label="Voice settings"
          className={
            'absolute top-full z-20 mt-2 flex flex-col gap-2 rounded-xl ' +
            'border border-rule bg-bg-elevated p-3 shadow-lg'
          }
        >
          {muted ? (
            <button
              type="button"
              onClick={onConfirmUnmute}
              className={
                'rounded-md bg-sage-deep px-3 py-2 text-xs font-medium ' +
                'text-bg-elevated transition-colors hover:bg-sage'
              }
            >
              Un-mute Saha&apos;s voice
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirmMute}
              className={
                'rounded-md bg-ink px-3 py-2 text-xs font-medium ' +
                'text-bg-elevated transition-colors hover:opacity-90'
              }
            >
              Mute Saha&apos;s voice
            </button>
          )}
          <button
            type="button"
            onClick={onDismissMute}
            className={
              'rounded-md border border-rule px-3 py-2 text-xs text-ink-muted ' +
              'transition-colors hover:bg-sage-soft'
            }
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SpeakerGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
    >
      <path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  )
}
