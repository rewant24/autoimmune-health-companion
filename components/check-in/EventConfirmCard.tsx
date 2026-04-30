'use client'

/**
 * EventConfirmCard — render one extracted visit OR blood-work mention as a
 * confirm card during the check-in summary step (US-5.C.1, US-5.C.2).
 *
 * Visual vocabulary mirrors the F01 C2 ConfirmSummary card so the user sees
 * one consistent confirm pattern across all extracted artefacts. Two
 * buttons: Save / Not now. Save fires the parent's `onConfirm` callback;
 * Not now fires `onDecline`. Both close the card via the parent re-render
 * (cards are removed from the parent's pending list once acted on).
 *
 * Stack order in the summary: dosage-change cards (F04 4.C) first, then
 * event cards (this) — enforced by the page composing them in order.
 */

import type {
  ExtractedVisit,
  ExtractedBloodWork,
} from '@/lib/checkin/event-extract'

export type EventConfirmKind = 'visit' | 'blood-work'

export interface EventConfirmCardProps {
  kind: EventConfirmKind
  visit?: ExtractedVisit
  bloodWork?: ExtractedBloodWork
  onConfirm: () => void
  onDecline: () => void
  /** Disable both buttons while the parent is awaiting the mutation. */
  disabled?: boolean
}

const VISIT_TYPE_LABELS: Record<ExtractedVisit['visitType'], string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Visit',
}

function formatDateLabel(iso: string): string {
  // Display the date as "Tue 30 Apr 2026" — same en-GB style as DayView.
  // The string is YYYY-MM-DD; we construct in UTC so timezone arithmetic
  // doesn't accidentally roll the day backwards.
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dt)
  } catch {
    return iso
  }
}

export function EventConfirmCard(
  props: EventConfirmCardProps,
): React.JSX.Element | null {
  const { kind, visit, bloodWork, onConfirm, onDecline, disabled } = props

  if (kind === 'visit' && !visit) return null
  if (kind === 'blood-work' && !bloodWork) return null

  const date = kind === 'visit' ? visit!.date : bloodWork!.date
  const dateLabel = formatDateLabel(date)

  const title =
    kind === 'visit'
      ? `Doctor visit on ${dateLabel}?`
      : `Blood work on ${dateLabel}?`

  return (
    <section
      data-testid={`event-confirm-card-${kind}`}
      data-event-kind={kind}
      className={[
        'flex w-full max-w-md flex-col gap-3 rounded-2xl border px-4 py-3',
        'border-zinc-200 bg-white text-zinc-900',
        'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
      ].join(' ')}
    >
      <h3 className="text-base font-semibold">{title}</h3>

      {kind === 'visit' ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          I heard: {visit!.doctorName} ·{' '}
          {VISIT_TYPE_LABELS[visit!.visitType]}
          {visit!.specialty ? ` · ${visit!.specialty}` : ''}
        </p>
      ) : (
        <ul
          data-testid="event-confirm-blood-markers"
          className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-200"
        >
          {bloodWork!.markers.map((m, i) => (
            <li key={`${m.name}-${i}`}>
              I heard: {m.name} {m.value}
              {m.unit ? ` ${m.unit}` : ''}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDecline}
          disabled={disabled}
          className={[
            'inline-flex min-h-9 items-center justify-center rounded-full',
            'border border-zinc-300 bg-white px-4 text-sm text-zinc-800',
            'hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70',
            'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
            'dark:hover:bg-zinc-800',
          ].join(' ')}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className={[
            'inline-flex min-h-9 items-center justify-center rounded-full',
            'bg-teal-600 px-4 text-sm font-medium text-white shadow-sm',
            'hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70',
          ].join(' ')}
        >
          Save
        </button>
      </div>
    </section>
  )
}
