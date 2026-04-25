'use client'

/**
 * DiscardConfirm — confirmation modal for the "Discard this check-in" path.
 *
 * Feature 01, Chunk 2.D, US-1.F.3.
 *
 * Copy locked verbatim by the spec — do not edit:
 *   heading:   "Discard this one?"
 *   body:      "Nothing will be saved."
 *   primary:   "Discard"
 *   secondary: "Keep editing"
 *
 * Browser-back interception: when the modal mounts in the open state,
 * we push an extra history entry. That way a real Browser Back press
 * fires `popstate` which we treat as "close the modal, don't navigate
 * away from the check-in screen". This matches the friend-app feel —
 * back-button never silently nukes the user's in-progress capture.
 *
 * Esc also closes via `onCancel`. The dialog uses native semantics
 * (role="dialog" + aria-modal) rather than the new <dialog> element so
 * jsdom + Testing Library can drive it without the showModal() polyfill.
 */

import { useEffect, useRef } from 'react'

export interface DiscardConfirmProps {
  open: boolean
  onDiscard: () => void
  onCancel: () => void
}

export function DiscardConfirm({
  open,
  onDiscard,
  onCancel,
}: DiscardConfirmProps): React.JSX.Element | null {
  const discardRef = useRef<HTMLButtonElement | null>(null)

  // Push a sentinel history entry on open so Browser Back fires popstate
  // for us to intercept. We don't bother undoing it on close — the next
  // navigation event handles that, and double-pushing is harmless.
  useEffect(() => {
    if (!open) return
    try {
      window.history.pushState({ saumyaDiscardModal: true }, '')
    } catch {
      // Harmless — some test environments restrict pushState.
    }

    const onPop = (): void => {
      onCancel()
    }
    window.addEventListener('popstate', onPop)

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)

    // Move keyboard focus to the destructive action so the user can
    // confirm with Enter, but the action itself still requires intent.
    discardRef.current?.focus()

    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      data-testid="discard-modal"
      className={
        'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ' +
        'backdrop-blur-sm'
      }
      onClick={(e) => {
        // Click on backdrop = cancel; clicks inside the dialog don't bubble.
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-heading"
        className={
          'w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 ' +
          'text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900'
        }
      >
        <h2
          id="discard-heading"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Discard this one?
        </h2>
        <p className="pt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Nothing will be saved.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            ref={discardRef}
            type="button"
            onClick={onDiscard}
            className={
              'inline-flex min-h-11 w-full items-center justify-center rounded-full ' +
              'bg-red-600 px-6 text-sm font-medium text-white hover:bg-red-700 ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ' +
              'focus-visible:ring-offset-2'
            }
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={
              'inline-flex min-h-11 w-full items-center justify-center rounded-full ' +
              'border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 ' +
              'hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 ' +
              'focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
              'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ' +
              'dark:hover:bg-zinc-800'
            }
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  )
}
