'use client'

/**
 * /medications — Medications module landing.
 *
 * F04 Cycle 1, Chunk 4.B, US-4.B.2 (add/edit/deactivate) + US-4.B.3 (dose
 * change). Voice-first regimen entry is deferred to Cycle 2 (ADR-030).
 *
 * Composition:
 *   - <RegimenList />            — active medications.
 *   - <AddMedicationSheet />     — add OR edit (pre-filled), shared component.
 *   - <DosageChangeDialog />     — record dose change.
 *   - Confirm dialog (inline)    — deactivate confirmation.
 *
 * ## Convex API expectations (chunk 4.A)
 *
 * Chunk 4.A is in flight in another worktree; their API is not yet visible
 * in `convex/_generated/api.d.ts` for this branch. We import `api` from the
 * generated path AND cast through `as any` at the call site so this builds
 * cleanly today and picks up the real types after the schema regenerates.
 *
 * The expected surface (matches docs/features/04-medications.md US-4.A.1
 * + US-4.A.3) is:
 *
 *   api.medications.listActiveMedications:
 *     query({ userId: string }) => Doc<"medications">[]
 *
 *   api.medications.createMedication:
 *     mutation({
 *       userId: string,
 *       name: string,
 *       dose: string,
 *       frequency: string,
 *       category: MedCategory,
 *       delivery: MedDelivery,
 *       clientRequestId: string,
 *     }) => Id<"medications">
 *
 *   api.medications.updateMedication:
 *     mutation({
 *       userId: string,
 *       medicationId: Id<"medications">,
 *       patch: { name?, dose?, frequency?, category?, delivery? },
 *       clientRequestId: string,
 *     }) => Id<"medications">
 *
 *   api.medications.deactivateMedication:
 *     mutation({ userId, medicationId, clientRequestId }) => Id<"medications">
 *
 *   api.dosageChanges.recordDosageChange:
 *     mutation({
 *       userId,
 *       medicationId,
 *       oldDose,
 *       newDose,
 *       changedAt: number,
 *       reason?: string,
 *       source: 'module' | 'check-in',
 *       checkInId?: Id<"checkIns">,
 *     }) => Id<"dosageChanges">
 *
 * If 4.A's actual export names diverge, this page is the only place that
 * needs to chase them; component layers below are pure-controlled.
 *
 * ## Direct-link guard
 *
 * Mirrors /home: if the user hasn't onboarded, redirect to /onboarding/1.
 * The auth boundary is just localStorage today (per scoping; real auth is
 * post-MVP), so the guard is best-effort.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import { BottomNav } from '@/components/nav/BottomNav'
import {
  AddMedicationSheet,
  type MedicationFormValues,
} from '@/components/medications/AddMedicationSheet'
import { DosageChangeDialog } from '@/components/medications/DosageChangeDialog'
import { RegimenList } from '@/components/medications/RegimenList'
import type { MedicationCardData } from '@/components/medications/MedicationCard'
import { readProfile } from '@/lib/profile/storage'

const TEST_USER_KEY = 'saha.testUser.v1'

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

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// Shape we expect back from listActiveMedications. Mirrors the
// `medications` table schema in convex/schema.ts (already landed in
// pre-flight, so this is stable even though the query is owned by 4.A).
type MedicationDoc = {
  _id: string
  name: string
  dose: string
  frequency: string
  category: MedicationCardData['category']
  delivery: 'oral' | 'injectable' | 'iv' | 'other'
  isActive: boolean
}

export default function MedicationsPage(): React.JSX.Element {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean>(false)
  const [checked, setChecked] = useState<boolean>(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const profile = readProfile()
    if (!profile || profile.onboarded !== true) {
      router.replace('/onboarding/1')
      setChecked(true)
      return
    }
    setUserId(getOrCreateTestUserId())
    setAllowed(true)
    setChecked(true)
  }, [router])

  // `as any` — chunk 4.A's Convex module isn't in the generated api.d.ts
  // on this branch yet. The runtime path resolves once 4.A lands and
  // `npx convex dev` regenerates types. See header for expected shape.
  const meds = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).medications?.listActiveMedications,
    userId === null ? 'skip' : { userId },
  ) as MedicationDoc[] | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMedication = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).medications?.createMedication,
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMedication = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).medications?.updateMedication,
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deactivateMedication = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).medications?.deactivateMedication,
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordDosageChange = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).dosageChanges?.recordDosageChange,
  )

  const cards: MedicationCardData[] | undefined = useMemo(() => {
    if (meds === undefined) return undefined
    return meds.map((m) => ({
      id: m._id,
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
      category: m.category,
    }))
  }, [meds])

  // UI state
  const [sheetOpen, setSheetOpen] = useState<boolean>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [doseChangeId, setDoseChangeId] = useState<string | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  const editTarget =
    editId !== null ? meds?.find((m) => m._id === editId) ?? null : null
  const doseChangeTarget =
    doseChangeId !== null
      ? meds?.find((m) => m._id === doseChangeId) ?? null
      : null
  const deactivateTarget =
    deactivateId !== null
      ? meds?.find((m) => m._id === deactivateId) ?? null
      : null

  if (!checked || !allowed) {
    return (
      <main
        data-testid="medications-page-pending"
        className="grain min-h-screen"
        style={{ background: 'var(--bg)' }}
      />
    )
  }

  async function handleSheetSubmit(values: MedicationFormValues): Promise<void> {
    if (userId === null) return
    if (editId === null) {
      await createMedication({
        userId,
        ...values,
        clientRequestId: newRequestId(),
      })
    } else {
      await updateMedication({
        userId,
        medicationId: editId,
        patch: values,
        clientRequestId: newRequestId(),
      })
    }
    setSheetOpen(false)
    setEditId(null)
  }

  async function handleDeactivate(): Promise<void> {
    if (userId === null || deactivateId === null) return
    await deactivateMedication({
      userId,
      medicationId: deactivateId,
      clientRequestId: newRequestId(),
    })
    setDeactivateId(null)
  }

  async function handleDosageChange(values: {
    newDose: string
    reason: string | null
  }): Promise<void> {
    if (userId === null || doseChangeTarget === null) return
    await recordDosageChange({
      userId,
      medicationId: doseChangeTarget._id,
      oldDose: doseChangeTarget.dose,
      newDose: values.newDose,
      changedAt: Date.now(),
      ...(values.reason !== null ? { reason: values.reason } : {}),
      source: 'module',
    })
    setDoseChangeId(null)
  }

  return (
    <main
      data-testid="medications-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6">
          <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
            Medications
          </p>
          <h1
            className="mt-2"
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: '1.75rem',
              lineHeight: 1.15,
              fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
            }}
          >
            Your regimen
          </h1>
          <p
            className="mt-2 type-body"
            style={{ color: 'var(--ink-muted)' }}
          >
            Edit, deactivate, or record a dose change.
          </p>
        </header>

        <RegimenList
          medications={cards}
          onAdd={() => {
            setEditId(null)
            setSheetOpen(true)
          }}
          onEdit={(id) => {
            setEditId(id)
            setSheetOpen(true)
          }}
          onDoseChange={(id) => setDoseChangeId(id)}
          onDeactivate={(id) => setDeactivateId(id)}
        />

        {cards !== undefined && cards.length > 0 ? (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditId(null)
                setSheetOpen(true)
              }}
              data-testid="medications-add-fab"
              aria-label="Add medication"
              className="flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg"
              style={{
                background: 'var(--sage-deep)',
                color: 'var(--bg-elevated)',
              }}
            >
              +
            </button>
          </div>
        ) : null}
      </div>

      <AddMedicationSheet
        open={sheetOpen}
        mode={editId === null ? 'add' : 'edit'}
        initial={
          editTarget !== null
            ? {
                name: editTarget.name,
                dose: editTarget.dose,
                frequency: editTarget.frequency,
                category: editTarget.category,
                delivery: editTarget.delivery,
              }
            : null
        }
        onSubmit={handleSheetSubmit}
        onCancel={() => {
          setSheetOpen(false)
          setEditId(null)
        }}
      />

      {doseChangeTarget !== null ? (
        <DosageChangeDialog
          open={true}
          medicationName={doseChangeTarget.name}
          currentDose={doseChangeTarget.dose}
          onSubmit={handleDosageChange}
          onCancel={() => setDoseChangeId(null)}
        />
      ) : null}

      {deactivateTarget !== null ? (
        <DeactivateConfirm
          name={deactivateTarget.name}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateId(null)}
        />
      ) : null}

      <BottomNav />
    </main>
  )
}

interface DeactivateConfirmProps {
  name: string
  onConfirm: () => void
  onCancel: () => void
}

function DeactivateConfirm({
  name,
  onConfirm,
  onCancel,
}: DeactivateConfirmProps): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="deactivate-confirm"
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
          Stop tracking {name}?
        </h2>
        <p className="mt-2 type-body" style={{ color: 'var(--ink-muted)' }}>
          Your past intake history stays.
        </p>
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
            data-testid="deactivate-confirm-submit"
            className="min-h-12 rounded-full px-6 text-[15px] font-medium"
            style={{
              background: 'var(--terracotta)',
              color: 'var(--bg-elevated)',
            }}
          >
            Stop tracking
          </button>
        </div>
      </div>
    </div>
  )
}
