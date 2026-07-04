'use client'

/**
 * ErrorSlot — STUB for Feature 10 (Edge-case Templates).
 *
 * Spec: docs/features/01-daily-checkin.md US-1.C.3 acceptance +
 * docs/build-plan.md §6 (Feature 10 is scaffolded as stubs inside Feature 01
 * Cycle 1 and finalised last — each feature's error templates live there).
 *
 * This renders a minimal full-screen card: kind, optional message, retry
 * button. Feature 10 will replace this with full edge-case templates
 * (connection error, transcription fail, save fail, offline, empty states)
 * that share copy tone + layout across the app.
 *
 * STUB: Feature 10 will replace with full edge-case templates.
 */

import { useEffect, useRef } from 'react'

/**
 * Per-kind plain-language copy (2026-07-04 assessment, quick win Q5).
 * A chronically ill user mid-check-in used to be shown a debug slug
 * (`permission-denied`) as the explanation. Each known kind now gets a
 * human headline + a sentence that owns the failure and points at the
 * recovery path; the slug survives only as a demoted detail line for
 * bug reports. Register: first person where natural, blame-absorbing
 * ("our side, not you" — the Wysa lesson), taps always named as the
 * way forward.
 */
export const ERROR_COPY: Record<string, { title: string; body: string }> = {
  'permission-denied': {
    title: "Saha can't hear you yet.",
    body:
      'Your browser is blocking the microphone. Allow mic access in ' +
      'your browser settings, or finish today with taps.',
  },
  'no-speech': {
    title: "I didn't catch anything.",
    body:
      'It was quiet on this end. Try again a little closer to the ' +
      'phone, or switch to taps.',
  },
  network: {
    title: 'The connection dropped.',
    body:
      'Something broke up mid-sentence — the network or our side, not ' +
      'you. Check your connection and try again.',
  },
  unsupported: {
    title: "Voice doesn't work in this browser.",
    body:
      'Everything still works with taps — or open Saha in another ' +
      'browser for voice.',
  },
  aborted: {
    title: 'Voice input stopped.',
    body: 'The session ended before anything was captured. Try again when ready.',
  },
  'rate-limited': {
    title: 'Voice is over its limit right now.',
    body:
      "Nothing you said is lost. Give it a little while and try again, " +
      'or finish with taps.',
  },
  'save-failed': {
    title: "That didn't save.",
    body:
      'Your check-in is still right here — nothing is lost. Try again ' +
      'in a moment.',
  },
}

const FALLBACK_COPY = {
  title: 'Something got in the way.',
  body: 'An unexpected hiccup on our side. Try again in a moment.',
}

export interface ErrorSlotProps {
  kind: string
  message?: string
  onRetry?: () => void
}

export function ErrorSlot({
  kind,
  message,
  onRetry,
}: ErrorSlotProps): React.JSX.Element {
  const retryRef = useRef<HTMLButtonElement | null>(null)

  // R3-6: When the error surface appears (or its kind changes), move focus
  // to the retry button so keyboard + screen-reader users land on the
  // recovery action immediately. role="alert" handles the announcement;
  // focus handles navigation.
  useEffect(() => {
    if (onRetry) retryRef.current?.focus()
  }, [kind, onRetry])

  return (
    <section
      role="alert"
      data-testid="error-slot"
      data-error-kind={kind}
      className={
        'flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center ' +
        'gap-4 rounded-2xl border border-red-200 bg-white p-8 text-center ' +
        'shadow-sm dark:border-red-900/40 dark:bg-zinc-900'
      }
    >
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {(ERROR_COPY[kind] ?? FALLBACK_COPY).title}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {(ERROR_COPY[kind] ?? FALLBACK_COPY).body}
        {message ? <span className="block pt-2">{message}</span> : null}
      </p>
      {onRetry ? (
        <button
          ref={retryRef}
          type="button"
          onClick={onRetry}
          className={
            'mt-2 inline-flex min-h-11 items-center justify-center rounded-full ' +
            'bg-teal-600 px-6 text-sm font-medium text-white hover:bg-teal-700 ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ' +
            'focus-visible:ring-offset-2'
          }
        >
          Try again
        </button>
      ) : null}
      {/* Debug slug, demoted to a detail line — kept for bug reports. */}
      <span className="font-mono text-[10px] text-zinc-300 dark:text-zinc-600">
        {kind}
      </span>
    </section>
  )
}
