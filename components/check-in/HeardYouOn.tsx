'use client'

/**
 * HeardYouOn — single recap row (Feature 01, Cycle 2, Chunk 2.C, US-1.E.2).
 *
 * Renders one of the 5 metrics inside the "Heard you on:" recap. Three
 * states encoded by `state`:
 *
 *   - `covered`  → ✓ + label + captured value (e.g. "✓ Pain — 5")
 *   - `tapped`   → label + value, no checkmark (the user filled this via
 *                  Stage 2 tap controls rather than voice)
 *   - `declined` → label + "— skipped today"
 *   - `missing`  → dimmed label, no value
 *
 * The row is a button — tapping reveals a TapInput for that metric inline.
 * The actual TapInput rendering lives in `Stage2Recap`; this component
 * only owns the row's visible chrome and exposes an `onTap` callback.
 *
 * Pure presentational. No state.
 */

import type { CheckinMetrics, FlareState, Metric, Mood } from '@/lib/checkin/types'

export type HeardYouOnState = 'covered' | 'tapped' | 'declined' | 'missing'

export interface HeardYouOnProps {
  metric: Metric
  state: HeardYouOnState
  value: CheckinMetrics[Metric]
  onTap?: () => void
  expanded?: boolean
}

export const METRIC_LABEL_HEARD: Record<Metric, string> = {
  pain: 'Pain',
  mood: 'Mood',
  adherenceTaken: 'Meds',
  flare: 'Flare',
  energy: 'Energy',
}

const FLARE_TEXT: Record<FlareState, string> = {
  no: 'not a flare',
  yes: 'flaring',
  ongoing: 'still ongoing',
}

function formatValue(metric: Metric, value: CheckinMetrics[Metric]): string {
  if (value === null || value === undefined) return ''
  switch (metric) {
    case 'pain':
    case 'energy':
      return String(value)
    case 'mood':
      return value as Mood
    case 'adherenceTaken':
      return value === true ? 'took them' : 'missed'
    case 'flare':
      return FLARE_TEXT[value as FlareState]
  }
}

export function HeardYouOn({
  metric,
  state,
  value,
  onTap,
  expanded,
}: HeardYouOnProps): React.JSX.Element {
  const label = METRIC_LABEL_HEARD[metric]

  let body: React.ReactNode
  if (state === 'covered') {
    body = (
      <>
        <span aria-hidden="true" className="text-teal-600 dark:text-teal-400">
          ✓
        </span>
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          {label}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">—</span>
        <span className="text-zinc-700 dark:text-zinc-200">
          {formatValue(metric, value)}
        </span>
      </>
    )
  } else if (state === 'tapped') {
    body = (
      <>
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          {label}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">—</span>
        <span className="text-zinc-700 dark:text-zinc-200">
          {formatValue(metric, value)}
        </span>
      </>
    )
  } else if (state === 'declined') {
    body = (
      <>
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          {label}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">— skipped today</span>
      </>
    )
  } else {
    body = (
      <span className="font-medium text-zinc-400 dark:text-zinc-600">
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      data-testid={`heard-you-on-${metric}`}
      data-state={state}
      aria-expanded={expanded ? true : false}
      aria-label={`${label} — tap to edit`}
      onClick={onTap}
      className={
        'flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1 text-left ' +
        'text-sm transition hover:bg-zinc-100 focus-visible:outline-none ' +
        'focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
        'dark:hover:bg-zinc-800'
      }
    >
      {body}
    </button>
  )
}
