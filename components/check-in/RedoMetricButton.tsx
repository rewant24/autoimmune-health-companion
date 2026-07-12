'use client'

/**
 * RedoMetricButton — voice Pattern D "ask that again" affordance,
 * mounted during `listening-answer` (2026-07-12 voice cycle; see
 * `docs/spikes/voice-ux-research/04-target-patterns.md` §Pattern D).
 *
 * Third affordance alongside StopButton (commit the current capture)
 * and SwitchToTapsButton (bail the whole loop): re-asks the CURRENT
 * metric without losing prior captures. The page composes the redo-ack
 * + attempt-1 question text and dispatches `REDO_METRIC`; the hook
 * aborts the armed provider so the re-ask turn re-arms cleanly.
 *
 * Positioning: rendered IN FLOW (below the orb's transient copy), not
 * `fixed` — the fixed bottom slot already stacks StopButton and
 * SwitchToTapsButton (housekeeping #17 z-fight, owned by a parallel
 * lane). An in-flow pill keeps this affordance out of that contested
 * layer entirely.
 *
 * Same fade-in / reduced-motion / ≥44pt hit-target conventions as its
 * two siblings. Visibility is owned by the parent — render only during
 * the answer-listening turn.
 */

import { useEffect, useState } from 'react'

const FADE_IN_MS = 200

export interface RedoMetricButtonProps {
  /** Fires when the user asks to hear the question again. */
  onRedo: () => void
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function RedoMetricButton({
  onRedo,
}: RedoMetricButtonProps): React.JSX.Element {
  const [reducedMotion] = useState(() => prefersReducedMotion())
  const [visible, setVisible] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [reducedMotion])

  return (
    <div className="flex justify-center px-4">
      <button
        type="button"
        aria-label="Ask that again"
        onClick={onRedo}
        data-testid="redo-metric-button"
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: reducedMotion ? '0ms' : `${FADE_IN_MS}ms`,
        }}
        className={
          'inline-flex min-h-11 items-center justify-center rounded-full ' +
          'border border-rule bg-bg-elevated/95 px-5 py-2 text-sm ' +
          'font-medium text-ink-muted shadow-sm backdrop-blur ' +
          'transition-opacity hover:bg-sage-soft focus-visible:outline-none ' +
          'focus-visible:ring-2 focus-visible:ring-sage ' +
          'focus-visible:ring-offset-2'
        }
      >
        Ask that again
      </button>
    </div>
  )
}
