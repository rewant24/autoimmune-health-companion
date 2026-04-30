'use client'

/**
 * /blood-work/new — BloodWorkForm host (create + edit modes).
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.2.
 *
 * Convex API contract (chunk 5.A — runs in parallel):
 *   - `createBloodWork({ userId, date, markers, notes?, source: 'module',
 *                        clientRequestId })`
 *   - `updateBloodWork({ id, ...patch })`
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'

import { api } from '@/convex/_generated/api'

import {
  BloodWorkForm,
  type BloodWorkFormInitial,
  type BloodWorkSubmit,
  type MarkerSubmit,
} from '@/components/blood-work/BloodWorkForm'

const TEST_USER_KEY = 'saha.testUser.v1'

interface BloodWorkRow {
  _id: string
  userId: string
  date: string
  markers: MarkerSubmit[]
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

function NewBloodWorkInner(): React.JSX.Element {
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

  // 5.A returns { items: BloodWorkRow[] }.
  const listQuery = useQuery(
    apiAny.bloodWork?.listBloodWork,
    userId && editId ? { userId } : 'skip',
  ) as { items: BloodWorkRow[] } | undefined

  const editingRow = useMemo(() => {
    if (!editId || !listQuery) return null
    return listQuery.items.find((r) => r._id === editId) ?? null
  }, [editId, listQuery])

  const createBloodWork = useMutation(apiAny.bloodWork?.createBloodWork)
  const updateBloodWork = useMutation(apiAny.bloodWork?.updateBloodWork)

  const isEdit = editId !== null
  const editLoading = isEdit && (listQuery === undefined || editingRow === null)

  const initial: BloodWorkFormInitial | undefined = editingRow
    ? {
        date: editingRow.date,
        markers: editingRow.markers,
        notes: editingRow.notes ?? '',
      }
    : undefined

  const onSubmit = async (value: BloodWorkSubmit) => {
    if (!userId) return
    setSubmitting(true)
    setError(null)
    try {
      if (isEdit && editId) {
        if (!updateBloodWork) throw new Error('updateBloodWork unavailable')
        // 5.A surface: updateBloodWork({ bloodWorkId, userId, ...flat partials }).
        await updateBloodWork({
          bloodWorkId: editId,
          userId,
          date: value.date,
          markers: value.markers,
          notes: value.notes,
        })
      } else {
        if (!createBloodWork) throw new Error('createBloodWork unavailable')
        // 5.A surface: createBloodWork takes no clientRequestId (no
        // idempotency token in the schema). Manual-form path is gated by
        // the user submit button.
        await createBloodWork({
          userId,
          date: value.date,
          markers: value.markers,
          notes: value.notes,
          source: 'module',
        })
      }
      router.push('/blood-work')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the results.',
      )
      setSubmitting(false)
    }
  }

  return (
    <main
      data-testid="blood-work-new-page"
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
        <h1 className="type-display-md mt-4">
          {isEdit ? 'Edit blood work' : 'Log blood work'}
        </h1>

        {editLoading && (
          <p
            className="mt-6 text-sm text-[var(--ink-muted)]"
            data-testid="blood-work-edit-loading"
          >
            Loading entry…
          </p>
        )}

        {!editLoading && (
          <div className="mt-6">
            <BloodWorkForm
              initial={initial}
              onSubmit={onSubmit}
              onCancel={() => router.push('/blood-work')}
              submitLabel={isEdit ? 'Save changes' : 'Save results'}
              isSubmitting={submitting}
            />
            {error && (
              <p
                role="alert"
                data-testid="blood-work-save-error"
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

export default function NewBloodWorkPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <NewBloodWorkInner />
    </Suspense>
  )
}
