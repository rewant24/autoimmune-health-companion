'use client'

/**
 * RegimenList — list of active medications with empty state.
 *
 * F04 Cycle 1, Chunk 4.B, US-4.B.2.
 *
 * Pure presentational. Parent passes `medications`; this component renders
 * either the empty state ("Your regimen is empty — add what you take.")
 * with the Add CTA, or the populated list of `MedicationCard`s.
 *
 * The Add affordance lives in the parent page (FAB pattern per spec) —
 * this component only owns the inline empty-state CTA.
 */

import { MedicationCard, type MedicationCardData } from './MedicationCard'

export interface RegimenListProps {
  /**
   * Loading state — parent passes `undefined` while the Convex query is
   * resolving. We render a quiet placeholder rather than the empty state
   * so the user never sees "regimen is empty" before data lands.
   */
  medications: MedicationCardData[] | undefined
  onAdd: () => void
  onEdit: (id: string) => void
  onDoseChange: (id: string) => void
  onDeactivate: (id: string) => void
}

export function RegimenList({
  medications,
  onAdd,
  onEdit,
  onDoseChange,
  onDeactivate,
}: RegimenListProps): React.JSX.Element {
  if (medications === undefined) {
    return (
      <div
        data-testid="regimen-list-loading"
        className="rounded-2xl border p-6"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-card)',
          color: 'var(--ink-muted)',
        }}
      >
        <p className="type-body">Loading your regimen…</p>
      </div>
    )
  }

  if (medications.length === 0) {
    return (
      <section
        data-testid="regimen-list-empty"
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
            lineHeight: 1.3,
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          }}
        >
          Your regimen is empty — add what you take.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={onAdd}
            data-testid="regimen-list-add-cta"
            className="min-h-12 rounded-full px-6 text-[15px] font-medium"
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            + Add medication
          </button>
        </div>
      </section>
    )
  }

  return (
    <ul
      data-testid="regimen-list"
      className="grid gap-3"
    >
      {medications.map((m) => (
        <li key={m.id}>
          <MedicationCard
            medication={m}
            onEdit={onEdit}
            onDoseChange={onDoseChange}
            onDeactivate={onDeactivate}
          />
        </li>
      ))}
    </ul>
  )
}
