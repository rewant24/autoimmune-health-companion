'use client'

/**
 * MedicationCard — single regimen row.
 *
 * F04 Cycle 1, Chunk 4.B, US-4.B.2 (edit/deactivate) + US-4.B.3 (dose change).
 *
 * Visual hierarchy per spec:
 *   - name (lg)
 *   - dose (md)
 *   - frequency (md, secondary)
 *   - category pill (sm)
 *
 * Action affordances:
 *   - Tap row → onEdit (opens AddMedicationSheet pre-filled).
 *   - "Dose change" inline button → onDoseChange (opens DosageChangeDialog).
 *   - "Deactivate" inline button → onDeactivate (parent owns confirm dialog).
 *
 * Long-press / `⋯` menu from spec is folded into two visible buttons here
 * for Cycle 1 simplicity. A menu can land later without changing the
 * surface this card exposes.
 */

import type { MedCategory } from './AddMedicationSheet'

const CATEGORY_LABELS: Record<MedCategory, string> = {
  'arthritis-focused': 'Arthritis-focused',
  immunosuppressant: 'Immunosuppressant',
  steroid: 'Steroid',
  nsaid: 'NSAID',
  antidepressant: 'Antidepressant',
  supplement: 'Supplement',
  other: 'Other',
}

export interface MedicationCardData {
  id: string
  name: string
  dose: string
  frequency: string
  category: MedCategory
}

export interface MedicationCardProps {
  medication: MedicationCardData
  onEdit: (id: string) => void
  onDoseChange: (id: string) => void
  onDeactivate: (id: string) => void
}

export function MedicationCard({
  medication,
  onEdit,
  onDoseChange,
  onDeactivate,
}: MedicationCardProps): React.JSX.Element {
  return (
    <article
      data-testid={`medication-card-${medication.id}`}
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        color: 'var(--ink)',
      }}
    >
      <button
        type="button"
        onClick={() => onEdit(medication.id)}
        className="block w-full text-left"
        style={{ background: 'transparent', color: 'inherit' }}
        aria-label={`Edit ${medication.name}`}
      >
        <h3
          className="text-lg"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          }}
        >
          {medication.name}
        </h3>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--ink)' }}>
          {medication.dose}
        </p>
        <p
          className="mt-0.5 text-[14px]"
          style={{ color: 'var(--ink-muted)' }}
        >
          {medication.frequency}
        </p>
        <span
          className="mt-3 inline-block rounded-full border px-3 py-1 text-[12px]"
          style={{
            borderColor: 'var(--rule)',
            color: 'var(--ink-muted)',
            background: 'var(--bg-elevated)',
          }}
        >
          {CATEGORY_LABELS[medication.category]}
        </span>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDoseChange(medication.id)}
          className="rounded-full border px-4 py-2 text-[13px]"
          style={{
            borderColor: 'var(--rule)',
            color: 'var(--ink)',
            background: 'transparent',
          }}
        >
          Dose change
        </button>
        <button
          type="button"
          onClick={() => onDeactivate(medication.id)}
          className="rounded-full border px-4 py-2 text-[13px]"
          style={{
            borderColor: 'var(--rule)',
            color: 'var(--ink-muted)',
            background: 'transparent',
          }}
        >
          Deactivate
        </button>
      </div>
    </article>
  )
}
