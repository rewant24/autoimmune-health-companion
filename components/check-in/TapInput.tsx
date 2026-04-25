'use client'

/**
 * TapInput — per-metric Stage 2 control.
 *
 * Feature 01, Cycle 2, Chunk 2.C, US-1.E.3 + US-1.E.4.
 *
 * Switches on `metric`:
 *   - pain / energy → 1–10 slider, number above thumb
 *   - mood          → 5-chip group (heavy / flat / okay / bright / great)
 *   - adherenceTaken → two-toggle ("took them" / "missed")
 *   - flare         → three-toggle ("not a flare" / "yes, flaring" / "still ongoing")
 *
 * Each control has a small "Skip today" link. Tapping it calls
 * `onDecline(metric)`. When `declined` is true the control area is replaced
 * by a quiet "— skipped today" line.
 *
 * Pure presentational: parent owns state. Min hit target = 44pt (`min-h-11`)
 * across every interactive element.
 */

import type { CheckinMetrics, FlareState, Metric, Mood } from '@/lib/checkin/types'

type ValueFor<M extends Metric> = CheckinMetrics[M]

export interface TapInputProps {
  metric: Metric
  value: CheckinMetrics[Metric]
  declined: boolean
  onUpdate: <M extends Metric>(metric: M, value: NonNullable<ValueFor<M>>) => void
  onDecline: (metric: Metric) => void
}

const MOOD_CHIPS: Mood[] = ['heavy', 'flat', 'okay', 'bright', 'great']

const FLARE_CHIPS: Array<{ label: string; value: FlareState }> = [
  { label: 'not a flare', value: 'no' },
  { label: 'yes, flaring', value: 'yes' },
  { label: 'still ongoing', value: 'ongoing' },
]

const METRIC_LABEL: Record<Metric, string> = {
  pain: 'Pain',
  mood: 'Mood',
  adherenceTaken: 'Medications',
  flare: 'Flare',
  energy: 'Energy',
}

const skipLinkClass =
  'inline-flex min-h-11 items-center justify-center px-2 text-xs font-medium ' +
  'text-zinc-500 underline-offset-4 hover:underline focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
  'dark:text-zinc-400'

const chipClass = (active: boolean): string =>
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 ' +
  'text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
  (active
    ? 'bg-teal-600 text-white shadow-sm '
    : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 ')

export function TapInput({
  metric,
  value,
  declined,
  onUpdate,
  onDecline,
}: TapInputProps): React.JSX.Element {
  if (declined) {
    return (
      <div
        data-testid={`tap-input-${metric}`}
        data-declined="true"
        className="flex items-center gap-3 py-2 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {METRIC_LABEL[metric]}
        </span>
        <span>— skipped today</span>
      </div>
    )
  }

  return (
    <div
      data-testid={`tap-input-${metric}`}
      className="flex flex-col gap-2 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {METRIC_LABEL[metric]}
        </span>
      </div>

      {metric === 'pain' || metric === 'energy' ? (
        <SliderControl
          metric={metric}
          value={typeof value === 'number' ? value : null}
          onUpdate={onUpdate}
        />
      ) : null}

      {metric === 'mood' ? (
        <MoodChips
          value={value as Mood | null}
          onUpdate={(m) => onUpdate('mood', m)}
        />
      ) : null}

      {metric === 'adherenceTaken' ? (
        <AdherenceToggles
          value={value as boolean | null}
          onUpdate={(v) => onUpdate('adherenceTaken', v)}
        />
      ) : null}

      {metric === 'flare' ? (
        <FlareToggles
          value={value as FlareState | null}
          onUpdate={(v) => onUpdate('flare', v)}
        />
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          className={skipLinkClass}
          onClick={() => onDecline(metric)}
        >
          Skip today
        </button>
      </div>
    </div>
  )
}

function SliderControl({
  metric,
  value,
  onUpdate,
}: {
  metric: 'pain' | 'energy'
  value: number | null
  onUpdate: TapInputProps['onUpdate']
}): React.JSX.Element {
  const display = value ?? (metric === 'pain' ? 5 : 5)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-end">
        <span
          data-testid={`tap-input-${metric}-readout`}
          className="inline-flex min-h-7 min-w-9 items-center justify-center rounded-md bg-zinc-100 px-2 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={display}
        aria-label={metric}
        aria-valuenow={display}
        aria-valuemin={1}
        aria-valuemax={10}
        onChange={(e) => {
          const n = Number(e.currentTarget.value)
          onUpdate(metric, n)
        }}
        className="min-h-11 w-full cursor-pointer accent-teal-600"
      />
    </div>
  )
}

function MoodChips({
  value,
  onUpdate,
}: {
  value: Mood | null
  onUpdate: (v: Mood) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="mood" className="flex flex-wrap gap-2">
      {MOOD_CHIPS.map((m) => {
        const active = value === m
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={m}
            onClick={() => onUpdate(m)}
            className={chipClass(active)}
          >
            {m}
          </button>
        )
      })}
    </div>
  )
}

function AdherenceToggles({
  value,
  onUpdate,
}: {
  value: boolean | null
  onUpdate: (v: boolean) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="medications" className="flex gap-2">
      <button
        type="button"
        role="radio"
        aria-checked={value === true}
        aria-label="took them"
        onClick={() => onUpdate(true)}
        className={chipClass(value === true)}
      >
        took them
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === false}
        aria-label="missed"
        onClick={() => onUpdate(false)}
        className={chipClass(value === false)}
      >
        missed
      </button>
    </div>
  )
}

function FlareToggles({
  value,
  onUpdate,
}: {
  value: FlareState | null
  onUpdate: (v: FlareState) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="flare" className="flex flex-wrap gap-2">
      {FLARE_CHIPS.map((c) => {
        const active = value === c.value
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.label}
            onClick={() => onUpdate(c.value)}
            className={chipClass(active)}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
