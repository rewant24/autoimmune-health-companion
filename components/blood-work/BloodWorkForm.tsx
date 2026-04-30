'use client'

/**
 * BloodWorkForm — manual capture for blood-work results.
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.2.
 *
 * Locked copy (per docs/features/05-doctor-visits.md US-5.B.2):
 *   - Form title: "Log blood work"
 *   - Date label: "When was the test?"
 *   - Default-marker hint: "Common autoimmune markers (remove any you don't have)"
 *   - Add button: "+ Add another marker"
 *   - Submit: "Save results"
 *
 * Behaviour:
 *   - Default markers (CRP, ESR, WBC, Hb) appear pre-populated as empty
 *     fields with their canonical units. Each can be removed.
 *   - "Add marker" appends a freeform row.
 *   - Submit disabled until at least one marker has name + value + unit
 *     (matches the chunk-5.A schema requirement that empty `markers[]`
 *     is rejected).
 *   - On submit: numeric coercion; rows missing name/value/unit are
 *     dropped silently; abnormal flag is derived where both ref-range
 *     bounds are present (mirrors server-side derivation in 5.A).
 *
 * Notes textarea is optional and fed straight through.
 */

import { useId, useMemo, useState } from 'react'

import {
  MarkerInput,
  markerAbnormal,
  parseFinite,
  type MarkerValue,
} from './MarkerInput'

export interface MarkerSubmit {
  name: string
  value: number
  unit: string
  refRangeLow?: number
  refRangeHigh?: number
  abnormal?: boolean
}

export interface BloodWorkSubmit {
  date: string
  markers: MarkerSubmit[]
  notes?: string
}

export interface BloodWorkFormInitial {
  date?: string
  markers?: MarkerSubmit[]
  notes?: string
}

export interface BloodWorkFormProps {
  initial?: BloodWorkFormInitial
  onSubmit: (value: BloodWorkSubmit) => void | Promise<void>
  onCancel?: () => void
  submitLabel?: string
  isSubmitting?: boolean
}

interface DefaultMarker {
  name: string
  unit: string
}

/**
 * Default markers surfaced pre-populated. Per the chunk plan: CRP/ESR/WBC/Hb
 * with their canonical autoimmune-monitoring units. User fills value (and
 * optionally ref-range); empty rows are skipped on submit.
 */
const DEFAULT_MARKERS: ReadonlyArray<DefaultMarker> = [
  { name: 'CRP', unit: 'mg/L' },
  { name: 'ESR', unit: 'mm/hr' },
  { name: 'WBC', unit: '×10⁹/L' },
  { name: 'Hb', unit: 'g/dL' },
]

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

let keyCounter = 0
function freshKey(): string {
  keyCounter += 1
  return `marker_${keyCounter}_${Date.now().toString(36)}`
}

function emptyMarker(name = '', unit = ''): MarkerValue {
  return {
    key: freshKey(),
    name,
    value: '',
    unit,
    refRangeLow: '',
    refRangeHigh: '',
  }
}

function defaultMarkers(): MarkerValue[] {
  return DEFAULT_MARKERS.map((m) => emptyMarker(m.name, m.unit))
}

function fromInitial(submitMarkers: MarkerSubmit[]): MarkerValue[] {
  return submitMarkers.map((m) => ({
    key: freshKey(),
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
}

/**
 * Pure helper — count markers with all three required fields filled
 * (name + finite value + unit). Used by the Submit-disabled guard.
 */
export function countCompleteMarkers(markers: MarkerValue[]): number {
  let n = 0
  for (const m of markers) {
    if (m.name.trim().length === 0) continue
    if (m.unit.trim().length === 0) continue
    if (parseFinite(m.value) === undefined) continue
    n += 1
  }
  return n
}

/**
 * Build the submit payload from form state. Drops rows that don't have
 * name + finite value + unit; coerces numerics; derives `abnormal` when
 * both ref-range bounds are present and finite. Notes trimmed (omitted
 * if empty after trim). Date passed through.
 */
export function buildBloodWorkSubmit(
  date: string,
  markers: MarkerValue[],
  notes: string,
): BloodWorkSubmit {
  const out: MarkerSubmit[] = []
  for (const m of markers) {
    const name = m.name.trim()
    const unit = m.unit.trim()
    const value = parseFinite(m.value)
    if (name.length === 0 || unit.length === 0 || value === undefined) continue
    const low = parseFinite(m.refRangeLow)
    const high = parseFinite(m.refRangeHigh)
    const abnormal = markerAbnormal(value, low, high)
    out.push({
      name,
      value,
      unit,
      ...(low !== undefined ? { refRangeLow: low } : {}),
      ...(high !== undefined ? { refRangeHigh: high } : {}),
      ...(abnormal !== undefined ? { abnormal } : {}),
    })
  }
  const trimmedNotes = notes.trim()
  return {
    date,
    markers: out,
    ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
  }
}

export function BloodWorkForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Save results',
  isSubmitting = false,
}: BloodWorkFormProps): React.JSX.Element {
  const dateId = useId()
  const notesId = useId()

  const [date, setDate] = useState<string>(initial?.date ?? todayIsoDate())
  const [markers, setMarkers] = useState<MarkerValue[]>(() =>
    initial?.markers && initial.markers.length > 0
      ? fromInitial(initial.markers)
      : defaultMarkers(),
  )
  const [notes, setNotes] = useState<string>(initial?.notes ?? '')

  const completeCount = useMemo(
    () => countCompleteMarkers(markers),
    [markers],
  )
  const valid = completeCount >= 1 && date.trim().length > 0

  const updateMarker = (next: MarkerValue) => {
    setMarkers((prev) =>
      prev.map((m) => (m.key === next.key ? next : m)),
    )
  }

  const removeMarker = (key: string) => {
    setMarkers((prev) => prev.filter((m) => m.key !== key))
  }

  const addMarker = () => {
    setMarkers((prev) => [...prev, emptyMarker()])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || isSubmitting) return
    const payload = buildBloodWorkSubmit(date, markers, notes)
    if (payload.markers.length === 0) return
    await onSubmit(payload)
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="blood-work-form"
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={dateId} className="type-label text-[var(--ink-muted)]">
          When was the test?
        </label>
        <input
          id={dateId}
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="blood-work-date-input"
          className={
            'h-12 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
            'px-4 text-base text-[var(--ink)] ' +
            'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-2 ' +
            'focus:ring-[var(--sage-soft)]'
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="type-label text-[var(--ink-muted)]">
          Common autoimmune markers (remove any you don&rsquo;t have)
        </p>
        <div
          className="flex flex-col gap-2"
          data-testid="blood-work-markers"
          data-marker-count={markers.length}
          data-complete-count={completeCount}
        >
          {markers.map((m) => (
            <MarkerInput
              key={m.key}
              marker={m}
              onChange={updateMarker}
              onRemove={() => removeMarker(m.key)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addMarker}
          data-testid="blood-work-add-marker"
          className={
            'mt-1 inline-flex h-10 items-center justify-center self-start ' +
            'rounded-full border border-[var(--rule)] bg-transparent ' +
            'px-4 text-sm text-[var(--ink-muted)] hover:border-[var(--sage)] hover:text-[var(--ink)]'
          }
        >
          + Add another marker
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={notesId} className="type-label text-[var(--ink-muted)]">
          Notes
        </label>
        <textarea
          id={notesId}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional context (e.g. fasted, lab name)"
          data-testid="blood-work-notes-input"
          className={
            'w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
            'px-4 py-3 text-base text-[var(--ink)] placeholder:text-[var(--ink-subtle)] ' +
            'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-2 ' +
            'focus:ring-[var(--sage-soft)]'
          }
        />
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <button
          type="submit"
          disabled={!valid || isSubmitting}
          aria-disabled={!valid || isSubmitting}
          data-testid="blood-work-submit"
          className={
            'flex h-12 w-full items-center justify-center rounded-full ' +
            'bg-[var(--sage-deep)] text-[var(--bg-elevated)] font-medium ' +
            'transition-opacity duration-150 ' +
            'disabled:cursor-not-allowed disabled:opacity-60'
          }
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-testid="blood-work-cancel"
            className={
              'flex h-12 w-full items-center justify-center rounded-full ' +
              'border border-[var(--rule)] bg-transparent text-[var(--ink-muted)] ' +
              'transition-colors hover:border-[var(--sage)]'
            }
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
