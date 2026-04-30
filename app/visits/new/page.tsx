'use client'

/**
 * /visits/new — VisitForm host (create + edit modes).
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.1.
 *
 * Modes:
 *   - Create (default): empty form, submit calls `createVisit`.
 *   - Edit (`?id=<visitId>`): hydrates from `(api as any).doctorVisits.getVisit`
 *     when available, else from `listVisits` filtered client-side. Submit calls
 *     `updateVisit`. Detail-page route `/visits/[id]` is NOT shipped in 5.B —
 *     the chunk plan requires "Edit pre-fills the form" which this page does.
 *
 * Convex API contract (chunk 5.A — runs in parallel):
 *   - `createVisit({ userId, date, doctorName, specialty?, visitType, notes?,
 *                    source: 'module', clientRequestId })`
 *   - `updateVisit({ id, ...patch })`
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'

import { api } from '@/convex/_generated/api'

import {
  VisitForm,
  type VisitFormValue,
  type VisitType,
} from '@/components/visits/VisitForm'

const TEST_USER_KEY = 'saha.testUser.v1'

interface VisitListRow {
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

/**
 * Fresh idempotency token for a single create attempt. Re-rolled per submit
 * so a user who creates → returns to the form → creates again gets distinct
 * rows. Identical retries (network blip, double-click) within a single
 * submit reuse the same token via the closed-over ref.
 */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

function NewVisitInner(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams?.get('id') ?? null

  const [userId, setUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUserId(getOrCreateTestUserId())
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny = api as any

  // Edit mode: pull the full list and find the row. The 5.A contract may
  // expose a per-id query later; for now `listVisits` is enough and the
  // client-side filter is O(n) on a small table.
  // 5.A returns { items: VisitListRow[] }.
  const visitsQuery = useQuery(
    apiAny.doctorVisits?.listVisits,
    userId && editId ? { userId } : 'skip',
  ) as { items: VisitListRow[] } | undefined

  const editingRow = useMemo(() => {
    if (!editId || !visitsQuery) return null
    return visitsQuery.items.find((r) => r._id === editId) ?? null
  }, [editId, visitsQuery])

  const createVisit = useMutation(apiAny.doctorVisits?.createVisit)
  const updateVisit = useMutation(apiAny.doctorVisits?.updateVisit)

  const isEdit = editId !== null
  // Fix-pass: distinguish "still loading" from "row not found". editLoading
  // is true ONLY while the query is in flight; once it resolves and the row
  // is missing, we render an explicit empty state instead of the spinner.
  const editLoading = isEdit && visitsQuery === undefined
  const editNotFound = isEdit && visitsQuery !== undefined && editingRow === null

  // Stable per-submit idempotency token. Reset to a fresh token on submit
  // start; if the user navigates back and submits again we get a new row.
  const requestIdRef = useRef<string | null>(null)

  const initial: Partial<VisitFormValue> | undefined = editingRow
    ? {
        date: editingRow.date,
        doctorName: editingRow.doctorName,
        specialty: editingRow.specialty ?? '',
        visitType: editingRow.visitType,
        notes: editingRow.notes ?? '',
      }
    : undefined

  const onSubmit = async (value: {
    date: string
    doctorName: string
    specialty?: string
    visitType: VisitType
    notes?: string
  }) => {
    if (!userId) return
    setSubmitting(true)
    setError(null)
    try {
      if (isEdit && editId) {
        if (!updateVisit) throw new Error('updateVisit unavailable')
        // 5.A surface: updateVisit takes { visitId, userId, ...flat partials }.
        await updateVisit({
          visitId: editId,
          userId,
          date: value.date,
          doctorName: value.doctorName,
          specialty: value.specialty,
          visitType: value.visitType,
          notes: value.notes,
        })
      } else {
        if (!createVisit) throw new Error('createVisit unavailable')
        // F05 fix-pass: pass a stable clientRequestId so retries collapse on
        // the server. Token is rolled on each submit attempt — error+retry
        // reuses the same token so we don't double-create on a network blip.
        if (requestIdRef.current === null) {
          requestIdRef.current = newRequestId()
        }
        await createVisit({
          userId,
          date: value.date,
          doctorName: value.doctorName,
          specialty: value.specialty,
          visitType: value.visitType,
          notes: value.notes,
          source: 'module',
          clientRequestId: requestIdRef.current,
        })
      }
      router.push('/visits')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the visit.')
      setSubmitting(false)
    }
  }

  return (
    <main
      data-testid="visit-new-page"
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
        <h1 className="type-display-md mt-4">
          {isEdit ? 'Edit visit' : 'Log a doctor visit'}
        </h1>

        {editLoading && (
          <p
            className="mt-6 text-sm text-[var(--ink-muted)]"
            data-testid="visit-edit-loading"
          >
            Loading visit…
          </p>
        )}

        {editNotFound && (
          <section
            data-testid="visit-edit-not-found"
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

        {!editLoading && !editNotFound && (
          <div className="mt-6">
            <VisitForm
              initial={initial}
              onSubmit={onSubmit}
              onCancel={() => router.push('/visits')}
              submitLabel={isEdit ? 'Save changes' : 'Save visit'}
              isSubmitting={submitting}
            />
            {error && (
              <p
                role="alert"
                data-testid="visit-save-error"
                className="mt-4 text-sm text-[var(--danger,#b91c1c)]"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

export default function NewVisitPage(): React.JSX.Element {
  // Next 16 requires Suspense boundary around `useSearchParams`.
  return (
    <Suspense fallback={null}>
      <NewVisitInner />
    </Suspense>
  )
}
