'use client'

/**
 * DosageChangeDialog — record a dose change for an existing medication.
 *
 * F04 Cycle 1, Chunk 4.B, US-4.B.3.
 *
 * Inputs:
 *   - new dose (required, must differ from current)
 *   - reason (optional, freeform single-line)
 *
 * Save is disabled until newDose is non-empty AND differs from currentDose
 * (after trim). The current dose is shown as read-only context.
 *
 * Like AddMedicationSheet, this component is purely controlled — it owns
 * no Convex calls. The parent calls `recordDosageChange` with
 * `source: 'module'` per the spec.
 */

import { useEffect, useId, useState } from 'react'

export interface DosageChangeValues {
  newDose: string
  reason: string | null
}

export interface DosageChangeDialogProps {
  open: boolean
  medicationName: string
  currentDose: string
  onSubmit: (values: DosageChangeValues) => void | Promise<void>
  onCancel: () => void
}

export function DosageChangeDialog({
  open,
  medicationName,
  currentDose,
  onSubmit,
  onCancel,
}: DosageChangeDialogProps): React.JSX.Element | null {
  const [newDose, setNewDose] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const formId = useId()

  useEffect(() => {
    if (!open) return
    setNewDose('')
    setReason('')
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const trimmedNew = newDose.trim()
  const canSubmit =
    trimmedNew.length > 0 && trimmedNew !== currentDose.trim() && !submitting

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        newDose: trimmedNew,
        reason: reason.trim().length === 0 ? null : reason.trim(),
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
      data-testid="dosage-change-dialog"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(20, 24, 26, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-2xl border p-6 sm:rounded-2xl"
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
          Dose change
        </h2>
        <p
          className="mt-2 text-[14px]"
          style={{ color: 'var(--ink-muted)' }}
        >
          What did your doctor change it to?
        </p>

        <div className="mt-5 grid gap-4">
          <div>
            <span
              className="type-label"
              style={{ color: 'var(--ink-muted)' }}
            >
              {medicationName} — current
            </span>
            <p
              className="mt-1 rounded-xl border px-4 py-3 text-[15px]"
              data-testid="dosage-change-current-dose"
              style={{
                borderColor: 'var(--rule)',
                background: 'var(--bg-card)',
                color: 'var(--ink-muted)',
              }}
            >
              {currentDose}
            </p>
          </div>

          <label htmlFor={`${formId}-new-dose`} className="block">
            <span
              className="type-label"
              style={{ color: 'var(--ink-muted)' }}
            >
              New dose
            </span>
            <input
              id={`${formId}-new-dose`}
              type="text"
              value={newDose}
              onChange={(e) => setNewDose(e.target.value)}
              autoFocus
              className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
              style={{
                borderColor: 'var(--rule)',
                background: 'var(--bg-card)',
                color: 'var(--ink)',
              }}
            />
          </label>

          <label htmlFor={`${formId}-reason`} className="block">
            <span
              className="type-label"
              style={{ color: 'var(--ink-muted)' }}
            >
              Reason (optional)
            </span>
            <input
              id={`${formId}-reason`}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? (optional — e.g., 'flare', 'tapering', 'side effects')"
              className="mt-1 block w-full rounded-xl border px-4 py-3 text-[15px]"
              style={{
                borderColor: 'var(--rule)',
                background: 'var(--bg-card)',
                color: 'var(--ink)',
              }}
            />
          </label>
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
            data-testid="dosage-change-submit"
            className="min-h-12 rounded-full px-6 text-[15px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            Save change
          </button>
        </div>
      </form>
    </div>
  )
}
