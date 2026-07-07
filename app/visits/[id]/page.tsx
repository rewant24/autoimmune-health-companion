'use client'

/**
 * /visits/[id] — visit detail + edit + soft-delete.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.3.
 *
 * Read path: 5.A doesn't ship a `getVisitById` query — we filter from
 * `listVisits({ userId })` in-memory. That's correct for MVP volumes; a
 * dedicated query is post-MVP if/when this page is hit before the list.
 *
 * Edit path: toggle to <VisitForm mode="edit" /> pre-filled. Submit calls
 * `updateVisit({ visitId, ...patch })`.
 *
 * Delete path: confirm dialog with locked F02 copy
 * ("Delete this visit / blood-work entry? You can't undo this.") →
 * `softDeleteVisit({ visitId })` → route back to /visits.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useParams, useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useUserId } from '@/lib/auth/use-user-id'
import { BottomNav } from '@/components/nav/BottomNav'
import {
  VisitForm,
  type VisitFormValues,
  type VisitType,
} from '@/components/visits/VisitForm'

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Other',
}

type VisitDoc = {
  _id: string
  date: string
  doctorName: string
  specialty?: string
  visitType: VisitType
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

export default function VisitDetailPage(): React.JSX.Element {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const visitId = params?.id ?? null
  // Detail pages read the existing stub without minting one — a missing
  // id just means "no visits", which renders the not-found state.
  const userId = useUserId({ create: false })
  const [editing, setEditing] = useState<boolean>(false)
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const visits = useQuery(
    api.doctorVisits.listVisits,
    userId === null ? 'skip' : { userId },
  ) as VisitDoc[] | undefined

  const updateVisit = useMutation(api.doctorVisits.updateVisit)
  const softDeleteVisit = useMutation(api.doctorVisits.softDeleteVisit)

  const visit = useMemo<VisitDoc | null>(() => {
    if (!visits || !visitId) return null
    return visits.find((v) => v._id === visitId) ?? null
  }, [visits, visitId])

  async function handleEditSubmit(values: VisitFormValues): Promise<void> {
    if (!visit || !userId) return
    setError(null)
    try {
      await updateVisit({
        userId,
        // Narrow brand cast at the boundary — local VisitDoc keeps plain
        // strings, decoupled from generated Id<> types (PR #23 precedent).
        visitId: visit._id as Id<'doctorVisits'>,
        date: values.date,
        doctorName: values.doctorName,
        specialty: values.specialty.length > 0 ? values.specialty : undefined,
        visitType: values.visitType,
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
    if (!visit || !userId) return
    setError(null)
    try {
      await softDeleteVisit({
        userId,
        visitId: visit._id as Id<'doctorVisits'>,
      })
      router.push('/visits')
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
      data-testid="visit-detail-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6">
          <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Doctor visit
          </p>
        </header>

        {visits === undefined ? (
          <p className="type-body" style={{ color: 'var(--ink-muted)' }}>
            Loading…
          </p>
        ) : visit === null ? (
          <p
            data-testid="visit-detail-missing"
            className="type-body"
            style={{ color: 'var(--ink-muted)' }}
          >
            We couldn&rsquo;t find that visit.
          </p>
        ) : editing ? (
          <VisitForm
            mode="edit"
            errorMessage={error}
            initial={{
              date: visit.date,
              doctorName: visit.doctorName,
              specialty: visit.specialty ?? '',
              visitType: visit.visitType,
              notes: visit.notes ?? '',
            }}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setEditing(false)
              setError(null)
            }}
          />
        ) : (
          <article
            data-testid="visit-detail-card"
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
              {formatDate(visit.date)}
            </p>
            <p className="mt-1 text-[15px]">{visit.doctorName}</p>
            {visit.specialty ? (
              <p
                className="mt-0.5 text-[14px]"
                style={{ color: 'var(--ink-muted)' }}
              >
                {visit.specialty}
              </p>
            ) : null}
            <span
              className="mt-3 inline-block rounded-full border px-3 py-1 text-[12px]"
              style={{
                borderColor: 'var(--rule)',
                color: 'var(--ink-muted)',
                background: 'var(--bg-elevated)',
              }}
            >
              {VISIT_TYPE_LABELS[visit.visitType]}
            </span>
            {visit.notes ? (
              <p
                className="mt-4 type-body"
                style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap' }}
              >
                {visit.notes}
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
                data-testid="visit-detail-edit"
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
                data-testid="visit-detail-delete"
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
      data-testid="visit-delete-confirm"
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
          Delete this doctor visit? You can&rsquo;t undo this.
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
            data-testid="visit-delete-confirm-submit"
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
