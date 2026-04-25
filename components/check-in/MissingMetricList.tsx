'use client'

/**
 * MissingMetricList — Stage 2's bottom column of TapInputs.
 *
 * Feature 01, Cycle 2, Chunk 2.C, US-1.E.1.
 *
 * Renders one `<TapInput>` per metric in `metricsToShow`, in scoping
 * order (pain → mood → adherence → flare → energy). Header copy:
 *
 *   - 0 metrics → component returns null (caller should not render us)
 *   - 1 metric  → "Just one more:"
 *   - 2+        → "Just two more:" (matches scoping verbatim — even when
 *                 the count is 3+, scoping uses "Just two more:" as the
 *                 canonical multi-form. We keep that locked.)
 *
 * Day-1 mode (handled by parent via `forceAllControls`): caller passes
 * all 5 metrics here; header still adapts to the count.
 *
 * Pure presentational.
 */

import { TapInput } from './TapInput'

import type { CheckinMetrics, Metric } from '@/lib/checkin/types'

const SCOPING_ORDER: Metric[] = [
  'pain',
  'mood',
  'adherenceTaken',
  'flare',
  'energy',
]

export interface MissingMetricListProps {
  metricsToShow: Metric[]
  metrics: Partial<CheckinMetrics>
  declined: Metric[]
  onMetricUpdate: <M extends Metric>(
    metric: M,
    value: NonNullable<CheckinMetrics[M]>,
  ) => void
  onMetricDeclined: (metric: Metric) => void
}

export function headerCopyForCount(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return 'Just one more:'
  return 'Just two more:'
}

export function MissingMetricList({
  metricsToShow,
  metrics,
  declined,
  onMetricUpdate,
  onMetricDeclined,
}: MissingMetricListProps): React.JSX.Element | null {
  if (metricsToShow.length === 0) return null

  const ordered = SCOPING_ORDER.filter((m) => metricsToShow.includes(m))
  const header = headerCopyForCount(ordered.length)

  return (
    <section
      data-testid="missing-metric-list"
      className="flex w-full flex-col gap-3"
    >
      {header ? (
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {header}
        </h2>
      ) : null}
      <ul className="flex flex-col gap-2">
        {ordered.map((metric) => (
          <li key={metric}>
            <TapInput
              metric={metric}
              value={metrics[metric] ?? null}
              declined={declined.includes(metric)}
              onUpdate={onMetricUpdate}
              onDecline={onMetricDeclined}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
