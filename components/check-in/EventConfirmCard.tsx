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
 *
 * F05 fix-pass: when an extracted blood-work marker has `unit: null` (LLM
 * didn't catch the unit), render a small input next to the value so the
 * user can fill it before Save. Save is disabled until every null-unit
 * marker has a non-empty unit string. The completed marker map is passed
 * to `onConfirm` so the parent can persist with the corrected units.
 */

import { useMemo, useState } from 'react'
import type {
  ExtractedVisit,
  ExtractedBloodWork,
  ExtractedBloodWorkMarker,
} from '@/lib/checkin/event-extract'

export type EventConfirmKind = 'visit' | 'blood-work'

/**
 * A marker with the user-confirmed unit filled in. Identical shape to the
 * extracted marker except `unit` is always a non-empty string.
 */
export interface ConfirmedBloodWorkMarker {
  name: string
  value: number
  unit: string
}

export interface EventConfirmCardProps {
  kind: EventConfirmKind
  visit?: ExtractedVisit
  bloodWork?: ExtractedBloodWork
  /**
   * Save callback. For blood-work cards the parent receives the marker
   * list with any user-supplied units patched in.
   */
  onConfirm: (patch?: { markers: ConfirmedBloodWorkMarker[] }) => void
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

  // Track user-typed units for any marker whose extracted unit was null.
  // Keyed by marker index in the extracted list (stable for the lifetime of
  // the card). Hooks must run unconditionally — declared before the early
  // returns below.
  const [unitOverrides, setUnitOverrides] = useState<Record<number, string>>({})

  const markers: ExtractedBloodWorkMarker[] =
    kind === 'blood-work' && bloodWork ? bloodWork.markers : []

  // Indexes of markers whose unit needs the user to fill it in.
  const nullUnitIndexes = useMemo(() => {
    return markers
      .map((m, i) => (m.unit === null ? i : -1))
      .filter((i) => i >= 0)
  }, [markers])

  const allUnitsFilled = useMemo(() => {
    return nullUnitIndexes.every(
      (i) => (unitOverrides[i] ?? '').trim().length > 0,
    )
  }, [nullUnitIndexes, unitOverrides])

  if (kind === 'visit' && !visit) return null
  if (kind === 'blood-work' && !bloodWork) return null

  const date = kind === 'visit' ? visit!.date : bloodWork!.date
  const dateLabel = formatDateLabel(date)

  const title =
    kind === 'visit'
      ? `Doctor visit on ${dateLabel}?`
      : `Blood work on ${dateLabel}?`

  const handleSave = () => {
    if (kind === 'blood-work') {
      // Build the confirmed marker list — substitute the user-typed unit for
      // any marker whose extracted unit was null. If the LLM had a unit, we
      // trust it as-is.
      const confirmed: ConfirmedBloodWorkMarker[] = markers.map((m, i) => ({
        name: m.name,
        value: m.value,
        unit:
          m.unit !== null
            ? m.unit
            : (unitOverrides[i] ?? '').trim(),
      }))
      onConfirm({ markers: confirmed })
      return
    }
    onConfirm()
  }

  const saveDisabled =
    disabled === true || (kind === 'blood-work' && !allUnitsFilled)

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
          className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200"
        >
          {markers.map((m, i) => (
            <li
              key={`${m.name}-${i}`}
              className="flex flex-wrap items-center gap-2"
            >
              <span>
                I heard: {m.name} {m.value}
                {m.unit !== null ? ` ${m.unit}` : ''}
              </span>
              {m.unit === null && (
                <label className="flex items-center gap-1 text-xs">
                  <span className="sr-only">Unit for {m.name}</span>
                  <input
                    type="text"
                    value={unitOverrides[i] ?? ''}
                    onChange={(e) =>
                      setUnitOverrides((prev) => ({
                        ...prev,
                        [i]: e.target.value,
                      }))
                    }
                    placeholder="unit (e.g. mg/L)"
                    data-testid={`event-confirm-unit-input-${i}`}
                    className={[
                      'h-8 w-28 rounded-md border px-2 text-xs',
                      'border-zinc-300 bg-white text-zinc-900',
                      'dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100',
                    ].join(' ')}
                  />
                </label>
              )}
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
          onClick={handleSave}
          disabled={saveDisabled}
          data-testid={`event-confirm-save-${kind}`}
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
