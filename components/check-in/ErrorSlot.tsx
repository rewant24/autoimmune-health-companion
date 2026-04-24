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
        Something got in the way.
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-mono text-xs text-zinc-400">{kind}</span>
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
    </section>
  )
}
