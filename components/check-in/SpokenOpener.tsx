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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createTtsAdapter,
  isTtsAvailable,
  type TtsAdapter,
} from '@/lib/voice/tts-adapter'

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
}: SpokenOpenerProps): React.JSX.Element {
  const ttsRef = useRef<TtsAdapter | null>(null)
  if (ttsRef.current === null) ttsRef.current = createTtsAdapter()

  // Capture availability once per mount — `isTtsAvailable` reads
  // `globalThis.speechSynthesis`, which is stable across renders.
  const available = useMemo(() => isTtsAvailable(), [])

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
  useEffect(() => {
    if (!available) return
    if (prefersReducedMotion()) return
    if (readTtsDisabled()) return
    speak(text)
    return () => {
      ttsRef.current?.cancel()
    }
  }, [available, speak, text, variantKey])

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
      <h1 className="text-center text-base font-normal text-zinc-800 dark:text-zinc-100">
        <span data-testid="spoken-opener-text">{text}</span>
        {available ? (
          <button
            type="button"
            aria-label="Replay"
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onClick={onReplayClick}
            className={
              'ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full ' +
              'align-middle text-zinc-500 hover:bg-zinc-100 ' +
              'focus-visible:outline-none focus-visible:ring-2 ' +
              'focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
              'dark:hover:bg-zinc-800'
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
            'border border-zinc-200 bg-white p-3 shadow-lg ' +
            'dark:border-zinc-800 dark:bg-zinc-900'
          }
        >
          {muted ? (
            <button
              type="button"
              onClick={onConfirmUnmute}
              className={
                'rounded-md bg-teal-700 px-3 py-2 text-xs font-medium text-white ' +
                'hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700'
              }
            >
              Un-mute Saha&apos;s voice
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirmMute}
              className={
                'rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white ' +
                'hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 ' +
                'dark:hover:bg-zinc-200'
              }
            >
              Mute Saha&apos;s voice
            </button>
          )}
          <button
            type="button"
            onClick={onDismissMute}
            className={
              'rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-700 ' +
              'hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 ' +
              'dark:hover:bg-zinc-800'
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
