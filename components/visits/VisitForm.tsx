'use client'

/**
 * VisitForm — manual capture form for doctor visits.
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.1.
 *
 * Locked copy (per docs/features/05-doctor-visits.md US-5.B.1):
 *   - Form title: "Log a doctor visit"
 *   - Date label: "When?"
 *   - Doctor label: "Who did you see?"
 *   - Specialty placeholder: "e.g. Rheumatologist (optional)"
 *   - Visit-type label: "Type of visit"
 *   - Notes placeholder: "Anything you want to remember (optional)"
 *   - Submit: "Save visit"
 *
 * Validation: submit disabled until date + doctorName + visitType filled.
 * Inline error surfaces under each field on first submit attempt.
 *
 * Pure UI — the page wrapper handles `createVisit` / `updateVisit`. The
 * form is mode-agnostic (create vs edit) — pre-fill via `initial` prop.
 */

import { useId, useMemo, useState } from 'react'

export type VisitType = 'consultation' | 'follow-up' | 'urgent' | 'other'

export interface VisitFormValue {
  date: string // YYYY-MM-DD
  doctorName: string
  specialty: string
  visitType: VisitType | ''
  notes: string
}

export interface VisitFormProps {
  /** Initial values (edit mode); defaults to empty + today's date. */
  initial?: Partial<VisitFormValue>
  /** Submit handler — receives normalized + validated values. */
  onSubmit: (value: {
    date: string
    doctorName: string
    specialty?: string
    visitType: VisitType
    notes?: string
  }) => void | Promise<void>
  /** Cancel/back affordance (page provides). */
  onCancel?: () => void
  /** Submit button label override. */
  submitLabel?: string
  /** External "submitting" flag — disables the button + shows working state. */
  isSubmitting?: boolean
}

const VISIT_TYPES: ReadonlyArray<{ id: VisitType; label: string }> = [
  { id: 'consultation', label: 'Consultation' },
  { id: 'follow-up', label: 'Follow-up' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'other', label: 'Other' },
]

/** YYYY-MM-DD in device-local timezone. */
function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isValidVisit(value: VisitFormValue): boolean {
  if (value.date.trim().length === 0) return false
  if (value.doctorName.trim().length === 0) return false
  if (value.visitType === '') return false
  return true
}

export function VisitForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Save visit',
  isSubmitting = false,
}: VisitFormProps): React.JSX.Element {
  const dateId = useId()
  const doctorId = useId()
  const specialtyId = useId()
  const visitTypeId = useId()
  const notesId = useId()

  const [value, setValue] = useState<VisitFormValue>(() => ({
    date: initial?.date ?? todayIsoDate(),
    doctorName: initial?.doctorName ?? '',
    specialty: initial?.specialty ?? '',
    visitType: (initial?.visitType as VisitType | undefined) ?? '',
    notes: initial?.notes ?? '',
  }))
  const [touched, setTouched] = useState(false)

  const valid = useMemo(() => isValidVisit(value), [value])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid || isSubmitting) return
    const trimmedSpecialty = value.specialty.trim()
    const trimmedNotes = value.notes.trim()
    await onSubmit({
      date: value.date,
      doctorName: value.doctorName.trim(),
      ...(trimmedSpecialty.length > 0 ? { specialty: trimmedSpecialty } : {}),
      visitType: value.visitType as VisitType,
      ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
    })
  }

  const showDateError =
    touched && value.date.trim().length === 0
  const showDoctorError =
    touched && value.doctorName.trim().length === 0
  const showVisitTypeError = touched && value.visitType === ''

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="visit-form"
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={dateId} className="type-label text-[var(--ink-muted)]">
          When?
        </label>
        <input
          id={dateId}
          type="date"
          required
          value={value.date}
          onChange={(e) =>
            setValue((prev) => ({ ...prev, date: e.target.value }))
          }
          data-testid="visit-date-input"
          className={
            'h-12 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
            'px-4 text-base text-[var(--ink)] ' +
            'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-2 ' +
            'focus:ring-[var(--sage-soft)]'
          }
        />
        {showDateError && (
          <p
            role="alert"
            data-testid="visit-date-error"
            className="text-sm text-[var(--danger,#b91c1c)]"
          >
            Pick a date.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={doctorId} className="type-label text-[var(--ink-muted)]">
          Who did you see?
        </label>
        <input
          id={doctorId}
          type="text"
          required
          value={value.doctorName}
          onChange={(e) =>
            setValue((prev) => ({ ...prev, doctorName: e.target.value }))
          }
          placeholder="e.g. Dr. Mehta"
          data-testid="visit-doctor-input"
          className={
            'h-12 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
            'px-4 text-base text-[var(--ink)] placeholder:text-[var(--ink-subtle)] ' +
            'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-2 ' +
            'focus:ring-[var(--sage-soft)]'
          }
        />
        {showDoctorError && (
          <p
            role="alert"
            data-testid="visit-doctor-error"
            className="text-sm text-[var(--danger,#b91c1c)]"
          >
            Add the doctor&rsquo;s name.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={specialtyId}
          className="type-label text-[var(--ink-muted)]"
        >
          Specialty
        </label>
        {/* F05 fix-pass: free-form input replaces the hardcoded dropdown.
            Patients see specialists outside the canned list (e.g. "Hand
            specialist", "Pain management"), and forcing them to pick "Other"
            loses information. */}
        <input
          id={specialtyId}
          type="text"
          value={value.specialty}
          onChange={(e) =>
            setValue((prev) => ({ ...prev, specialty: e.target.value }))
          }
          placeholder="e.g. Rheumatologist (optional)"
          data-testid="visit-specialty-input"
          className={
            'h-12 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
            'px-4 text-base text-[var(--ink)] placeholder:text-[var(--ink-subtle)] ' +
            'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-2 ' +
            'focus:ring-[var(--sage-soft)]'
          }
        />
      </div>

      <fieldset className="flex flex-col gap-2" data-testid="visit-type-group">
        <legend
          id={visitTypeId}
          className="type-label text-[var(--ink-muted)]"
        >
          Type of visit
        </legend>
        <div
          role="radiogroup"
          aria-labelledby={visitTypeId}
          className="grid grid-cols-2 gap-2"
        >
          {VISIT_TYPES.map((vt) => {
            const selected = value.visitType === vt.id
            return (
              <button
                key={vt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  setValue((prev) => ({ ...prev, visitType: vt.id }))
                }
                data-testid={`visit-type-${vt.id}`}
                data-selected={selected}
                className={
                  'h-12 w-full rounded-lg border px-4 text-base transition-colors ' +
                  (selected
                    ? 'border-[var(--sage-deep)] bg-[var(--sage-soft)] text-[var(--ink)]'
                    : 'border-[var(--rule)] bg-[var(--bg-card)] text-[var(--ink)] hover:border-[var(--sage)]')
                }
              >
                {vt.label}
              </button>
            )
          })}
        </div>
        {showVisitTypeError && (
          <p
            role="alert"
            data-testid="visit-type-error"
            className="text-sm text-[var(--danger,#b91c1c)]"
          >
            Pick a visit type.
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={notesId} className="type-label text-[var(--ink-muted)]">
          Notes
        </label>
        <textarea
          id={notesId}
          rows={4}
          value={value.notes}
          onChange={(e) =>
            setValue((prev) => ({ ...prev, notes: e.target.value }))
          }
          placeholder="Anything you want to remember (optional)"
          data-testid="visit-notes-input"
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
          data-testid="visit-submit"
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
            data-testid="visit-cancel"
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
