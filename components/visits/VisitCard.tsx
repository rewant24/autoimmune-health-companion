'use client'

/**
 * VisitCard — list-row presentation of a single doctor visit.
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.3.
 *
 * Visual rhythm matches the Memory list (per spec): date (lg), doctor +
 * specialty (md), visitType pill (sm), notes preview (truncated). The
 * pill is color-coded by visit type.
 *
 * Edit + delete affordances surface inline. Delete fires onDelete (the
 * page wraps a confirm dialog). Tap on the card body fires onEdit.
 */

import type { VisitType } from './VisitForm'

export interface VisitRowLike {
  _id: string
  date: string
  doctorName: string
  specialty?: string
  visitType: VisitType
  notes?: string
}

export interface VisitCardProps {
  visit: VisitRowLike
  /**
   * F05 fix-pass: tap on the card body. Defaults to onEdit (back-compat for
   * callers that haven't been updated yet) so the existing 5.B tests keep
   * passing while the list page routes to the detail view.
   */
  onOpen?: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const TYPE_PILL_COLORS: Record<VisitType, { bg: string; ink: string }> = {
  consultation: { bg: 'var(--sage-soft)', ink: 'var(--sage-deep)' },
  'follow-up': { bg: 'var(--sand-soft, #f5efe6)', ink: 'var(--ink)' },
  urgent: { bg: 'rgba(220, 38, 38, 0.10)', ink: 'rgb(153, 27, 27)' },
  other: { bg: 'var(--bg-card)', ink: 'var(--ink-muted)' },
}

const TYPE_LABELS: Record<VisitType, string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Other',
}

/** Display-friendly date — e.g. "Mon 28 Apr 2026". Falls back to raw on parse fail. */
function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; parsing as Date can shift on UTC. Manually split.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (Number.isNaN(dt.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt)
}

export function VisitCard({
  visit,
  onOpen,
  onEdit,
  onDelete,
}: VisitCardProps): React.JSX.Element {
  const pill = TYPE_PILL_COLORS[visit.visitType]
  const handleBodyTap = onOpen ?? onEdit
  return (
    <article
      data-testid={`visit-card-${visit._id}`}
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <button
        type="button"
        onClick={() => handleBodyTap(visit._id)}
        data-testid={`visit-card-body-${visit._id}`}
        className="flex w-full flex-col gap-2 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-[var(--ink-muted)]">
              {formatDate(visit.date)}
            </p>
            <p className="text-base font-medium text-[var(--ink)]">
              {visit.doctorName}
              {visit.specialty ? (
                <span className="text-[var(--ink-muted)]"> · {visit.specialty}</span>
              ) : null}
            </p>
          </div>
          <span
            data-testid={`visit-type-pill-${visit._id}`}
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: pill.bg, color: pill.ink }}
          >
            {TYPE_LABELS[visit.visitType]}
          </span>
        </div>
        {visit.notes && (
          <p className="line-clamp-2 text-sm text-[var(--ink-muted)]">
            {visit.notes}
          </p>
        )}
      </button>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(visit._id)}
          data-testid={`visit-edit-${visit._id}`}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(visit._id)}
          data-testid={`visit-delete-${visit._id}`}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--danger,#b91c1c)] hover:opacity-80"
        >
          Delete
        </button>
      </div>
    </article>
  )
}
