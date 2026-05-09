'use client'

/**
 * /blood-work/[id] — blood-work detail + edit + soft-delete.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.3.
 *
 * Read path: filter from `listBloodWork` since 5.A doesn't ship a
 * `getBloodWorkById` (matches the visit-detail approach).
 *
 * Edit / delete paths mirror /visits/[id]: <BloodWorkForm mode="edit"/>,
 * confirm dialog with locked F02 copy, soft-delete on confirm.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useParams, useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import { BottomNav } from '@/components/nav/BottomNav'
import {
  BloodWorkForm,
  type BloodWorkFormValues,
} from '@/components/blood-work/BloodWorkForm'

const TEST_USER_KEY = 'saha.testUser.v1'

function getTestUserId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TEST_USER_KEY)
}

type BloodWorkDoc = {
  _id: string
  date: string
  markers: Array<{
    name: string
    value: number
    unit: string
    refRangeLow?: number
    refRangeHigh?: number
    abnormal?: boolean
  }>
  notes?: string
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const dt = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt)
}

export default function BloodWorkDetailPage(): React.JSX.Element {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const bloodWorkId = params?.id ?? null
  const [userId, setUserId] = useState<string | null>(null)
  const [editing, setEditing] = useState<boolean>(false)
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUserId(getTestUserId())
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).bloodWork?.listBloodWork,
    userId === null ? 'skip' : { userId },
  ) as BloodWorkDoc[] | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateBloodWork = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).bloodWork?.updateBloodWork,
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const softDeleteBloodWork = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).bloodWork?.softDeleteBloodWork,
  )

  const row = useMemo<BloodWorkDoc | null>(() => {
    if (!rows || !bloodWorkId) return null
    return rows.find((r) => r._id === bloodWorkId) ?? null
  }, [rows, bloodWorkId])

  async function handleEditSubmit(values: BloodWorkFormValues): Promise<void> {
    if (!row || !userId) return
    setError(null)
    try {
      await updateBloodWork({
        userId,
        bloodWorkId: row._id,
        date: values.date,
        markers: values.markers,
        notes: values.notes.length > 0 ? values.notes : undefined,
      })
      setEditing(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn\u2019t save \u2014 try again.",
      )
    }
  }

  async function handleDelete(): Promise<void> {
    if (!row || !userId) return
    setError(null)
    try {
      await softDeleteBloodWork({ userId, bloodWorkId: row._id })
      router.push('/blood-work')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn\u2019t delete \u2014 try again.",
      )
    }
  }

  return (
    <main
      data-testid="blood-work-detail-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6">
          <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Blood work
          </p>
        </header>

        {rows === undefined ? (
          <p className="type-body" style={{ color: 'var(--ink-muted)' }}>
            Loading…
          </p>
        ) : row === null ? (
          <p
            data-testid="blood-work-detail-missing"
            className="type-body"
            style={{ color: 'var(--ink-muted)' }}
          >
            We couldn&rsquo;t find that blood-work entry.
          </p>
        ) : editing ? (
          <BloodWorkForm
            mode="edit"
            errorMessage={error}
            initial={{
              date: row.date,
              markers: row.markers,
              notes: row.notes ?? '',
            }}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setEditing(false)
              setError(null)
            }}
          />
        ) : (
          <article
            data-testid="blood-work-detail-card"
            className="rounded-2xl border p-6"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          >
            <p
              className="text-lg"
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
              }}
            >
              {formatDate(row.date)}
            </p>

            <ul className="mt-4 grid gap-2">
              {row.markers.map((m, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 rounded-xl border px-3 py-2"
                  style={{
                    borderColor: 'var(--rule)',
                    background: 'var(--bg-elevated)',
                  }}
                >
                  <span className="text-[15px]">{m.name}</span>
                  <span
                    className="text-[15px]"
                    style={{
                      color: m.abnormal === true
                        ? 'var(--terracotta)'
                        : 'var(--ink)',
                    }}
                  >
                    {m.value} {m.unit}
                    {m.refRangeLow !== undefined && m.refRangeHigh !== undefined ? (
                      <span
                        className="ml-2 text-[12px]"
                        style={{ color: 'var(--ink-muted)' }}
                      >
                        ({m.refRangeLow}–{m.refRangeHigh})
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>

            {row.notes ? (
              <p
                className="mt-4 type-body"
                style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}
              >
                {row.notes}
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="mt-4 type-body"
                style={{ color: 'var(--terracotta)' }}
              >
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid="blood-work-detail-edit"
                className="min-h-12 rounded-full px-5 text-[15px] font-medium"
                style={{
                  background: 'var(--sage-deep)',
                  color: 'var(--bg-elevated)',
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                data-testid="blood-work-detail-delete"
                className="min-h-12 rounded-full border px-5 text-[15px] font-medium"
                style={{
                  borderColor: 'var(--rule)',
                  color: 'var(--ink-muted)',
                  background: 'transparent',
                }}
              >
                Delete
              </button>
            </div>
          </article>
        )}
      </div>

      {confirmingDelete ? (
        <DeleteConfirm
          onConfirm={async () => {
            await handleDelete()
            setConfirmingDelete(false)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}

      <BottomNav />
    </main>
  )
}

function DeleteConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="blood-work-delete-confirm"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(20, 24, 26, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--rule)',
          color: 'var(--ink)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: '1.25rem',
            lineHeight: 1.2,
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          }}
        >
          Delete these blood work results? You can&rsquo;t undo this.
        </h2>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-full px-5 text-[15px] font-medium"
            style={{
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--rule)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="blood-work-delete-confirm-submit"
            className="min-h-12 rounded-full px-6 text-[15px] font-medium"
            style={{
              background: 'var(--terracotta)',
              color: 'var(--bg-elevated)',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
