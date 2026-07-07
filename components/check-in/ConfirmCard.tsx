'use client'

/**
 * ConfirmCard — W2-4 (Lane 1D part 2), merges MedicationConfirmCard (F04
 * chunk 4.C) + EventConfirmCard (F05 chunk 5.C) into one component with
 * three `kind` variants: 'dose-change' | 'visit' | 'blood-work'.
 *
 * Pattern P1 from docs/spikes/checkin-confirm-card-ux.md (inline-confirm
 * with undo): Save and "Not now" both collapse the card into a status row
 * with an Undo chip instead of committing silently / vanishing.
 *
 *   - Undo after save → parent's `onUndoSave` (the existing delete
 *     mutation / compensating write for the row just written), then the
 *     prompt card is restored so the user can re-decide.
 *   - Undo after dismiss → pure state restore; nothing was written.
 *   - Chips persist until the check-in flow unmounts (state lives here
 *     and the page keeps cards mounted until the machine returns to
 *     idle). Deliberately NOT a timed toast — joint-pain users need time.
 *
 * The Convex writes remain the parent's responsibility — this component
 * is presentational + callbacks, exactly like its two predecessors.
 * `onConfirm` for blood-work receives the markers with any null units
 * resolved by the inline unit picker.
 *
 * `ref` exposes `save()` so ConfirmCardStack's "Save all" can trigger
 * pending cards imperatively in the grouped (N≥4) presentation.
 */

import { useImperativeHandle, useState } from 'react'
import { PillButton } from '@/components/ui/PillButton'
import { formatISTDate } from '@/lib/format/date'

const COMMON_UNITS = ['mg/L', 'mm/hr', 'g/dL', '×10⁹/L'] as const

export type ConfirmCardState = 'prompt' | 'saved' | 'dismissed' | 'error'

export interface ConfirmCardHandle {
  /** Trigger the Save action (no-op while busy or already resolved). */
  save: () => void
}

interface ConfirmCardCommonProps {
  /** Test seam — defaults to `confirm-card-${kind}`. */
  testId?: string
  /** Grouped (N≥4) presentation: parent owns horizontal spacing. */
  grouped?: boolean
  /** State reports for ConfirmCardStack's collapsed row icons. */
  onStateChange?: (state: ConfirmCardState) => void
  /**
   * Undo a completed save. For visits/blood-work the parent calls the
   * existing soft-delete mutation on the row id it stored at confirm
   * time; for dose changes it records the compensating reverse change
   * (the audit trail keeps both entries — history is not erased).
   * On success the card returns to the prompt state.
   */
  onUndoSave: () => void | Promise<void>
  ref?: React.Ref<ConfirmCardHandle>
}

export interface DoseChangeConfirmCardProps extends ConfirmCardCommonProps {
  kind: 'dose-change'
  medicationName: string
  oldDose: string
  newDose: string
  /** Optional reason captured by the extractor; rendered as subtext. */
  reason?: string
  onConfirm: () => void | Promise<void>
}

export interface VisitConfirmCardProps extends ConfirmCardCommonProps {
  kind: 'visit'
  date: string
  doctorName: string
  visitType: 'consultation' | 'follow-up' | 'urgent' | 'other'
  onConfirm: () => void | Promise<void>
}

export interface BloodWorkConfirmCardProps extends ConfirmCardCommonProps {
  kind: 'blood-work'
  date: string
  /** Markers as extracted. `unit: null` surfaces a unit picker. */
  markers: Array<{ name: string; value: number; unit: string | null }>
  /** Receives the markers with units resolved (picker selections applied). */
  onConfirm: (
    resolvedMarkers: Array<{ name: string; value: number; unit: string }>,
  ) => void | Promise<void>
}

export type ConfirmCardProps =
  | DoseChangeConfirmCardProps
  | VisitConfirmCardProps
  | BloodWorkConfirmCardProps

const visitTypeLabel: Record<VisitConfirmCardProps['visitType'], string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Visit',
}

const kindLabel: Record<ConfirmCardProps['kind'], string> = {
  'dose-change': 'Dose change',
  visit: 'Doctor visit',
  'blood-work': 'Blood work',
}

/** Card heading — the confirm cards' own treatment; no type-* class matches. */
const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-fraunces)',
  fontSize: '1.125rem',
  lineHeight: 1.25,
  fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
  color: 'var(--ink)',
}

/** One-line summary for saved rows + the stack's collapsed group rows. */
export function confirmCardRowSummary(props: ConfirmCardProps): string {
  switch (props.kind) {
    case 'dose-change':
      return `${kindLabel[props.kind]} · ${props.medicationName}`
    case 'visit':
      return `${kindLabel.visit} · ${props.doctorName}`
    case 'blood-work':
      return `${kindLabel['blood-work']} · ${props.markers
        .map((m) => m.name)
        .join(', ')}`
  }
}

export function ConfirmCard({
  ref,
  ...props
}: ConfirmCardProps): React.JSX.Element {
  const testId = props.testId ?? `confirm-card-${props.kind}`
  const [busy, setBusy] = useState(false)
  const [undoBusy, setUndoBusy] = useState(false)
  const [done, setDoneRaw] = useState<ConfirmCardState>('prompt')

  const setDone = (next: ConfirmCardState): void => {
    setDoneRaw(next)
    props.onStateChange?.(next)
  }

  // Per-marker unit picker state — keyed by marker index. Initialised from
  // the extractor's value (or DEFAULT) so a "Save" while the picker is
  // untouched still works.
  const initialUnits =
    props.kind === 'blood-work'
      ? props.markers.map((m) => m.unit ?? COMMON_UNITS[0])
      : []
  const [unitPicks, setUnitPicks] = useState<string[]>(initialUnits)

  const handleConfirm = async (): Promise<void> => {
    if (busy) return
    // INVARIANT: do NOT add 'error' to this guard list. The retry button
    // below calls setDone('prompt') then synchronously invokes
    // handleConfirm — but the setDone is queued, so handleConfirm still
    // reads done='error' on the call stack. If 'error' were added here
    // the retry path would silently no-op. Re-saving an already 'saved'
    // or 'dismissed' card is the only thing this guard protects.
    if (done === 'saved' || done === 'dismissed') return
    setBusy(true)
    try {
      if (props.kind === 'blood-work') {
        const resolved = props.markers.map((m, i) => ({
          name: m.name,
          value: m.value,
          unit: unitPicks[i] ?? COMMON_UNITS[0],
        }))
        await props.onConfirm(resolved)
      } else {
        await props.onConfirm()
      }
      setDone('saved')
    } catch {
      // Surface a retry affordance instead of stranding the card mid-save.
      setDone('error')
    } finally {
      setBusy(false)
    }
  }

  useImperativeHandle(ref, () => ({
    save: () => {
      void handleConfirm()
    },
  }))

  const handleDismiss = (): void => {
    // Reachable from 'prompt' AND 'error'. (The old MedicationConfirmCard
    // guarded on truthy `done`, which made the error card's "Not now" a
    // dead button — fixed by the merge.)
    if (busy || done === 'saved' || done === 'dismissed') return
    setDone('dismissed')
  }

  const handleUndoSave = async (): Promise<void> => {
    if (undoBusy) return
    setUndoBusy(true)
    try {
      await props.onUndoSave()
      setDone('prompt')
    } catch {
      // Undo failed — the row is still saved, which is what the card
      // shows. The chip stays; the user can retry.
    } finally {
      setUndoBusy(false)
    }
  }

  const shell = `${props.grouped ? 'mt-3' : 'mx-6 mt-4'} rounded-2xl border border-rule bg-bg-card p-6`

  const titleText = ((): string => {
    switch (props.kind) {
      case 'dose-change':
        return `Dose change for ${props.medicationName}?`
      case 'visit':
        return `Doctor visit on ${formatISTDate(props.date)}?`
      case 'blood-work':
        return `Blood work on ${formatISTDate(props.date)}?`
    }
  })()

  if (done === 'saved') {
    const savedText = ((): string => {
      switch (props.kind) {
        case 'dose-change':
          return `Saved ${props.medicationName} → ${props.newDose}.`
        case 'visit':
          return `Saved — ${props.doctorName}, ${formatISTDate(props.date)}.`
        case 'blood-work':
          return `Saved — ${props.markers.length} marker${
            props.markers.length === 1 ? '' : 's'
          }, ${formatISTDate(props.date)}.`
      }
    })()
    return (
      <section data-testid={testId} data-state="saved" className={shell}>
        <p className="type-label">{kindLabel[props.kind]}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="type-body">✓ {savedText}</p>
          <PillButton
            variant="secondary"
            data-testid={`${testId}-undo`}
            disabled={undoBusy}
            onClick={() => void handleUndoSave()}
          >
            {undoBusy ? 'Undoing…' : 'Undo'}
          </PillButton>
        </div>
      </section>
    )
  }

  if (done === 'dismissed') {
    // P1: the dismissed card stays as a recoverable row (the old cards
    // rendered <></> here — an accidental "Not now" was data loss).
    return (
      <section
        data-testid={testId}
        data-state="dismissed"
        className={`${shell} opacity-70`}
      >
        <p className="type-label">{kindLabel[props.kind]}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="type-body">Okay, not saving this.</p>
          <PillButton
            variant="secondary"
            data-testid={`${testId}-undo`}
            onClick={() => setDone('prompt')}
          >
            Undo
          </PillButton>
        </div>
      </section>
    )
  }

  if (done === 'error') {
    return (
      <section data-testid={testId} data-state="error" className={shell}>
        <p className="type-label">{titleText}</p>
        <p className="type-body mt-2">Couldn&rsquo;t save. Tap retry?</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PillButton
            data-testid={`${testId}-retry`}
            onClick={() => {
              setDone('prompt')
              void handleConfirm()
            }}
          >
            Retry
          </PillButton>
          <PillButton
            variant="secondary"
            data-testid={`${testId}-dismiss`}
            onClick={handleDismiss}
          >
            Not now
          </PillButton>
        </div>
      </section>
    )
  }

  return (
    <section data-testid={testId} data-state="prompt" className={shell}>
      <p className="type-label">{titleText}</p>
      <h3 className="mt-3" style={headingStyle}>
        {props.kind === 'dose-change' ? (
          <>
            I heard: {props.oldDose} → {props.newDose}
          </>
        ) : props.kind === 'visit' ? (
          <>
            I heard: {props.doctorName} · {visitTypeLabel[props.visitType]}
          </>
        ) : (
          <>Here&rsquo;s what I caught:</>
        )}
      </h3>
      {props.kind === 'dose-change' && props.reason ? (
        <p className="type-body mt-2" data-testid={`${testId}-reason`}>
          {props.reason}
        </p>
      ) : null}
      {props.kind === 'blood-work' ? (
        <ul
          className="mt-3 flex flex-col gap-2"
          data-testid={`${testId}-markers`}
        >
          {props.markers.map((marker, i) => {
            const needsPicker = marker.unit === null
            return (
              <li
                key={`${marker.name}-${i}`}
                className="type-body flex flex-wrap items-center gap-2"
                style={{ color: 'var(--ink)' }}
                data-testid={`${testId}-marker-${i}`}
              >
                <span>
                  {marker.name} {marker.value}
                  {marker.unit !== null ? ` ${marker.unit}` : ''}
                </span>
                {needsPicker ? (
                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    <span>Unit</span>
                    <select
                      data-testid={`${testId}-unit-${i}`}
                      value={unitPicks[i] ?? COMMON_UNITS[0]}
                      onChange={(e) => {
                        const next = [...unitPicks]
                        next[i] = e.target.value
                        setUnitPicks(next)
                      }}
                      className="min-h-9 rounded-md border border-rule bg-bg-elevated px-2 text-ink"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PillButton
          data-testid={`${testId}-confirm`}
          disabled={busy}
          onClick={() => void handleConfirm()}
        >
          {busy ? 'Saving…' : 'Save'}
        </PillButton>
        <PillButton
          variant="secondary"
          data-testid={`${testId}-dismiss`}
          disabled={busy}
          onClick={handleDismiss}
        >
          Not now
        </PillButton>
      </div>
    </section>
  )
}
