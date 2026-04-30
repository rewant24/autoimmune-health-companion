'use client'

/**
 * /visits/[id] — read-only detail view for a single doctor visit.
 *
 * Feature 05 Cycle 1, fix-pass.
 *
 * Purpose: list/card body taps land here (instead of jumping straight into
 * the edit form). User reviews the captured row and chooses Edit or Delete.
 *
 * Hydration: client-side filter over `listVisits` (chunk 5.A). Per-id query
 * isn't on the API surface yet; the simple `find` keeps the contract small
 * and is O(n) over a small table.
 */

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'

import { api } from '@/convex/_generated/api'
import type { VisitType } from '@/components/visits/VisitForm'

const TEST_USER_KEY = 'saha.testUser.v1'

interface VisitRow {
  _id: string
  userId: string
  date: string
  doctorName: string
  specialty?: string
  visitType: VisitType
  notes?: string
  deletedAt?: number
}

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Other',
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

export default function VisitDetailPage({
  params,
}: PageProps): React.JSX.Element {
  const { id: visitId } = use(params)
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setUserId(getOrCreateTestUserId())
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny = api as any
  const visitsQuery = useQuery(
    apiAny.doctorVisits?.listVisits,
    userId ? { userId } : 'skip',
  ) as { items: VisitRow[] } | undefined

  const visit = useMemo<VisitRow | null>(() => {
    if (!visitsQuery) return null
    return visitsQuery.items.find((r) => r._id === visitId) ?? null
  }, [visitsQuery, visitId])

  const softDelete = useMutation(apiAny.doctorVisits?.softDeleteVisit)

  const isLoading = userId !== null && visitsQuery === undefined
  const notFound = !isLoading && visit === null

  const handleDelete = async () => {
    if (!softDelete || !userId) return
    setDeleting(true)
    try {
      await softDelete({ visitId, userId })
      router.push('/visits')
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <main
      data-testid="visit-detail-page"
      className="min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <nav className="text-sm">
          <Link
            href="/visits"
            className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            ← All visits
          </Link>
        </nav>

        {isLoading && (
          <p
            className="mt-6 text-sm text-[var(--ink-muted)]"
            data-testid="visit-detail-loading"
          >
            Loading visit…
          </p>
        )}

        {notFound && (
          <section
            data-testid="visit-detail-not-found"
            className="mt-6 rounded-2xl border p-6 text-center"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
            }}
          >
            <p className="text-base text-[var(--ink-muted)]">
              We couldn&rsquo;t find that visit. It may have been deleted.
            </p>
            <Link
              href="/visits"
              className={
                'mt-4 inline-flex h-12 items-center justify-center rounded-full ' +
                'bg-[var(--sage-deep)] px-6 text-sm font-medium text-[var(--bg-elevated)]'
              }
            >
              Back to visits
            </Link>
          </section>
        )}

        {visit && (
          <article
            data-testid={`visit-detail-${visit._id}`}
            className="mt-4 rounded-2xl border p-6"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
            }}
          >
            <p className="text-sm text-[var(--ink-muted)]">
              {formatDate(visit.date)}
            </p>
            <h1 className="type-display-md mt-1">{visit.doctorName}</h1>
            {visit.specialty && (
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                {visit.specialty}
              </p>
            )}
            <p
              className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: 'var(--sage-soft)',
                color: 'var(--sage-deep)',
              }}
            >
              {VISIT_TYPE_LABELS[visit.visitType]}
            </p>
            {visit.notes && (
              <p className="mt-4 whitespace-pre-wrap text-base text-[var(--ink)]">
                {visit.notes}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/visits/new?id=${encodeURIComponent(visit._id)}`}
                data-testid="visit-detail-edit"
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
                data-testid="visit-detail-delete"
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
              Delete this visit? You can&rsquo;t undo this.
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
