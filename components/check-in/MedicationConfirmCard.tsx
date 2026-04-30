'use client'

/**
 * MedicationConfirmCard — F04 chunk 4.C, US-4.C.3.
 *
 * Renders inside the check-in summary step (above the existing per-metric
 * recap) when the medication extractor detects a dosage-change mention.
 * One card per detected change — the user confirms (write happens) or
 * dismisses (silent drop).
 *
 * Visual vocabulary mirrors `ConfirmSummary` (F01 C2): sage card, two-button
 * row with primary "Save" + secondary "Not now". Title carries the
 * medication name; body shows the spoken dose mapping.
 *
 * The Convex write (`recordDosageChange`) is the parent's responsibility —
 * this component is presentational + emits two callbacks. That keeps the
 * check-in summary's save sequencing (`createCheckin` → THEN
 * `recordDosageChange` with the resulting `checkInId`) in one place.
 */

import { useState } from 'react'

export interface MedicationConfirmCardProps {
  medicationName: string
  oldDose: string
  newDose: string
  /** Optional reason captured by the extractor; rendered as subtext if present. */
  reason?: string
  onConfirm: () => void | Promise<void>
  onDismiss: () => void
  /** Test seam for the testid prefix. Defaults to `medication-confirm-card`. */
  testId?: string
}

export function MedicationConfirmCard({
  medicationName,
  oldDose,
  newDose,
  reason,
  onConfirm,
  onDismiss,
  testId = 'medication-confirm-card',
}: MedicationConfirmCardProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'saved' | 'dismissed' | null>(null)

  const handleConfirm = async (): Promise<void> => {
    if (busy || done) return
    setBusy(true)
    try {
      await onConfirm()
      setDone('saved')
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = (): void => {
    if (busy || done) return
    setDone('dismissed')
    onDismiss()
  }

  if (done === 'saved') {
    return (
      <section
        data-testid={testId}
        data-state="saved"
        className="mx-6 mt-4 rounded-2xl border p-6"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-card)',
        }}
      >
        <p className="type-label">Dose change</p>
        <p className="type-body mt-2" style={{ color: 'var(--ink-muted)' }}>
          Saved {medicationName} → {newDose}.
        </p>
      </section>
    )
  }

  if (done === 'dismissed') {
    // Silent — render nothing per US-4.C.3 ("if user dismisses: no toast").
    return <></>
  }

  return (
    <section
      data-testid={testId}
      data-state="prompt"
      className="mx-6 mt-4 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <p className="type-label">Dose change for {medicationName}?</p>
      <h3
        className="mt-3"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: '1.125rem',
          lineHeight: 1.25,
          fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          color: 'var(--ink)',
        }}
      >
        I heard: {oldDose} → {newDose}
      </h3>
      {reason ? (
        <p
          className="type-body mt-2"
          style={{ color: 'var(--ink-muted)' }}
          data-testid={`${testId}-reason`}
        >
          {reason}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid={`${testId}-confirm`}
          disabled={busy}
          onClick={handleConfirm}
          className={
            'inline-flex min-h-11 items-center justify-center rounded-full ' +
            'px-5 text-[15px] font-medium transition-colors ' +
            'focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-offset-2 disabled:opacity-60'
          }
          style={{
            background: 'var(--sage-deep)',
            color: 'var(--bg-elevated)',
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          data-testid={`${testId}-dismiss`}
          disabled={busy}
          onClick={handleDismiss}
          className={
            'inline-flex min-h-11 items-center justify-center rounded-full ' +
            'border px-5 text-[15px] font-medium transition-colors ' +
            'focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-offset-2 disabled:opacity-60'
          }
          style={{
            borderColor: 'var(--rule)',
            color: 'var(--ink)',
            background: 'transparent',
          }}
        >
          Not now
        </button>
      </div>
    </section>
  )
}
