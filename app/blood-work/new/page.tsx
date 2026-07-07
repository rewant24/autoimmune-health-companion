'use client'

/**
 * /blood-work/new — create a blood-work entry.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.2.
 *
 * Renders <BloodWorkForm/> and on submit calls
 * `api.bloodWork.createBloodWork` with `source: 'module'` + a fresh
 * `clientRequestId` per submit attempt.
 */

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import { useUserId } from '@/lib/auth/use-user-id'
import { BottomNav } from '@/components/nav/BottomNav'
import {
  BloodWorkForm,
  type BloodWorkFormValues,
} from '@/components/blood-work/BloodWorkForm'

function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `crid_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

export default function NewBloodWorkPage(): React.JSX.Element {
  const router = useRouter()
  const userId = useUserId()
  const [error, setError] = useState<string | null>(null)

  const createBloodWork = useMutation(api.bloodWork.createBloodWork)

  async function handleSubmit(values: BloodWorkFormValues): Promise<void> {
    if (userId === null) return
    setError(null)
    try {
      const result = (await createBloodWork({
        source: 'module',
        clientRequestId: newClientRequestId(),
        userId,
        date: values.date,
        markers: values.markers,
        ...(values.notes.length > 0 ? { notes: values.notes } : {}),
      })) as { bloodWorkId: string; deduped?: boolean } | undefined
      if (result?.bloodWorkId) {
        router.push(`/blood-work/${result.bloodWorkId}`)
      } else {
        router.push('/blood-work')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn\u2019t save \u2014 try again.",
      )
    }
  }

  return (
    <main
      data-testid="blood-work-new-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6">
          <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Blood work
          </p>
        </header>
        <BloodWorkForm
          mode="create"
          errorMessage={error}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/blood-work')}
        />
      </div>
      <BottomNav />
    </main>
  )
}
