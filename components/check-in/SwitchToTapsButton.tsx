'use client'

/**
 * SwitchToTapsButton — sticky-bottom bail-out affordance shown during
 * every voice dialog state in Voice C1.
 *
 * Feature 01, Voice Cycle 1, Wave 2 (Task 2.4 in
 * `docs/features/voice-cycle-1-plan.md`).
 *
 * Behaviour:
 *   - Renders a sticky button at the bottom of the viewport with copy
 *     "Switch to taps".
 *   - On click, calls the supplied `onBail` handler. The page is
 *     responsible for cancelling in-flight TTS + STT and dispatching
 *     `{ type: 'BAIL_TO_TAPS' }` to the state machine.
 *   - 200ms fade-in so the button does not flash during transient
 *     state transitions. Collapses to instant when the user requests
 *     reduced motion.
 *   - Min hit target ≥44pt (h-11) per WCAG 2.5.5 AA. Visible focus
 *     ring matches the rest of the check-in surface.
 *
 * Visibility is owned by the parent — render this component only when
 * the state machine is in a voice state. Keeps this component a leaf
 * with no state-machine coupling so it stays trivial to test.
 */

import { useEffect, useState } from 'react'

const FADE_IN_MS = 200

export interface SwitchToTapsButtonProps {
  onBail: () => void
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function SwitchToTapsButton({
  onBail,
}: SwitchToTapsButtonProps): React.JSX.Element {
  const [reducedMotion] = useState(() => prefersReducedMotion())
  const [visible, setVisible] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [reducedMotion])

  return (
    <div
      className={
        'sticky bottom-4 z-10 mt-6 flex w-full justify-center px-4 ' +
        'pointer-events-none'
      }
    >
      <button
        type="button"
        aria-label="Switch to taps"
        onClick={onBail}
        data-testid="switch-to-taps-button"
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: reducedMotion ? '0ms' : `${FADE_IN_MS}ms`,
        }}
        className={
          'pointer-events-auto inline-flex min-h-11 items-center justify-center ' +
          'rounded-full border border-zinc-300 bg-white/95 px-5 py-2 ' +
          'text-sm font-medium text-zinc-700 shadow-md backdrop-blur ' +
          'transition-opacity hover:bg-zinc-50 focus-visible:outline-none ' +
          'focus-visible:ring-2 focus-visible:ring-teal-400 ' +
          'focus-visible:ring-offset-2 dark:border-zinc-700 ' +
          'dark:bg-zinc-900/95 dark:text-zinc-100 dark:hover:bg-zinc-800'
        }
      >
        Switch to taps
      </button>
    </div>
  )
}
