'use client'

/**
 * AddMedicationSheet — bottom-sheet form for add OR edit of a medication.
 *
 * F04 Cycle 1, Chunk 4.B, US-4.B.1 (setup wizard reuses this) + US-4.B.2
 * (edit pre-fills `initial`).
 *
 * Voice-first regimen entry is deferred to Cycle 2 (ADR-030). This sheet
 * is the structured-form path that ships in C1.
 *
 * The component is purely controlled — it owns no Convex calls. The parent
 * passes `onSubmit(values)`; the parent decides whether to call
 * `createMedication` (add) or `updateMedication` (edit). This keeps the
 * Convex API surface consumed in exactly two places (the page-level
 * containers) and lets the test render the sheet with a plain spy.
 *
 * Field rules per docs/features/04-medications.md US-4.B.1:
 *   - name (required, free-form, trimmed non-empty)
 *   - dose (required, free-form, trimmed non-empty)
 *   - frequency (required, free-form, trimmed non-empty)
 *   - category (required, locked enum)
 *   - delivery (required, locked enum)
 *
 * Submit is disabled until all five validate.
 */

import { useEffect, useId, useState } from 'react'

export const MED_CATEGORIES = [
  'arthritis-focused',
  'immunosuppressant',
  'steroid',
  'nsaid',
  'antidepressant',
  'supplement',
  'other',
] as const

export const MED_DELIVERIES = ['oral', 'injectable', 'iv', 'other'] as const

export type MedCategory = (typeof MED_CATEGORIES)[number]
export type MedDelivery = (typeof MED_DELIVERIES)[number]

const CATEGORY_LABELS: Record<MedCategory, string> = {
  'arthritis-focused': 'Arthritis-focused',
  immunosuppressant: 'Immunosuppressant',
  steroid: 'Steroid',
  nsaid: 'NSAID',
  antidepressant: 'Antidepressant',
  supplement: 'Supplement',
  other: 'Other',
}

const DELIVERY_LABELS: Record<MedDelivery, string> = {
  oral: 'Oral',
  injectable: 'Injectable',
  iv: 'IV',
  other: 'Other',
}

export interface MedicationFormValues {
  name: string
  dose: string
  frequency: string
  category: MedCategory
  delivery: MedDelivery
}

export interface AddMedicationSheetProps {
  open: boolean
  /** Pre-fill for edit mode; absent = blank "add" sheet. */
  initial?: Partial<MedicationFormValues> | null
  /**
   * "add" mode shows "Save medication"; "edit" shows "Save changes".
   * Defaults to "add".
   */
  mode?: 'add' | 'edit'
  onSubmit: (values: MedicationFormValues) => void | Promise<void>
  onCancel: () => void
}

const EMPTY: MedicationFormValues = {
  name: '',
  dose: '',
  frequency: '',
  category: 'other',
  delivery: 'oral',
}

function isComplete(v: MedicationFormValues): boolean {
  return (
    v.name.trim().length > 0 &&
    v.dose.trim().length > 0 &&
    v.frequency.trim().length > 0
  )
}

export function AddMedicationSheet({
  open,
  initial,
  mode = 'add',
  onSubmit,
  onCancel,
}: AddMedicationSheetProps): React.JSX.Element | null {
  const [values, setValues] = useState<MedicationFormValues>(EMPTY)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const formId = useId()

  useEffect(() => {
    if (!open) return
    setValues({
      name: initial?.name ?? '',
      dose: initial?.dose ?? '',
      frequency: initial?.frequency ?? '',
      category: initial?.category ?? 'other',
      delivery: initial?.delivery ?? 'oral',
    })
    setSubmitting(false)
  }, [open, initial])

  if (!open) return null

  const canSubmit = isComplete(values) && !submitting

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        dose: values.dose.trim(),
        frequency: values.frequency.trim(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
      data-testid="add-medication-sheet"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(20, 24, 26, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-t-2xl border p-6 sm:rounded-2xl"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--rule)',
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
          {mode === 'edit' ? 'Edit medication' : 'Add a medication'}
        </h2>

        <div className="mt-5 grid gap-4">
          <Field
            id={`${formId}-name`}
            label="Name"
            placeholder="e.g. Methotrexate"
            value={values.name}
            onChange={(name) => setValues((v) => ({ ...v, name }))}
            autoFocus
          />
          <Field
            id={`${formId}-dose`}
            label="Dose"
            placeholder="e.g. 15mg, 1 tablet"
            value={values.dose}
            onChange={(dose) => setValues((v) => ({ ...v, dose }))}
          />
          <Field
            id={`${formId}-frequency`}
            label="Frequency"
            placeholder="e.g. once daily, twice weekly"
            value={values.frequency}
            onChange={(frequency) => setValues((v) => ({ ...v, frequency }))}
          />
          <Select
            id={`${formId}-category`}
            label="Category"
            value={values.category}
            options={MED_CATEGORIES.map((c) => ({
              value: c,
              label: CATEGORY_LABELS[c],
            }))}
            onChange={(category) =>
              setValues((v) => ({ ...v, category: category as MedCategory }))
            }
          />
          <Select
            id={`${formId}-delivery`}
            label="Delivery"
            value={values.delivery}
            options={MED_DELIVERIES.map((d) => ({
              value: d,
              label: DELIVERY_LABELS[d],
            }))}
            onChange={(delivery) =>
              setValues((v) => ({ ...v, delivery: delivery as MedDelivery }))
            }
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
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
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="add-medication-submit"
            className="min-h-12 rounded-full px-6 text-[15px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            {mode === 'edit' ? 'Save changes' : 'Save medication'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface FieldProps {
  id: string
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoFocus,
}: FieldProps): React.JSX.Element {
  return (
    <label htmlFor={id} className="block">
      <span
        className="type-label"
        style={{ color: 'var(--ink-muted)' }}
      >
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-card)',
          color: 'var(--ink)',
        }}
      />
    </label>
  )
}

interface SelectProps {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: SelectProps): React.JSX.Element {
  return (
    <label htmlFor={id} className="block">
      <span
        className="type-label"
        style={{ color: 'var(--ink-muted)' }}
      >
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-card)',
          color: 'var(--ink)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
