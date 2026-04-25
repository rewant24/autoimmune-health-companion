'use client'

/**
 * ConfirmSummary — the post-conversation summary card.
 *
 * Feature 01, Chunk 2.D, US-1.F.1 + US-1.F.2.
 *
 * Heading is locked verbatim: "Here's what I heard". The card surfaces the
 * five captured metrics, the optional "Plus: …" bonus capture line (only
 * when transcript word count > 30), the closer text, and a primary
 * sticky-bottom Save button + a secondary "Discard this check-in" link
 * that opens <DiscardConfirm />.
 *
 * Save flow:
 *   - Click Save → onSave().
 *   - While `isSaving` → button shows "Saving…" + disabled.
 *   - On `saveError` → an inline ErrorSlot (Feature 10 stub) renders with
 *     "Try again" (→ onRetry) and "Keep this for later" (→ onSaveLater).
 *     The orchestrator wires onSaveLater to enqueue the payload and
 *     route to /check-in/saved?queued=true.
 *
 * Why no inline TapInput here: TapInput lives in chunk 2.C and is being
 * built in parallel. The orchestrator owns the rich correction UX in
 * Task 2 — this component exposes the `onMetricUpdate` /
 * `onMetricDeclined` callbacks via props so the page can layer the
 * TapInput on top without this chunk forging a peer-chunk import. Rows
 * render as a structured list with the captured value (or a "skipped
 * today" marker for declined metrics).
 */

import { useState } from 'react'

import { Closer } from './Closer'
import { DiscardConfirm } from './DiscardConfirm'
import { ErrorSlot } from './ErrorSlot'
import type { CheckinMetrics, Metric } from '@/lib/checkin/types'

const BONUS_WORD_THRESHOLD = 30

export interface ConfirmSummaryProps {
  metrics: CheckinMetrics
  declined: Metric[]
  transcript: { text: string }
  closerText: string
  onMetricUpdate: (metric: Metric, value: unknown) => void
  onMetricDeclined: (metric: Metric) => void
  onSave: () => void
  onDiscard: () => void
  /** Triggered by ErrorSlot's "Try again". Defaults to `onSave`. */
  onRetry?: () => void
  /** Triggered by the "Keep this for later" CTA on save-fail. */
  onSaveLater?: () => void
  isSaving: boolean
  saveError: string | null
}

const METRIC_LABELS: Record<Metric, string> = {
  pain: 'Pain',
  mood: 'Mood',
  adherenceTaken: 'Adherence',
  flare: 'Flare',
  energy: 'Energy',
}

const METRIC_ORDER: Metric[] = [
  'pain',
  'mood',
  'adherenceTaken',
  'flare',
  'energy',
]

function formatValue(metric: Metric, metrics: CheckinMetrics): string {
  switch (metric) {
    case 'pain':
      return metrics.pain === null ? '—' : String(metrics.pain)
    case 'mood':
      return metrics.mood ?? '—'
    case 'adherenceTaken':
      if (metrics.adherenceTaken === null) return '—'
      return metrics.adherenceTaken ? 'took them' : 'missed'
    case 'flare':
      return metrics.flare ?? '—'
    case 'energy':
      return metrics.energy === null ? '—' : String(metrics.energy)
  }
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

export function ConfirmSummary({
  metrics,
  declined,
  transcript,
  closerText,
  onSave,
  onDiscard,
  onRetry,
  onSaveLater,
  isSaving,
  saveError,
}: ConfirmSummaryProps): React.JSX.Element {
  const [discardOpen, setDiscardOpen] = useState(false)
  const declinedSet = new Set(declined)
  const showBonus = wordCount(transcript.text) > BONUS_WORD_THRESHOLD

  // ErrorSlot is a full-screen takeover in C1; here we render it inline
  // above the action area on save-fail. The two recovery CTAs are
  // rendered below the ErrorSlot so we avoid forking the C1 component.
  if (saveError !== null) {
    return (
      <section
        data-testid="confirm-summary"
        className="flex w-full max-w-md flex-col items-center gap-4 px-4 pb-32"
      >
        <ErrorSlot
          kind={saveError}
          message="We couldn't save this check-in."
          onRetry={onRetry ?? onSave}
        />
        <button
          type="button"
          onClick={() => onSaveLater?.()}
          className={
            'inline-flex min-h-11 items-center justify-center rounded-full ' +
            'border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 ' +
            'hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
            'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ' +
            'dark:hover:bg-zinc-800'
          }
        >
          Keep this for later
        </button>
      </section>
    )
  }

  return (
    <section
      data-testid="confirm-summary"
      aria-labelledby="confirm-heading"
      className="flex w-full max-w-md flex-col gap-4 px-4 pb-32"
    >
      <h2
        id="confirm-heading"
        className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
      >
        Here&apos;s what I heard
      </h2>

      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {METRIC_ORDER.map((m) => {
          const isDeclined = declinedSet.has(m)
          return (
            <li
              key={m}
              data-metric={m}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-zinc-700 dark:text-zinc-200">
                {METRIC_LABELS[m]}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {isDeclined ? '— skipped today' : formatValue(m, metrics)}
              </span>
            </li>
          )
        })}
      </ul>

      {showBonus ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Plus: {transcript.text}
        </p>
      ) : null}

      <Closer text={closerText} />

      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className={
          'sticky bottom-4 mt-4 inline-flex min-h-12 w-full items-center justify-center ' +
          'rounded-full bg-teal-600 px-6 text-sm font-medium text-white shadow-md ' +
          'hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 ' +
          'focus-visible:ring-teal-400 focus-visible:ring-offset-2 ' +
          'disabled:cursor-not-allowed disabled:opacity-70'
        }
      >
        {isSaving ? 'Saving…' : "Save today's check-in"}
      </button>

      <button
        type="button"
        onClick={() => setDiscardOpen(true)}
        className={
          'mx-auto text-xs text-zinc-500 underline-offset-2 hover:underline ' +
          'dark:text-zinc-400'
        }
      >
        Discard this check-in
      </button>

      <DiscardConfirm
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false)
          onDiscard()
        }}
      />
    </section>
  )
}
