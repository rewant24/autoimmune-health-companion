'use client'

/**
 * /blood-work/[id] — read-only detail view for a single blood-work entry.
 *
 * Feature 05 Cycle 1, fix-pass.
 *
 * Lists every captured marker with abnormal flags + reference ranges.
 * Edit/Delete actions match the visit detail page.
 */

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'

import { api } from '@/convex/_generated/api'

const TEST_USER_KEY = 'saha.testUser.v1'

interface Marker {
  name: string
  value: number
  unit: string
  refRangeLow?: number
  refRangeHigh?: number
  abnormal?: boolean
}

interface BloodWorkRow {
  _id: string
  userId: string
  date: string
  markers: Marker[]
  notes?: string
  deletedAt?: number
}

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

function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(dt.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt)
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function BloodWorkDetailPage({
  params,
}: PageProps): React.JSX.Element {
  const { id: bloodWorkId } = use(params)
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setUserId(getOrCreateTestUserId())
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny = api as any
  const listQuery = useQuery(
    apiAny.bloodWork?.listBloodWork,
    userId ? { userId } : 'skip',
  ) as { items: BloodWorkRow[] } | undefined

  const row = useMemo<BloodWorkRow | null>(() => {
    if (!listQuery) return null
    return listQuery.items.find((r) => r._id === bloodWorkId) ?? null
  }, [listQuery, bloodWorkId])

  const softDelete = useMutation(apiAny.bloodWork?.softDeleteBloodWork)

  const isLoading = userId !== null && listQuery === undefined
  const notFound = !isLoading && row === null

  const handleDelete = async () => {
    if (!softDelete || !userId) return
    setDeleting(true)
    try {
      await softDelete({ bloodWorkId, userId })
      router.push('/blood-work')
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const abnormalCount = row?.markers.filter((m) => m.abnormal === true).length ?? 0

  return (
    <main
      data-testid="blood-work-detail-page"
      className="min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <nav className="text-sm">
          <Link
            href="/blood-work"
            className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            ← All blood work
          </Link>
        </nav>

        {isLoading && (
          <p
            className="mt-6 text-sm text-[var(--ink-muted)]"
            data-testid="blood-work-detail-loading"
          >
            Loading entry…
          </p>
        )}

        {notFound && (
          <section
            data-testid="blood-work-detail-not-found"
            className="mt-6 rounded-2xl border p-6 text-center"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
            }}
          >
            <p className="text-base text-[var(--ink-muted)]">
              We couldn&rsquo;t find that entry. It may have been deleted.
            </p>
            <Link
              href="/blood-work"
              className={
                'mt-4 inline-flex h-12 items-center justify-center rounded-full ' +
                'bg-[var(--sage-deep)] px-6 text-sm font-medium text-[var(--bg-elevated)]'
              }
            >
              Back to blood work
            </Link>
          </section>
        )}

        {row && (
          <article
            data-testid={`blood-work-detail-${row._id}`}
            className="mt-4 rounded-2xl border p-6"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
            }}
          >
            <p className="text-sm text-[var(--ink-muted)]">
              {formatDate(row.date)}
            </p>
            <h1 className="type-display-md mt-1">
              {row.markers.length} marker{row.markers.length === 1 ? '' : 's'}
            </h1>
            {abnormalCount > 0 && (
              <p
                className="mt-1 text-sm"
                style={{ color: 'rgb(153, 27, 27)' }}
              >
                {abnormalCount} outside reference range
              </p>
            )}

            <ul
              data-testid="blood-work-detail-markers"
              className="mt-4 flex flex-col gap-2 border-t border-[var(--rule)] pt-4"
            >
              {row.markers.map((m, i) => (
                <li
                  key={`${m.name}-${i}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col">
                    <span className="text-base text-[var(--ink)]">{m.name}</span>
                    {(m.refRangeLow !== undefined || m.refRangeHigh !== undefined) && (
                      <span className="text-xs text-[var(--ink-muted)]">
                        Ref: {m.refRangeLow ?? '—'} – {m.refRangeHigh ?? '—'} {m.unit}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base text-[var(--ink)]">
                      {m.value} {m.unit}
                    </span>
                    {m.abnormal === true && (
                      <span
                        aria-label="abnormal"
                        style={{ color: 'rgb(153, 27, 27)' }}
                      >
                        ●
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {row.notes && (
              <p className="mt-4 whitespace-pre-wrap text-base text-[var(--ink)]">
                {row.notes}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/blood-work/new?id=${encodeURIComponent(row._id)}`}
                data-testid="blood-work-detail-edit"
                className={
                  'flex h-12 w-full items-center justify-center rounded-full ' +
                  'bg-[var(--sage-deep)] text-sm font-medium text-[var(--bg-elevated)]'
                }
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                data-testid="blood-work-detail-delete"
                className={
                  'flex h-12 w-full items-center justify-center rounded-full ' +
                  'border border-[var(--rule)] text-sm text-[var(--danger,#b91c1c)]'
                }
              >
                Delete
              </button>
            </div>
          </article>
        )}
      </div>

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          data-testid="delete-confirm"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-6"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--rule)',
            }}
          >
            <p className="text-base text-[var(--ink)]">
              Delete this blood-work entry? You can&rsquo;t undo this.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleDelete()
                }}
                disabled={deleting}
                data-testid="delete-confirm-yes"
                className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--danger,#b91c1c)] text-white disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                data-testid="delete-confirm-cancel"
                className="flex h-12 w-full items-center justify-center rounded-full border border-[var(--rule)] text-[var(--ink-muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
