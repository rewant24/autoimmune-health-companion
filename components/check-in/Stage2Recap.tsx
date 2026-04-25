'use client'

/**
 * Stage2Recap — "Heard you on:" header + the 5 recap rows.
 *
 * Feature 01, Cycle 2, Chunk 2.C, US-1.E.1 + US-1.E.2.
 *
 * Renders the 5 metrics in scoping order (pain → mood → adherence → flare
 * → energy). Each row is a `<HeardYouOn>` button. Tapping a row reveals
 * an inline `<TapInput>` for that metric (correction path), backed by
 * local expanded-state inside this component.
 *
 * Props are pure projections of the parent's metrics state. The component
 * owns ONLY the "which row is currently expanded" UI state.
 */

import { useState } from 'react'

import { HeardYouOn, type HeardYouOnState } from './HeardYouOn'
import { TapInput } from './TapInput'

import type {
  CheckinMetrics,
  Metric,
} from '@/lib/checkin/types'

const SCOPING_ORDER: Metric[] = [
  'pain',
  'mood',
  'adherenceTaken',
  'flare',
  'energy',
]

export interface Stage2RecapProps {
  metrics: Partial<CheckinMetrics>
  /** Metrics that voice did NOT cover. */
  missing: Metric[]
  /** Metrics the user actively skipped (declined). */
  declined: Metric[]
  /**
   * Metrics filled in via Stage 2 tap (no checkmark in recap). Optional —
   * if not supplied the recap treats every covered metric as voice-covered.
   */
  tappedMetrics?: Metric[]
  onMetricUpdate: <M extends Metric>(
    metric: M,
    value: NonNullable<CheckinMetrics[M]>,
  ) => void
  onMetricDeclined: (metric: Metric) => void
}

function rowStateFor(
  metric: Metric,
  metrics: Partial<CheckinMetrics>,
  missing: Metric[],
  declined: Metric[],
  tappedMetrics: Metric[] | undefined,
): HeardYouOnState {
  if (declined.includes(metric)) return 'declined'
  if (missing.includes(metric)) return 'missing'
  const v = metrics[metric]
  if (v === null || v === undefined) return 'missing'
  if (tappedMetrics && tappedMetrics.includes(metric)) return 'tapped'
  return 'covered'
}

export function Stage2Recap({
  metrics,
  missing,
  declined,
  tappedMetrics,
  onMetricUpdate,
  onMetricDeclined,
}: Stage2RecapProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<Metric | null>(null)

  return (
    <section
      data-testid="stage-2-recap"
      className="flex w-full flex-col gap-2"
    >
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Heard you on:
      </h2>
      <ul className="flex flex-col gap-1">
        {SCOPING_ORDER.map((metric) => {
          const state = rowStateFor(
            metric,
            metrics,
            missing,
            declined,
            tappedMetrics,
          )
          const isExpanded = expanded === metric
          return (
            <li key={metric} className="flex flex-col">
              <HeardYouOn
                metric={metric}
                state={state}
                value={metrics[metric] ?? null}
                expanded={isExpanded}
                onTap={() => setExpanded(isExpanded ? null : metric)}
              />
              {isExpanded ? (
                <div className="px-2 pb-2">
                  <TapInput
                    metric={metric}
                    value={metrics[metric] ?? null}
                    declined={declined.includes(metric)}
                    onUpdate={onMetricUpdate}
                    onDecline={(m) => {
                      onMetricDeclined(m)
                      setExpanded(null)
                    }}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
