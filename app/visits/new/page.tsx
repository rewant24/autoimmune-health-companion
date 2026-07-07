'use client'

/**
 * /visits/new — create a doctor visit.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.1.
 *
 * Renders <VisitForm/> and on submit calls `api.doctorVisits.createVisit`
 * with `source: 'module'` + a fresh `clientRequestId` per submit attempt.
 * On success routes to `/visits/[id]` using the returned `visitId`.
 */

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import { useUserId } from '@/lib/auth/use-user-id'
import { BottomNav } from '@/components/nav/BottomNav'
import {
  VisitForm,
  type VisitFormValues,
} from '@/components/visits/VisitForm'

function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `crid_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

export default function NewVisitPage(): React.JSX.Element {
  const router = useRouter()
  const userId = useUserId()
  const [error, setError] = useState<string | null>(null)

  const createVisit = useMutation(api.doctorVisits.createVisit)

  async function handleSubmit(values: VisitFormValues): Promise<void> {
    if (userId === null) return
    setError(null)
    try {
      const result = (await createVisit({
        source: 'module',
        clientRequestId: newClientRequestId(),
        userId,
        date: values.date,
        doctorName: values.doctorName,
        ...(values.specialty.length > 0 ? { specialty: values.specialty } : {}),
        visitType: values.visitType,
        ...(values.notes.length > 0 ? { notes: values.notes } : {}),
      })) as { visitId: string; deduped?: boolean } | undefined
      if (result?.visitId) {
        router.push(`/visits/${result.visitId}`)
      } else {
        // Fallback if the mutation returns undefined locally (e.g. mocked
        // Convex in dev). Land on the list so the user has somewhere to go.
        router.push('/visits')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn\u2019t save \u2014 try again.",
      )
    }
  }

  return (
    <main
      data-testid="visit-new-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6">
          <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Doctor visits
          </p>
        </header>
        <VisitForm
          mode="create"
          errorMessage={error}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/visits')}
        />
      </div>
      <BottomNav />
    </main>
  )
}
