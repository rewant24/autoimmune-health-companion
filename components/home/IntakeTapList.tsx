'use client'

/**
 * IntakeTapList — daily-adherence tap card on /home (F04 chunk 4.C, US-4.C.1).
 *
 * Reads `getTodayAdherence({ userId, date })` from chunk 4.A's medications
 * module and renders one row per active medication. Tap → optimistic flip
 * to "taken" + `logIntake({ source: 'home-tap', clientRequestId })`. The
 * Convex subscription provides the canonical state on the next tick; if
 * the mutation rejects, the optimistic flag is rolled back so the UI
 * matches truth.
 *
 * Hides itself when the regimen is empty — the SetupMedicationsNudge
 * (chunk 4.B's surface) is the only Home-page medications affordance in
 * that state.
 *
 * Convex API surface (assumed from chunk 4.A — typed via `(api as any)`
 * since the generated `convex/_generated/api.d.ts` only ships after
 * `npx convex dev` has run against the new modules):
 *   - query  `medications.getTodayAdherence({ userId, date })`
 *       → Array<{ medication: { _id, name, dose }, takenToday: boolean,
 *                  lastTakenAt?: number }>
 *   - mutation `medications.logIntake({ userId, medicationId, date,
 *                                       takenAt, source: 'home-tap',
 *                                       clientRequestId })`
 *
 * SSR / pre-onboarding: the parent `/home` only renders this once a
 * profile is loaded, so window access is safe at mount time.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

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

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/**
 * Format a UTC ms timestamp as HH:MM in the user's device-local timezone.
 *
 * The earlier implementation hardcoded IST (UTC+05:30). That was wrong for
 * any user not in India, and inconsistent with the rest of the app — every
 * other surface (check-in date boundary, doses query) uses device-local
 * time per ADR-027 / locked decision Q3. Using `toLocaleTimeString` keeps
 * the rendered "Taken at HH:MM" in the same timezone the user just tapped.
 */
function formatTimeLocal(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

interface AdherenceRow {
  medication: { _id: string; name: string; dose: string }
  takenToday: boolean
  lastTakenAt?: number
}

export interface IntakeTapListProps {
  /** Test seam: skip the localStorage round-trip and use a known userId. */
  userIdOverride?: string
  /** Test seam: pin the date so jsdom timezone drift doesn't flake. */
  dateOverride?: string
}

export function IntakeTapList({
  userIdOverride,
  dateOverride,
}: IntakeTapListProps = {}): React.JSX.Element | null {
  const [userId, setUserId] = useState<string | null>(userIdOverride ?? null)
  // Device-local date string. When the page is left open across local
  // midnight, a 60s tick re-derives the date and only updates state on
  // change so the Convex `getTodayAdherence` subscription rebinds to the
  // new day. With `dateOverride` set (tests), the tick is suppressed so
  // the pinned date is stable.
  const [date, setDate] = useState<string>(() => dateOverride ?? todayIsoDate())
  useEffect(() => {
    if (dateOverride !== undefined) return
    const id = setInterval(() => {
      const next = todayIsoDate()
      setDate((prev) => (prev === next ? prev : next))
    }, 60_000)
    return () => clearInterval(id)
  }, [dateOverride])
  // Optimistic overlay: medicationId → "tapped + at-ts" until the Convex
  // subscription catches up. Rolled back on mutation error.
  const [optimistic, setOptimistic] = useState<Record<string, number>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  // Inline confirmation toast — surfaces on the first successful tap of
  // the day so the user has feedback the intake landed. Resets when the
  // device-local date rolls over so the next morning's first tap reads
  // "Logged." again.
  const [loggedToast, setLoggedToast] = useState<boolean>(false)
  const [toastShownForDate, setToastShownForDate] = useState<string | null>(null)
  useEffect(() => {
    if (!loggedToast) return
    const id = setTimeout(() => setLoggedToast(false), 2000)
    return () => clearTimeout(id)
  }, [loggedToast])

  useEffect(() => {
    if (userIdOverride !== undefined) {
      setUserId(userIdOverride)
      return
    }
    setUserId(getOrCreateTestUserId())
  }, [userIdOverride])

  // useMutation/useQuery from convex/react are typed against the generated
  // api. We keep a narrow `unknown` cast for these two calls until the
  // generated `FunctionReference` shapes are imported here directly.
  // Note: `getTodayAdherence` lives on `medications`; `logIntake` lives on
  // `intakeEvents` — the original code mistakenly called both off
  // `medications`, which 404'd at runtime against real Convex.
  const apiAny = api as unknown as {
    medications: {
      getTodayAdherence: never
    }
    intakeEvents: {
      logIntake: never
    }
  }

  const adherenceArg = userId ? { userId, date } : 'skip'
  const adherence = useQuery(
    apiAny.medications.getTodayAdherence,
    adherenceArg as never,
  ) as AdherenceRow[] | undefined

  const logIntakeRaw = useMutation(apiAny.intakeEvents.logIntake)
  const logIntake = logIntakeRaw as unknown as (args: {
    userId: string
    medicationId: string
    date: string
    takenAt: number
    source: 'home-tap'
    clientRequestId: string
  }) => Promise<unknown>

  const rows = useMemo<AdherenceRow[]>(() => {
    if (!adherence) return []
    return adherence.map((row) => {
      const optimisticTs = optimistic[row.medication._id]
      if (optimisticTs && !row.takenToday) {
        return { ...row, takenToday: true, lastTakenAt: optimisticTs }
      }
      return row
    })
  }, [adherence, optimistic])

  const handleTap = useCallback(
    async (row: AdherenceRow): Promise<void> => {
      if (!userId) return
      if (row.takenToday) return // first-writer-wins; tap is a no-op
      if (pending.has(row.medication._id)) return

      const medId = row.medication._id
      const takenAt = Date.now()
      setOptimistic((prev) => ({ ...prev, [medId]: takenAt }))
      setPending((prev) => {
        const next = new Set(prev)
        next.add(medId)
        return next
      })
      try {
        await logIntake({
          userId,
          medicationId: medId,
          date,
          takenAt,
          source: 'home-tap',
          clientRequestId: newRequestId(),
        })
        // First successful tap of the day per check-in date → flash the
        // "Logged." confirmation. Subsequent taps within the same date
        // are silent (the row's "Taken at HH:MM" subtext already gives
        // per-row feedback).
        if (toastShownForDate !== date) {
          setToastShownForDate(date)
          setLoggedToast(true)
        }
      } catch {
        // Rollback the optimistic flag — Convex subscription will reflect
        // truth once it reconciles, but the rollback gives instant feedback.
        setOptimistic((prev) => {
          const next = { ...prev }
          delete next[medId]
          return next
        })
      } finally {
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(medId)
          return next
        })
      }
    },
    [userId, date, logIntake, pending],
  )

  // Pre-load / empty regimen / pre-userId-resolve states all hide.
  if (!userId) return null
  if (!adherence) return null
  if (rows.length === 0) return null

  return (
    <section
      data-testid="intake-tap-list"
      className="mx-6 mt-4 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <div className="flex items-baseline justify-between">
        <p className="type-label">Today&rsquo;s doses</p>
        {loggedToast ? (
          <span
            data-testid="intake-tap-list-logged"
            role="status"
            aria-live="polite"
            className="type-label"
            style={{ color: 'var(--sage-deep)' }}
          >
            Logged.
          </span>
        ) : null}
      </div>
      <ul className="mt-3 divide-y" style={{ borderColor: 'var(--rule)' }}>
        {rows.map((row) => {
          const taken = row.takenToday
          const tappedAt = row.lastTakenAt
          return (
            <li
              key={row.medication._id}
              data-testid={`intake-row-${row.medication._id}`}
              data-taken={taken ? 'true' : 'false'}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p
                  className="truncate"
                  style={{
                    fontFamily: 'var(--font-fraunces)',
                    fontSize: '1.05rem',
                    lineHeight: 1.3,
                    fontVariationSettings:
                      "'SOFT' 100, 'opsz' 24, 'wght' 420",
                    color: 'var(--ink)',
                  }}
                >
                  {row.medication.name}
                </p>
                <p
                  className="type-body mt-1"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {row.medication.dose}
                  {taken && tappedAt
                    ? ` · Taken at ${formatTimeLocal(tappedAt)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                data-testid={`intake-tap-${row.medication._id}`}
                aria-pressed={taken}
                aria-label={
                  taken
                    ? `${row.medication.name} taken`
                    : `Mark ${row.medication.name} taken`
                }
                disabled={taken || pending.has(row.medication._id)}
                onClick={() => handleTap(row)}
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center ' +
                  'rounded-full border transition-colors ' +
                  'focus-visible:outline-none focus-visible:ring-2 ' +
                  'focus-visible:ring-offset-2 disabled:cursor-default'
                }
                style={{
                  borderColor: 'var(--rule)',
                  background: taken ? 'var(--sage-deep)' : 'transparent',
                  color: taken ? 'var(--bg-elevated)' : 'var(--ink)',
                }}
              >
                {taken ? (
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
