'use client'

/**
 * EventConfirmCard — F05 chunk 5.C, US-5.C.1 + US-5.C.2.
 *
 * Renders inside the check-in summary step (above ConfirmSummary, below
 * `<MedicationConfirmCard>` cards) when the event extractor detects a
 * doctor-visit or blood-work mention. One card per detected event — the
 * user confirms (write happens) or dismisses (silent drop).
 *
 * Visual vocabulary mirrors `MedicationConfirmCard` exactly: sage card,
 * two-button row with primary "Save" + secondary "Not now". State machine
 * is `prompt | saved | dismissed | error`.
 *
 * Two `kind` variants:
 *   - 'visit' — title carries the date; body is "I heard: [doctorName] · [visitType]".
 *   - 'blood-work' — title carries the date; body lines per marker.
 *     If a marker has `unit: null`, a small `<select>` picker is surfaced
 *     for the user to pick a common unit before saving.
 *
 * The Convex write is the parent's responsibility — this component is
 * presentational + emits two callbacks. `onConfirm` for blood-work cards
 * receives the (possibly user-picked) marker units; the parent passes them
 * through to `createBloodWork`.
 */

import { useState } from 'react'

const COMMON_UNITS = ['mg/L', 'mm/hr', 'g/dL', '×10⁹/L'] as const

/** Format YYYY-MM-DD as "Tue, 21 Apr 2026" in IST. Mirrors the
 *  formatter in VisitCard + BloodWorkCard — TODO follow-up: lift to
 *  `lib/format/date.ts` and DRY the three call sites. Inlining for now
 *  keeps the F05 ship diff narrow (per "no unnecessary abstractions"). */
function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const dt = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt)
}

export interface VisitConfirmCardProps {
  kind: 'visit'
  date: string
  doctorName: string
  visitType: 'consultation' | 'follow-up' | 'urgent' | 'other'
  /** Test seam — defaults to `event-confirm-card-visit`. */
  testId?: string
  onConfirm: () => void | Promise<void>
  onDismiss: () => void
}

export interface BloodWorkConfirmCardProps {
  kind: 'blood-work'
  date: string
  /** Markers as extracted. `unit: null` means the user didn't say a unit
   *  and the card shows a unit picker for that marker. */
  markers: Array<{ name: string; value: number; unit: string | null }>
  /** Test seam — defaults to `event-confirm-card-blood-work`. */
  testId?: string
  /**
   * Confirm callback — receives the markers with units resolved (any null
   * units replaced by the user's unit-picker selection). Parent passes
   * these through to `createBloodWork`.
   */
  onConfirm: (
    resolvedMarkers: Array<{ name: string; value: number; unit: string }>,
  ) => void | Promise<void>
  onDismiss: () => void
}

export type EventConfirmCardProps = VisitConfirmCardProps | BloodWorkConfirmCardProps

type CardState = 'prompt' | 'saved' | 'dismissed' | 'error'

const visitTypeLabel: Record<VisitConfirmCardProps['visitType'], string> = {
  consultation: 'Consultation',
  'follow-up': 'Follow-up',
  urgent: 'Urgent',
  other: 'Visit',
}

export function EventConfirmCard(
  props: EventConfirmCardProps,
): React.JSX.Element {
  const testId = props.testId ?? `event-confirm-card-${props.kind}`
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<CardState>('prompt')

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
    // INVARIANT: do NOT add 'error' to this guard list. The retry button at
    // the bottom of this file calls setDone('prompt') then synchronously
    // invokes handleConfirm — but the setDone is queued, so handleConfirm
    // still reads done='error' on the call stack. If 'error' were added
    // here the retry path would silently no-op. Re-saving an already
    // 'saved' or 'dismissed' card is the only thing this guard protects.
    if (done === 'saved' || done === 'dismissed') return
    setBusy(true)
    try {
      if (props.kind === 'visit') {
        await props.onConfirm()
      } else {
        const resolved = props.markers.map((m, i) => ({
          name: m.name,
          value: m.value,
          unit: unitPicks[i] ?? COMMON_UNITS[0],
        }))
        await props.onConfirm(resolved)
      }
      setDone('saved')
    } catch {
      // Surface a retry affordance instead of stranding the card mid-save.
      setDone('error')
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = (): void => {
    if (busy || done === 'saved' || done === 'dismissed') return
    setDone('dismissed')
    props.onDismiss()
  }

  const titleText =
    props.kind === 'visit'
      ? `Doctor visit on ${formatDate(props.date)}?`
      : `Blood work on ${formatDate(props.date)}?`

  if (done === 'saved') {
    return (
      <section
        data-testid={testId}
        data-state="saved"
        className="mx-6 mt-4 rounded-2xl border p-6"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-card)',
        }}
      >
        <p className="type-label">
          {props.kind === 'visit' ? 'Doctor visit' : 'Blood work'}
        </p>
        <p className="type-body mt-2" style={{ color: 'var(--ink-muted)' }}>
          Saved.
        </p>
      </section>
    )
  }

  if (done === 'dismissed') {
    // Silent — render nothing.
    return <></>
  }

  if (done === 'error') {
    return (
      <section
        data-testid={testId}
        data-state="error"
        className="mx-6 mt-4 rounded-2xl border p-6"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-card)',
        }}
      >
        <p className="type-label">{titleText}</p>
        <p className="type-body mt-2" style={{ color: 'var(--ink-muted)' }}>
          Couldn&rsquo;t save. Tap retry?
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid={`${testId}-retry`}
            onClick={() => {
              setDone('prompt')
              void handleConfirm()
            }}
            className={
              'inline-flex min-h-11 items-center justify-center rounded-full ' +
              'px-5 text-[15px] font-medium transition-colors ' +
              'focus-visible:outline-none focus-visible:ring-2 ' +
              'focus-visible:ring-offset-2'
            }
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            Retry
          </button>
          <button
            type="button"
            data-testid={`${testId}-dismiss`}
            onClick={handleDismiss}
            className={
              'inline-flex min-h-11 items-center justify-center rounded-full ' +
              'border px-5 text-[15px] font-medium transition-colors ' +
              'focus-visible:outline-none focus-visible:ring-2 ' +
              'focus-visible:ring-offset-2'
            }
            style={{
              borderColor: 'var(--rule)',
              color: 'var(--ink)',
              background: 'transparent',
            }}
          >
            Not now
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      data-testid={testId}
      data-state="prompt"
      className="mx-6 mt-4 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <p className="type-label">{titleText}</p>
      <h3
        className="mt-3"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: '1.125rem',
          lineHeight: 1.25,
          fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          color: 'var(--ink)',
        }}
      >
        {props.kind === 'visit' ? (
          <>
            I heard: {props.doctorName} · {visitTypeLabel[props.visitType]}
          </>
        ) : (
          <>Here&rsquo;s what I caught:</>
        )}
      </h3>
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
                  <label
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    <span>Unit</span>
                    <select
                      data-testid={`${testId}-unit-${i}`}
                      value={unitPicks[i] ?? COMMON_UNITS[0]}
                      onChange={(e) => {
                        const next = [...unitPicks]
                        next[i] = e.target.value
                        setUnitPicks(next)
                      }}
                      className="min-h-9 rounded-md border px-2"
                      style={{
                        borderColor: 'var(--rule)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--ink)',
                      }}
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
        <button
          type="button"
          data-testid={`${testId}-confirm`}
          disabled={busy}
          onClick={handleConfirm}
          className={
            'inline-flex min-h-11 items-center justify-center rounded-full ' +
            'px-5 text-[15px] font-medium transition-colors ' +
            'focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-offset-2 disabled:opacity-60'
          }
          style={{
            background: 'var(--sage-deep)',
            color: 'var(--bg-elevated)',
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          data-testid={`${testId}-dismiss`}
          disabled={busy}
          onClick={handleDismiss}
          className={
            'inline-flex min-h-11 items-center justify-center rounded-full ' +
            'border px-5 text-[15px] font-medium transition-colors ' +
            'focus-visible:outline-none focus-visible:ring-2 ' +
            'focus-visible:ring-offset-2 disabled:opacity-60'
          }
          style={{
            borderColor: 'var(--rule)',
            color: 'var(--ink)',
            background: 'transparent',
          }}
        >
          Not now
        </button>
      </div>
    </section>
  )
}
