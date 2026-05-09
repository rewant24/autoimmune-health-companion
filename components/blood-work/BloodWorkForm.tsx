'use client'

/**
 * BloodWorkForm — controlled form for create OR edit of a blood-work entry.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.2 (create) + US-5.B.3 (edit pre-fill).
 *
 * Pre-populated default markers (CRP, ESR, WBC, Hb) appear with empty
 * value/unit; each removable via the X icon on its row. "+ Add another
 * marker" appends a freeform row at the end.
 *
 * Submit-disabled until at least one marker has name + value + unit AND
 * `Number(value)` is a finite number — matches 5.A's reject-empty-markers /
 * NaN guard so the user cannot land an invalid mutation.
 *
 * Pure presentational. Parent owns Convex calls.
 */

import { useEffect, useId, useState } from 'react'
import {
  EMPTY_MARKER,
  MarkerInput,
  isMarkerComplete,
  validateMarker,
  type MarkerInputValue,
} from './MarkerInput'

export interface BloodWorkMarker {
  name: string
  value: number
  unit: string
  refRangeLow?: number
  refRangeHigh?: number
  abnormal?: boolean
}

export interface BloodWorkFormValues {
  date: string
  markers: BloodWorkMarker[]
  notes: string
}

export interface BloodWorkFormInitial {
  date?: string
  markers?: BloodWorkMarker[]
  notes?: string
}

export interface BloodWorkFormProps {
  initial?: BloodWorkFormInitial | null
  mode?: 'create' | 'edit'
  errorMessage?: string | null
  onSubmit: (values: BloodWorkFormValues) => void | Promise<void>
  onCancel?: () => void
}

const DEFAULT_MARKER_NAMES = ['CRP', 'ESR', 'WBC', 'Hb'] as const

/** Today as YYYY-MM-DD in IST. */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function defaultMarkerRows(): MarkerInputValue[] {
  return DEFAULT_MARKER_NAMES.map((name) => ({ ...EMPTY_MARKER, name }))
}

function fromInitial(
  initial: BloodWorkFormInitial | null | undefined,
): {
  date: string
  notes: string
  markers: MarkerInputValue[]
} {
  if (!initial) {
    return { date: todayIST(), notes: '', markers: defaultMarkerRows() }
  }
  return {
    date: initial.date ?? todayIST(),
    notes: initial.notes ?? '',
    markers:
      initial.markers && initial.markers.length > 0
        ? initial.markers.map((m) => ({
            name: m.name,
            value: Number.isFinite(m.value) ? String(m.value) : '',
            unit: m.unit,
            refRangeLow:
              m.refRangeLow !== undefined && Number.isFinite(m.refRangeLow)
                ? String(m.refRangeLow)
                : '',
            refRangeHigh:
              m.refRangeHigh !== undefined && Number.isFinite(m.refRangeHigh)
                ? String(m.refRangeHigh)
                : '',
          }))
        : defaultMarkerRows(),
  }
}

function rowsHaveAnyComplete(rows: MarkerInputValue[]): boolean {
  return rows.some((m) => isMarkerComplete(m))
}

function rowsHaveAnyError(rows: MarkerInputValue[]): boolean {
  return rows.some((m) => validateMarker(m) !== null)
}

function rowsToMarkers(rows: MarkerInputValue[]): BloodWorkMarker[] {
  // Drop fully-empty rows; keep complete rows. Partial rows are dropped too —
  // the submit guard already required ≥1 complete row.
  return rows
    .filter((m) => isMarkerComplete(m))
    .map((m) => {
      const out: BloodWorkMarker = {
        name: m.name.trim(),
        value: Number(m.value),
        unit: m.unit.trim(),
      }
      if (m.refRangeLow.trim().length > 0) {
        out.refRangeLow = Number(m.refRangeLow)
      }
      if (m.refRangeHigh.trim().length > 0) {
        out.refRangeHigh = Number(m.refRangeHigh)
      }
      if (
        out.refRangeLow !== undefined &&
        out.refRangeHigh !== undefined &&
        Number.isFinite(out.refRangeLow) &&
        Number.isFinite(out.refRangeHigh)
      ) {
        out.abnormal = out.value < out.refRangeLow || out.value > out.refRangeHigh
      }
      return out
    })
}

export function BloodWorkForm({
  initial,
  mode = 'create',
  errorMessage,
  onSubmit,
  onCancel,
}: BloodWorkFormProps): React.JSX.Element {
  const formId = useId()
  const initialState = fromInitial(initial)
  const [date, setDate] = useState<string>(initialState.date)
  const [notes, setNotes] = useState<string>(initialState.notes)
  const [rows, setRows] = useState<MarkerInputValue[]>(initialState.markers)
  const [submitting, setSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (!initial) return
    const next = fromInitial(initial)
    setDate(next.date)
    setNotes(next.notes)
    setRows(next.markers)
  }, [initial])

  const hasComplete = rowsHaveAnyComplete(rows)
  const hasError = rowsHaveAnyError(rows)
  // Blood work is a record of a past test — future dates are not valid.
  // Mirrors the backend `bloodWork.future_date` guard so the UI rejects
  // before the round-trip; backend stays authoritative.
  const today = todayIST()
  const isFutureDate = date > today
  const canSubmit = hasComplete && !hasError && !isFutureDate && !submitting

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        date,
        markers: rowsToMarkers(rows),
        notes: notes.trim(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  function updateRow(index: number, next: MarkerInputValue): void {
    setRows((rs) => rs.map((r, i) => (i === index ? next : r)))
  }

  function removeRow(index: number): void {
    setRows((rs) => rs.filter((_, i) => i !== index))
  }

  function addRow(): void {
    setRows((rs) => [...rs, { ...EMPTY_MARKER }])
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="blood-work-form"
      className="rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        color: 'var(--ink)',
      }}
    >
      <h2
        id={`${formId}-title`}
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: '1.25rem',
          lineHeight: 1.2,
          fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
        }}
      >
        {mode === 'edit' ? 'Edit blood work' : 'Log blood work'}
      </h2>

      <div className="mt-5 grid gap-4">
        <label htmlFor={`${formId}-date`} className="block">
          <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
            When was the test?
          </span>
          <input
            id={`${formId}-date`}
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            data-testid="blood-work-form-date"
            className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          />
          {isFutureDate ? (
            <p
              data-testid="blood-work-form-future-date-error"
              className="mt-1 text-[13px]"
              style={{ color: 'var(--terracotta)' }}
            >
              Pick today or a past date — blood work logs results that already came back.
            </p>
          ) : null}
        </label>

        <p
          className="type-body"
          style={{ color: 'var(--ink-muted)' }}
          data-testid="blood-work-default-hint"
        >
          Common autoimmune markers (remove any you don&rsquo;t have)
        </p>

        <ul data-testid="blood-work-marker-list" className="grid gap-3">
          {rows.map((m, i) => (
            <li key={i}>
              <MarkerInput
                marker={m}
                index={i}
                onChange={(next) => updateRow(i, next)}
                onRemove={() => removeRow(i)}
              />
            </li>
          ))}
        </ul>

        <div>
          <button
            type="button"
            onClick={addRow}
            data-testid="blood-work-add-marker"
            className="rounded-full border px-5 py-2 text-[14px]"
            style={{
              borderColor: 'var(--rule)',
              color: 'var(--ink)',
              background: 'transparent',
            }}
          >
            + Add another marker
          </button>
        </div>

        <label htmlFor={`${formId}-notes`} className="block">
          <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Notes
          </span>
          <textarea
            id={`${formId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you want to remember (optional)"
            rows={3}
            className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          />
        </label>
      </div>

      {errorMessage ? (
        <p
          data-testid="blood-work-form-error"
          role="alert"
          className="mt-4 type-body"
          style={{ color: 'var(--terracotta)' }}
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-full px-5 text-[15px] font-medium"
            style={{
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--rule)',
            }}
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="blood-work-form-submit"
          className="min-h-12 rounded-full px-6 text-[15px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--sage-deep)',
            color: 'var(--bg-elevated)',
          }}
        >
          {mode === 'edit' ? 'Save changes' : 'Save results'}
        </button>
      </div>
    </form>
  )
}
