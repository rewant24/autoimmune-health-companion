'use client'

/**
 * /visits — list of past + upcoming doctor visits.
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.3.
 *
 * Newest-first list. Empty state with primary "Log a visit" CTA. Each
 * VisitCard supports edit (routes to /visits/new with prefill) + soft
 * delete (confirm dialog → mutation).
 *
 * Convex API contract (chunk 5.A — runs in parallel):
 *   - `(api as any).doctorVisits.listVisits({ userId })` → row[]
 *   - `(api as any).doctorVisits.softDeleteVisit({ id })` → { alreadyDeleted? }
 *
 * Edit is deferred to a per-id detail page (`/visits/[id]`); for chunk 5.B
 * scope, the Edit button on a card routes to `/visits/new?id=<id>` and the
 * new-visit page hydrates from Convex when an `id` query param is present.
 * Keeps the shipped surface minimal — detail page lives in 5.B's owned set
 * but is not required by the scoping doc's chunk-5.B story (which says
 * "edit pre-fills the form").
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { api } from '@/convex/_generated/api'

import { VisitCard, type VisitRowLike } from '@/components/visits/VisitCard'
import type { VisitType } from '@/components/visits/VisitForm'

const TEST_USER_KEY = 'saha.testUser.v1'

interface VisitListRow extends VisitRowLike {
  _id: string
  userId: string
  date: string
  doctorName: string
  specialty?: string
  visitType: VisitType
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

export default function VisitsPage(): React.JSX.Element {
  const [userId, setUserId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    setUserId(getOrCreateTestUserId())
  }, [])

  // Chunk 5.A's `listVisits` is the source of truth for the API name.
  // Cast through `any` because the generated `api` types don't yet include
  // `doctorVisits` — chunk 5.A may still be merging when this lands.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny = api as any
  // 5.A returns { items: VisitListRow[] }.
  const visitsQuery = useQuery(
    apiAny.doctorVisits?.listVisits,
    userId ? { userId } : 'skip',
  ) as { items: VisitListRow[] } | undefined

  const softDelete = useMutation(apiAny.doctorVisits?.softDeleteVisit)

  const visits: VisitListRow[] = useMemo(() => {
    const rows = visitsQuery?.items ?? []
    // Filter soft-deleted defensively + sort newest-first by date string
    // (YYYY-MM-DD compares lexically). Server already filters & sorts,
    // but we don't want to rely on that contract from the UI.
    return [...rows]
      .filter((r) => !r.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [visitsQuery])

  const isLoading = userId !== null && visitsQuery === undefined

  const handleDelete = async (id: string) => {
    if (!softDelete || !userId) return
    try {
      // 5.A surface: softDeleteVisit({ visitId, userId }).
      await softDelete({ visitId: id, userId })
    } catch {
      // Best-effort — leave the card visible if the mutation fails.
    } finally {
      setConfirmDeleteId(null)
    }
  }

  return (
    <main
      data-testid="visits-page"
      className="min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="type-display-md">Doctor visits</h1>
          <Link
            href="/visits/new"
            data-testid="visits-add-cta"
            className={
              'inline-flex h-10 items-center justify-center rounded-full ' +
              'bg-[var(--sage-deep)] px-4 text-sm font-medium text-[var(--bg-elevated)]'
            }
          >
            + Log visit
          </Link>
        </header>

        {isLoading && (
          <p
            className="mt-6 text-sm text-[var(--ink-muted)]"
            data-testid="visits-loading"
          >
            Loading your visits…
          </p>
        )}

        {!isLoading && visits.length === 0 && (
          <section
            data-testid="visits-empty"
            className="mt-8 rounded-2xl border p-6 text-center"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
            }}
          >
            <p className="text-base text-[var(--ink-muted)]">
              No doctor visits logged yet.
            </p>
            <Link
              href="/visits/new"
              className={
                'mt-4 inline-flex h-12 items-center justify-center rounded-full ' +
                'bg-[var(--sage-deep)] px-6 text-sm font-medium text-[var(--bg-elevated)]'
              }
            >
              + Log visit
            </Link>
          </section>
        )}

        {!isLoading && visits.length > 0 && (
          <ul
            className="mt-6 flex flex-col gap-3"
            data-testid="visits-list"
          >
            {visits.map((v) => (
              <li key={v._id}>
                <VisitCard
                  visit={v}
                  onEdit={(id) => {
                    window.location.href = `/visits/new?id=${encodeURIComponent(id)}`
                  }}
                  onDelete={(id) => setConfirmDeleteId(id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmDeleteId !== null && (
        <DeleteConfirm
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            void handleDelete(confirmDeleteId)
          }}
          message="Delete this visit? You can't undo this."
        />
      )}
    </main>
  )
}

interface DeleteConfirmProps {
  onCancel: () => void
  onConfirm: () => void
  message: string
}

/**
 * Inline confirm — local to /visits and /blood-work pages because the F02
 * Memory delete dialog isn't exported as a reusable component yet. Visual
 * matches the sage-deep CTA family.
 */
function DeleteConfirm({
  onCancel,
  onConfirm,
  message,
}: DeleteConfirmProps): React.JSX.Element {
  return (
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
        <p className="text-base text-[var(--ink)]">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            data-testid="delete-confirm-yes"
            className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--danger,#b91c1c)] text-white"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="delete-confirm-cancel"
            className="flex h-12 w-full items-center justify-center rounded-full border border-[var(--rule)] text-[var(--ink-muted)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
