'use client'

/**
 * /medications/setup — first-time regimen setup wizard.
 *
 * F04 Cycle 1, Chunk 4.B, US-4.B.1.
 *
 * Cycle 1 ships the structured-form path (per ADR-030); voice-first regimen
 * capture is deferred to Cycle 2 — *do not build it here*.
 *
 * UX:
 *   1. Header + sub explaining the wizard.
 *   2. Stack of saved medications (collapsed cards).
 *   3. Always-visible inline form below.
 *   4. After save: list grows; form resets so user can chain "add another";
 *      "I'm done for now" routes to /medications.
 *
 * The setup-nudge on /home auto-hides once `listActiveMedications` returns
 * ≥1, so a user who lands here, saves one med, and clicks "Done" sees the
 * nudge gone on /home.
 *
 * Convex API expectations: see /medications page header.
 */

import { useEffect, useId, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import {
  MED_CATEGORIES,
  MED_DELIVERIES,
  type MedCategory,
  type MedDelivery,
  type MedicationFormValues,
} from '@/components/medications/AddMedicationSheet'
import { readProfile } from '@/lib/profile/storage'

const TEST_USER_KEY = 'saha.testUser.v1'

function getOrCreateTestUserId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder'
  const existing = window.localStorage.getItem(TEST_USER_KEY)
  if (existing) return existing
  const fresh =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(36).slice(2)}_${Date.now()}`
  window.localStorage.setItem(TEST_USER_KEY, fresh)
  return fresh
}

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

const EMPTY: MedicationFormValues = {
  name: '',
  dose: '',
  frequency: '',
  category: 'other',
  delivery: 'oral',
}

type MedicationDoc = {
  _id: string
  name: string
  dose: string
  frequency: string
}

export default function MedicationsSetupPage(): React.JSX.Element {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean>(false)
  const [checked, setChecked] = useState<boolean>(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [values, setValues] = useState<MedicationFormValues>(EMPTY)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const formId = useId()

  useEffect(() => {
    const profile = readProfile()
    if (!profile || profile.onboarded !== true) {
      router.replace('/onboarding/1')
      setChecked(true)
      return
    }
    setUserId(getOrCreateTestUserId())
    setAllowed(true)
    setChecked(true)
  }, [router])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meds = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).medications?.listActiveMedications,
    userId === null ? 'skip' : { userId },
  ) as MedicationDoc[] | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMedication = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).medications?.createMedication,
  )

  if (!checked || !allowed) {
    return (
      <main
        data-testid="medications-setup-pending"
        className="grain min-h-screen"
        style={{ background: 'var(--bg)' }}
      />
    )
  }

  const canSubmit =
    values.name.trim().length > 0 &&
    values.dose.trim().length > 0 &&
    values.frequency.trim().length > 0 &&
    !submitting

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit || userId === null) return
    setSubmitting(true)
    try {
      await createMedication({
        userId,
        name: values.name.trim(),
        dose: values.dose.trim(),
        frequency: values.frequency.trim(),
        category: values.category,
        delivery: values.delivery,
      })
      setValues(EMPTY)
    } finally {
      setSubmitting(false)
    }
  }

  const hasSaved = meds !== undefined && meds.length > 0

  return (
    <main
      data-testid="medications-setup-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6">
          <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Setup
          </p>
          <h1
            className="mt-2"
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: '1.75rem',
              lineHeight: 1.15,
              fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
            }}
          >
            Tell me what you take.
          </h1>
          <p
            className="mt-2 type-body"
            style={{ color: 'var(--ink-muted)' }}
          >
            You can edit any of this later.
          </p>
        </header>

        {hasSaved ? (
          <section
            data-testid="medications-setup-saved"
            className="mb-6 grid gap-3"
            aria-label="Saved medications"
          >
            {meds.map((m) => (
              <div
                key={m._id}
                className="rounded-2xl border p-4"
                style={{
                  borderColor: 'var(--rule)',
                  background: 'var(--bg-card)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-fraunces)',
                    fontSize: '1rem',
                    lineHeight: 1.2,
                    fontVariationSettings:
                      "'SOFT' 100, 'opsz' 24, 'wght' 420",
                  }}
                >
                  {m.name}
                </p>
                <p
                  className="mt-1 text-[14px]"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {m.dose} · {m.frequency}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        <form
          onSubmit={handleSubmit}
          aria-label="Add medication form"
          className="rounded-2xl border p-6"
          style={{
            borderColor: 'var(--rule)',
            background: 'var(--bg-card)',
            color: 'var(--ink)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: '1.125rem',
              lineHeight: 1.2,
              fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
            }}
          >
            {hasSaved ? 'Add another' : 'Add your first medication'}
          </p>

          <div className="mt-5 grid gap-4">
            <FieldRow
              id={`${formId}-name`}
              label="Name"
              placeholder="e.g. Methotrexate"
              value={values.name}
              onChange={(name) => setValues((v) => ({ ...v, name }))}
            />
            <FieldRow
              id={`${formId}-dose`}
              label="Dose"
              placeholder="e.g. 15mg, 1 tablet"
              value={values.dose}
              onChange={(dose) => setValues((v) => ({ ...v, dose }))}
            />
            <FieldRow
              id={`${formId}-frequency`}
              label="Frequency"
              placeholder="e.g. once daily, twice weekly"
              value={values.frequency}
              onChange={(frequency) => setValues((v) => ({ ...v, frequency }))}
            />
            <SelectRow
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
            <SelectRow
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
              type="submit"
              disabled={!canSubmit}
              data-testid="medications-setup-submit"
              className="min-h-12 rounded-full px-6 text-[15px] font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--sage-deep)',
                color: 'var(--bg-elevated)',
              }}
            >
              Save medication
            </button>
          </div>
        </form>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => router.push('/medications')}
            data-testid="medications-setup-done"
            className="min-h-12 rounded-full px-6 text-[15px] font-medium"
            style={{
              background: hasSaved ? 'var(--sage-deep)' : 'transparent',
              color: hasSaved ? 'var(--bg-elevated)' : 'var(--ink-muted)',
              border: hasSaved ? 'none' : '1px solid var(--rule)',
            }}
          >
            I&apos;m done for now
          </button>
        </div>
      </div>
    </main>
  )
}

interface FieldRowProps {
  id: string
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

function FieldRow({
  id,
  label,
  placeholder,
  value,
  onChange,
}: FieldRowProps): React.JSX.Element {
  return (
    <label htmlFor={id} className="block">
      <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-elevated)',
          color: 'var(--ink)',
        }}
      />
    </label>
  )
}

interface SelectRowProps {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function SelectRow({
  id,
  label,
  value,
  options,
  onChange,
}: SelectRowProps): React.JSX.Element {
  return (
    <label htmlFor={id} className="block">
      <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-elevated)',
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
