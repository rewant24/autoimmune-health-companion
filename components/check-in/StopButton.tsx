'use client'

/**
 * StopButton — sticky "Tap when done" affordance mounted during the
 * `listening` and `listening-answer` states.
 *
 * Voice C1 fix-pass — see `docs/features/voice-cycle-1-plan.md` Phase 4
 * (StopButton + heard-transcript display). The orb itself stops on tap,
 * but pre-fix-pass smoke testing showed users don't reliably know that
 * tapping the listening orb a second time finalises the turn. The
 * recorder's silence VAD now auto-stops on trailing silence (Phase 2),
 * but a visible Stop button gives a deterministic explicit affordance
 * for noisy environments where silence detection misfires.
 *
 * Mirrors the SwitchToTapsButton pattern: floats above the BottomNav,
 * 200ms fade-in (skipped under prefers-reduced-motion), generous tap
 * target.
 *
 * Positioning: `fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))]`
 * so the button sits 80px above the safe-area-aware bottom of the
 * viewport, comfortably clearing the BottomNav (~64px tall + safe
 * area). `z-50` keeps it above BottomNav's `z-40`. Pre-fix-B versions
 * used `sticky bottom-4 z-10`, which left the button trapped under the
 * BottomNav on every voice-c1 smoke.
 */

import { useEffect, useState } from 'react'

const FADE_IN_MS = 200

export interface StopButtonProps {
  /** Fires when the user taps the button. The page dispatches TAP_ORB. */
  onStop: () => void
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function StopButton({ onStop }: StopButtonProps): React.JSX.Element {
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
        'fixed inset-x-0 z-50 flex justify-center px-4 ' +
        '[bottom:calc(5rem+env(safe-area-inset-bottom))] ' +
        'pointer-events-none'
      }
    >
      <button
        type="button"
        aria-label="Tap when done"
        onClick={onStop}
        data-testid="stop-button"
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: reducedMotion ? '0ms' : `${FADE_IN_MS}ms`,
        }}
        className={
          'pointer-events-auto inline-flex min-h-11 items-center justify-center ' +
          'rounded-full bg-teal-700 px-6 py-2 text-sm font-medium text-white ' +
          'shadow-md transition-opacity hover:bg-teal-800 ' +
          'focus-visible:outline-none focus-visible:ring-2 ' +
          'focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
          'dark:bg-teal-600 dark:hover:bg-teal-700'
        }
      >
        Tap when done
      </button>
    </div>
  )
}
