'use client'

/**
 * VisitForm — controlled form for create OR edit of a doctor visit.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.1 (create) + US-5.B.3 (edit pre-fill).
 *
 * Pure presentational. Parent passes `onSubmit(values)`; the parent decides
 * whether to call `createVisit` (add) or `updateVisit` (edit). Mirrors the
 * controlled-form vocabulary used by AddMedicationSheet — submit-disabled
 * until required fields validate, errorMessage surfaces inline, parent owns
 * Convex calls.
 *
 * Field rules per docs/features/05-doctor-visits.md US-5.B.1:
 *   - date (required, YYYY-MM-DD, defaults to today)
 *   - doctorName (required, trimmed non-empty)
 *   - specialty (optional, free-form)
 *   - visitType (required, locked enum)
 *   - notes (optional, multi-line)
 */

import { useEffect, useId, useState } from 'react'

export const VISIT_TYPES = [
  'consultation',
  'follow-up',
  'urgent',
  'other',
] as const

export type VisitType = (typeof VISIT_TYPES)[number]

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Other',
}

export interface VisitFormValues {
  date: string
  doctorName: string
  specialty: string
  visitType: VisitType
  notes: string
}

export interface VisitFormProps {
  initial?: Partial<VisitFormValues> | null
  /** "create" → "Save visit"; "edit" → "Save changes". Defaults to "create". */
  mode?: 'create' | 'edit'
  errorMessage?: string | null
  onSubmit: (values: VisitFormValues) => void | Promise<void>
  onCancel?: () => void
}

/** Today as YYYY-MM-DD in IST. Mirrors the helper used elsewhere in Saha. */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function isComplete(v: VisitFormValues): boolean {
  return (
    v.date.trim().length > 0 &&
    v.doctorName.trim().length > 0 &&
    v.visitType.length > 0
  )
}

export function VisitForm({
  initial,
  mode = 'create',
  errorMessage,
  onSubmit,
  onCancel,
}: VisitFormProps): React.JSX.Element {
  const formId = useId()
  const [values, setValues] = useState<VisitFormValues>(() => ({
    date: initial?.date ?? todayIST(),
    doctorName: initial?.doctorName ?? '',
    specialty: initial?.specialty ?? '',
    visitType: (initial?.visitType as VisitType) ?? 'consultation',
    notes: initial?.notes ?? '',
  }))
  const [submitting, setSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (!initial) return
    setValues({
      date: initial.date ?? todayIST(),
      doctorName: initial.doctorName ?? '',
      specialty: initial.specialty ?? '',
      visitType: (initial.visitType as VisitType) ?? 'consultation',
      notes: initial.notes ?? '',
    })
  }, [initial])

  const canSubmit = isComplete(values) && !submitting

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        date: values.date,
        doctorName: values.doctorName.trim(),
        specialty: values.specialty.trim(),
        visitType: values.visitType,
        notes: values.notes.trim(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="visit-form"
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
        {mode === 'edit' ? 'Edit doctor visit' : 'Log a doctor visit'}
      </h2>

      <div className="mt-5 grid gap-4">
        <label htmlFor={`${formId}-date`} className="block">
          <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
            When?
          </span>
          <input
            id={`${formId}-date`}
            type="date"
            value={values.date}
            onChange={(e) =>
              setValues((v) => ({ ...v, date: e.target.value }))
            }
            className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          />
        </label>

        <label htmlFor={`${formId}-doctor`} className="block">
          <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Who did you see?
          </span>
          <input
            id={`${formId}-doctor`}
            type="text"
            value={values.doctorName}
            onChange={(e) =>
              setValues((v) => ({ ...v, doctorName: e.target.value }))
            }
            placeholder="e.g. Dr. Mehta"
            autoFocus
            className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          />
        </label>

        <label htmlFor={`${formId}-specialty`} className="block">
          <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Specialty
          </span>
          <input
            id={`${formId}-specialty`}
            type="text"
            value={values.specialty}
            onChange={(e) =>
              setValues((v) => ({ ...v, specialty: e.target.value }))
            }
            placeholder="e.g. Rheumatologist (optional)"
            className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          />
        </label>

        <label htmlFor={`${formId}-type`} className="block">
          <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Type of visit
          </span>
          <select
            id={`${formId}-type`}
            value={values.visitType}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                visitType: e.target.value as VisitType,
              }))
            }
            className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          >
            {VISIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {VISIT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor={`${formId}-notes`} className="block">
          <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Notes
          </span>
          <textarea
            id={`${formId}-notes`}
            value={values.notes}
            onChange={(e) =>
              setValues((v) => ({ ...v, notes: e.target.value }))
            }
            placeholder="Anything you want to remember (optional)"
            rows={4}
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
          data-testid="visit-form-error"
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
          data-testid="visit-form-submit"
          className="min-h-12 rounded-full px-6 text-[15px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--sage-deep)',
            color: 'var(--bg-elevated)',
          }}
        >
          {mode === 'edit' ? 'Save changes' : 'Save visit'}
        </button>
      </div>
    </form>
  )
}
