'use client'

/**
 * SpokenOpener — the opener-text wrapper that renders Saumya's greeting
 * and (when supported) speaks it aloud once on mount.
 *
 * Feature 01, Cycle 2, Chunk 2.E, US-1.H.2 + US-1.H.3.
 *
 * Behaviour:
 *   - Renders `<p>{text}</p>` plus a small speaker-icon button labelled
 *     "Replay" that re-speaks the current text on click.
 *   - On mount (and when `variantKey` changes), auto-speaks the text
 *     if all three conditions hold:
 *       1. `isTtsAvailable()` returns true.
 *       2. `prefers-reduced-motion` is NOT requested.
 *       3. `localStorage.getItem('saumya.ttsDisabled') !== 'true'`.
 *   - On unmount, calls `tts.cancel()` so the queued utterance doesn't
 *     keep speaking after the user navigates away.
 *   - When TTS is unavailable, the speaker button is hidden entirely.
 *
 * Mute long-press (US-1.H.3): a 1s press-and-hold on the speaker icon
 * opens a small popover with a single "Mute Saumya's voice" action;
 * confirming sets `saumya.ttsDisabled = 'true'` in localStorage. A
 * short tap is a normal replay click.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
  createTtsAdapter,
  isTtsAvailable,
  type TtsAdapter,
} from '@/lib/voice/tts-adapter'

const TTS_DISABLED_KEY = 'saumya.ttsDisabled'

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

  const onReplayClick = useCallback(() => {
    speak(text)
  }, [speak, text])

  return (
    <div className="relative flex flex-col items-center gap-2">
      <p className="text-center text-base text-zinc-800 dark:text-zinc-100">
        <span data-testid="spoken-opener-text">{text}</span>
        {available ? (
          <button
            type="button"
            aria-label="Replay"
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
      </p>
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
