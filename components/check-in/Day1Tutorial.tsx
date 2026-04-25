'use client'

/**
 * Day1Tutorial — wraps a TapInput (or any control) and, on Day 1, renders
 * a small tooltip ribbon underneath with copy that teaches the tap-to-edit
 * affordance.
 *
 * Feature 01, Cycle 2, Chunk 2.F, story Day1.US-1.J.1.
 *
 * Usage in Stage 2 (orchestrator-wired):
 *
 *   <Day1Tutorial forceTooltip={isFirstEverCheckin && forceAllControls}>
 *     <TapInput ... />
 *   </Day1Tutorial>
 *
 * The component is presentational only — Stage 2 owns the actual day-1
 * mode flag (`forceAllControls`) and the orchestrator derives
 * `dayOneTooltipsForcedOn` from `continuityState.isFirstEverCheckin`.
 *
 * Copy is verbatim from scoping § Day-1 micro-tutorial:
 *   "Tap any of these to correct or skip — you can also use them
 *    instead of talking."
 */

import type { ReactNode } from 'react'

const DAY1_TUTORIAL_COPY =
  'Tap any of these to correct or skip — you can also use them instead of talking.'

export interface Day1TutorialProps {
  forceTooltip?: boolean
  children: ReactNode
}

export function Day1Tutorial({
  forceTooltip = false,
  children,
}: Day1TutorialProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {children}
      {forceTooltip ? (
        <p
          data-testid="day-1-tutorial-ribbon"
          role="note"
          aria-live="polite"
          className={
            'rounded-md bg-teal-50 px-3 py-1.5 text-xs text-teal-900 ' +
            'dark:bg-teal-950 dark:text-teal-100'
          }
        >
          {DAY1_TUTORIAL_COPY}
        </p>
      ) : null}
    </div>
  )
}
