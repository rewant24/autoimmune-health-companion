'use client'

/**
 * VisitCard — single doctor-visit row in the /visits list.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.3.
 *
 * Visual hierarchy per spec:
 *   - date (lg)
 *   - doctor + specialty (md)
 *   - visitType pill (sm)
 *   - notes preview (truncated, two-line clamp)
 *
 * Pure presentational. Tap routes the parent to /visits/[id]; that wiring
 * is owned by the page-level container so this component stays a quiet leaf.
 */

import type { VisitType } from './VisitForm'

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Other',
}

export interface VisitCardData {
  id: string
  date: string
  doctorName: string
  specialty?: string
  visitType: VisitType
  notes?: string
}

export interface VisitCardProps {
  visit: VisitCardData
  onSelect?: (id: string) => void
}

/** Format YYYY-MM-DD as "Tue, 21 Apr 2026" in IST. */
function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const dt = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt)
}

export function VisitCard({
  visit,
  onSelect,
}: VisitCardProps): React.JSX.Element {
  return (
    <article
      data-testid={`visit-card-${visit.id}`}
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        color: 'var(--ink)',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect?.(visit.id)}
        className="block w-full text-left"
        style={{ background: 'transparent', color: 'inherit' }}
        aria-label={`Open visit on ${formatDate(visit.date)}`}
      >
        <p
          className="text-lg"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          }}
        >
          {formatDate(visit.date)}
        </p>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--ink)' }}>
          {visit.doctorName}
          {visit.specialty ? (
            <span style={{ color: 'var(--ink-muted)' }}>
              {' · '}
              {visit.specialty}
            </span>
          ) : null}
        </p>
        <span
          data-testid={`visit-card-type-${visit.id}`}
          className="mt-3 inline-block rounded-full border px-3 py-1 text-[12px]"
          style={{
            borderColor: 'var(--rule)',
            color: 'var(--ink-muted)',
            background: 'var(--bg-elevated)',
          }}
        >
          {VISIT_TYPE_LABELS[visit.visitType]}
        </span>
        {visit.notes && visit.notes.length > 0 ? (
          <p
            className="mt-3 text-[14px]"
            style={{
              color: 'var(--ink-muted)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {visit.notes}
          </p>
        ) : null}
      </button>
    </article>
  )
}
