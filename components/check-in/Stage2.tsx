'use client'

/**
 * Stage2 — top-level layout for the Stage 2 cleanup view.
 *
 * Feature 01, Cycle 2, Chunk 2.C, US-1.E.1 — US-1.E.4.
 *
 * Sections:
 *   1. <Stage2Recap>          — "Heard you on:" with the 5 metric rows
 *   2. <MissingMetricList>    — TapInputs for the missing metrics, with
 *                               adaptive header ("Just one more:" / "Just
 *                               two more:" / hidden when none).
 *   3. Continue button        — wired to `onContinue` (parent transitions
 *                               state machine to confirming).
 *
 * Day-1 mode: when `forceAllControls === true`, MissingMetricList shows
 * all 5 controls regardless of `missing`. The `Day1Tutorial` overlay is
 * a Wave-2 concern (chunk 2.F) — this component just exposes the flag.
 *
 * Pure presentational. No Convex calls, no state-machine dispatch.
 */

import { MissingMetricList } from './MissingMetricList'
import { Stage2Recap } from './Stage2Recap'

import type {
  CheckinMetrics,
  Metric,
} from '@/lib/checkin/types'
import type { Transcript } from '@/lib/voice/types'

const ALL_METRICS: Metric[] = [
  'pain',
  'mood',
  'adherenceTaken',
  'flare',
  'energy',
]

export interface Stage2Props {
  transcript: Transcript
  metrics: Partial<CheckinMetrics>
  missing: Metric[]
  declined: Metric[]
  /**
   * Day-1 mode: render all 5 controls regardless of `missing`. Wired by
   * chunk 2.F (`continuityState.isFirstEverCheckin`).
   */
  forceAllControls?: boolean
  onMetricUpdate: <M extends Metric>(
    metric: M,
    value: NonNullable<CheckinMetrics[M]>,
  ) => void
  onMetricDeclined: (metric: Metric) => void
  onContinue: () => void
}

export function Stage2({
  transcript: _transcript,
  metrics,
  missing,
  declined,
  forceAllControls,
  onMetricUpdate,
  onMetricDeclined,
  onContinue,
}: Stage2Props): React.JSX.Element {
  const metricsToShow = forceAllControls
    ? ALL_METRICS
    : missing.filter((m) => !declined.includes(m))

  return (
    <section
      data-testid="stage-2"
      data-force-all={forceAllControls ? 'true' : 'false'}
      className="flex w-full max-w-md flex-col gap-6 px-2 pb-8"
    >
      <Stage2Recap
        metrics={metrics}
        missing={missing}
        declined={declined}
        onMetricUpdate={onMetricUpdate}
        onMetricDeclined={onMetricDeclined}
      />

      <MissingMetricList
        metricsToShow={metricsToShow}
        metrics={metrics}
        declined={declined}
        onMetricUpdate={onMetricUpdate}
        onMetricDeclined={onMetricDeclined}
      />

      <div className="sticky bottom-4 flex justify-center">
        <button
          type="button"
          onClick={onContinue}
          className={
            'inline-flex min-h-12 w-full items-center justify-center rounded-full ' +
            'bg-teal-600 px-8 text-sm font-semibold text-white shadow-sm ' +
            'transition hover:bg-teal-700 focus-visible:outline-none ' +
            'focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
            'disabled:opacity-60'
          }
        >
          Continue
        </button>
      </div>
    </section>
  )
}
