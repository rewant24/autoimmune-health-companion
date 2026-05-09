'use client'

/**
 * BloodWorkCard — single blood-work row in the /blood-work list.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.3.
 *
 * Visual hierarchy per spec:
 *   - date (lg)
 *   - marker count (md)
 *   - abnormal-flag pill (sm) — only when any marker has `abnormal === true`
 *
 * Pure presentational. Tap routes the parent to /blood-work/[id].
 */

export interface BloodWorkCardMarker {
  name: string
  value: number
  unit: string
  abnormal?: boolean
}

export interface BloodWorkCardData {
  id: string
  date: string
  markers: BloodWorkCardMarker[]
}

export interface BloodWorkCardProps {
  bloodWork: BloodWorkCardData
  onSelect?: (id: string) => void
}

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

export function BloodWorkCard({
  bloodWork,
  onSelect,
}: BloodWorkCardProps): React.JSX.Element {
  const count = bloodWork.markers.length
  const hasAbnormal = bloodWork.markers.some((m) => m.abnormal === true)

  return (
    <article
      data-testid={`blood-work-card-${bloodWork.id}`}
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        color: 'var(--ink)',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect?.(bloodWork.id)}
        className="block w-full text-left"
        style={{ background: 'transparent', color: 'inherit' }}
        aria-label={`Open blood work from ${formatDate(bloodWork.date)}`}
      >
        <p
          className="text-lg"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          }}
        >
          {formatDate(bloodWork.date)}
        </p>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--ink-muted)' }}>
          {count} {count === 1 ? 'marker' : 'markers'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full border px-3 py-1 text-[12px]"
            style={{
              borderColor: 'var(--rule)',
              color: 'var(--ink-muted)',
              background: 'var(--bg-elevated)',
            }}
          >
            BLOOD WORK
          </span>
          {hasAbnormal ? (
            <span
              data-testid={`blood-work-card-abnormal-${bloodWork.id}`}
              className="inline-block rounded-full border px-3 py-1 text-[12px]"
              style={{
                borderColor: 'var(--terracotta)',
                color: 'var(--terracotta)',
                background: 'transparent',
              }}
            >
              Abnormal
            </span>
          ) : null}
        </div>
      </button>
    </article>
  )
}
