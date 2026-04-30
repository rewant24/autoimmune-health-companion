'use client'

/**
 * /blood-work — list of blood-work entries.
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.3.
 *
 * Convex API contract (chunk 5.A — runs in parallel):
 *   - `(api as any).bloodWork.listBloodWork({ userId })` → row[]
 *   - `(api as any).bloodWork.softDeleteBloodWork({ id })` → { alreadyDeleted? }
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'

import { api } from '@/convex/_generated/api'

const TEST_USER_KEY = 'saha.testUser.v1'

interface BloodWorkMarker {
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
  markers: BloodWorkMarker[]
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

export default function BloodWorkListPage(): React.JSX.Element {
  const [userId, setUserId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    setUserId(getOrCreateTestUserId())
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny = api as any
  // 5.A returns { items: BloodWorkRow[] }.
  const query = useQuery(
    apiAny.bloodWork?.listBloodWork,
    userId ? { userId } : 'skip',
  ) as { items: BloodWorkRow[] } | undefined

  const softDelete = useMutation(apiAny.bloodWork?.softDeleteBloodWork)

  const rows: BloodWorkRow[] = useMemo(() => {
    const list = query?.items ?? []
    return [...list]
      .filter((r) => !r.deletedAt)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [query])

  const isLoading = userId !== null && query === undefined

  const handleDelete = async (id: string) => {
    if (!softDelete || !userId) return
    try {
      // 5.A surface: softDeleteBloodWork({ bloodWorkId, userId }).
      await softDelete({ bloodWorkId: id, userId })
    } catch {
      // best-effort
    } finally {
      setConfirmDeleteId(null)
    }
  }

  return (
    <main
      data-testid="blood-work-page"
      className="min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="type-display-md">Blood work</h1>
          <Link
            href="/blood-work/new"
            data-testid="blood-work-add-cta"
            className={
              'inline-flex h-10 items-center justify-center rounded-full ' +
              'bg-[var(--sage-deep)] px-4 text-sm font-medium text-[var(--bg-elevated)]'
            }
          >
            + Log blood work
          </Link>
        </header>

        {isLoading && (
          <p
            className="mt-6 text-sm text-[var(--ink-muted)]"
            data-testid="blood-work-loading"
          >
            Loading your results…
          </p>
        )}

        {!isLoading && rows.length === 0 && (
          <section
            data-testid="blood-work-empty"
            className="mt-8 rounded-2xl border p-6 text-center"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
            }}
          >
            <p className="text-base text-[var(--ink-muted)]">
              No blood work logged yet.
            </p>
            <Link
              href="/blood-work/new"
              className={
                'mt-4 inline-flex h-12 items-center justify-center rounded-full ' +
                'bg-[var(--sage-deep)] px-6 text-sm font-medium text-[var(--bg-elevated)]'
              }
            >
              + Log blood work
            </Link>
          </section>
        )}

        {!isLoading && rows.length > 0 && (
          <ul
            className="mt-6 flex flex-col gap-3"
            data-testid="blood-work-list"
          >
            {rows.map((r) => (
              <li key={r._id}>
                <BloodWorkListCard
                  row={r}
                  // F05 fix-pass: card body opens detail page; Edit goes to form.
                  onOpen={() => {
                    window.location.href = `/blood-work/${encodeURIComponent(r._id)}`
                  }}
                  onEdit={() => {
                    window.location.href = `/blood-work/new?id=${encodeURIComponent(r._id)}`
                  }}
                  onDelete={() => setConfirmDeleteId(r._id)}
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
          message="Delete this blood-work entry? You can't undo this."
        />
      )}
    </main>
  )
}

interface BloodWorkListCardProps {
  row: BloodWorkRow
  /** Tap on body — defaults to onEdit for back-compat. */
  onOpen?: () => void
  onEdit: () => void
  onDelete: () => void
}

function BloodWorkListCard({
  row,
  onOpen,
  onEdit,
  onDelete,
}: BloodWorkListCardProps): React.JSX.Element {
  const abnormalCount = row.markers.filter((m) => m.abnormal === true).length
  const handleBodyTap = onOpen ?? onEdit
  return (
    <article
      data-testid={`blood-work-card-${row._id}`}
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <button
        type="button"
        onClick={handleBodyTap}
        className="flex w-full flex-col gap-2 text-left"
        data-testid={`blood-work-card-body-${row._id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-[var(--ink-muted)]">
              {formatDate(row.date)}
            </p>
            <p className="text-base font-medium text-[var(--ink)]">
              {row.markers.length} marker{row.markers.length === 1 ? '' : 's'}
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: 'var(--sand-soft, #f5efe6)',
              color: 'var(--ink)',
            }}
          >
            BLOOD WORK
          </span>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--ink-muted)]">
          {row.markers.slice(0, 4).map((m, i) => (
            <li key={`${row._id}-${m.name}-${i}`}>
              <span className="text-[var(--ink)]">{m.name}</span>{' '}
              {m.value} {m.unit}
              {m.abnormal === true ? (
                <span
                  aria-label="abnormal"
                  className="ml-1"
                  style={{ color: 'rgb(153, 27, 27)' }}
                >
                  ●
                </span>
              ) : null}
            </li>
          ))}
          {row.markers.length > 4 && (
            <li className="italic">+{row.markers.length - 4} more</li>
          )}
        </ul>
        {abnormalCount > 0 && (
          <p
            className="text-xs"
            style={{ color: 'rgb(153, 27, 27)' }}
          >
            {abnormalCount} outside range
          </p>
        )}
        {row.notes && (
          <p className="line-clamp-2 text-sm text-[var(--ink-muted)]">
            {row.notes}
          </p>
        )}
      </button>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onEdit}
          data-testid={`blood-work-edit-${row._id}`}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          data-testid={`blood-work-delete-${row._id}`}
          className="rounded-full px-3 py-1.5 text-sm text-[var(--danger,#b91c1c)] hover:opacity-80"
        >
          Delete
        </button>
      </div>
    </article>
  )
}

interface DeleteConfirmProps {
  onCancel: () => void
  onConfirm: () => void
  message: string
}

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
