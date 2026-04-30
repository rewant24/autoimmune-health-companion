'use client'

/**
 * /journey/memory — the canonical Memory tab (Feature 02 Cycle 1).
 *
 * Wires:
 *   - `?filter=` URL param → MemoryTab's initial filter (US-2.B.3)
 *   - userId from localStorage (same key as F01's thin /memory page until
 *     F01 C2 lands real auth per ADR-019)
 *   - `listEventsByRange` Convex query (chunk 2.A) → MemoryTab's `events`
 *
 * Range: today minus 90 days to today plus 7 days. Wide enough to cover
 * any reasonable WeekScrubber position in C1; reverse-chron-scroll past
 * 90 days lands in C2.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { MemoryFilter } from '@/components/memory/_types'
import { MemoryTab } from '@/components/memory/MemoryTab'
import {
  eventFromVisit,
  eventFromBloodWork,
  type DoctorVisitRow,
  type BloodWorkRow,
  type MemoryEvent,
} from '@/lib/memory/event-types'

const TEST_USER_KEY = 'saha.testUser.v1'

const FILTER_VALUES: ReadonlySet<MemoryFilter> = new Set([
  'all',
  'check-ins',
  'intake-events',
  'flare-ups',
  'visits',
])

function parseFilter(raw: string | null): MemoryFilter {
  if (raw && (FILTER_VALUES as Set<string>).has(raw)) {
    return raw as MemoryFilter
  }
  return 'all'
}

/**
 * YYYY-MM-DD in IST for an offset (in days) from today.
 *
 * Anchors to *IST today*, not UTC now — so during the 18:30–23:59 UTC
 * window (when IST is already tomorrow) we don't get an off-by-one window.
 * Reviewer 2 catch.
 */
function istDateOffset(daysOffset: number): string {
  const istToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m, d] = istToday.split('-').map(Number)
  // Construct in UTC so setUTCDate arithmetic is timezone-agnostic, then
  // read back UTC fields — the date string carries no time component so
  // there's no IST formatting to do here.
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + daysOffset)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Inner component — must be under <Suspense> because Next 16 requires
 * `useSearchParams` consumers to be suspended during static generation.
 */
function JourneyMemoryInner(): React.JSX.Element {
  const searchParams = useSearchParams()
  const initialFilter = parseFilter(searchParams?.get('filter') ?? null)

  // userId comes from localStorage until F01 C2 lands auth (ADR-019).
  // Same key + same provisioning as the F01-era /memory page.
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const existing = window.localStorage.getItem(TEST_USER_KEY)
    if (existing) {
      setUserId(existing)
      return
    }
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `u_${Math.random().toString(36).slice(2)}_${Date.now()}`
    window.localStorage.setItem(TEST_USER_KEY, fresh)
    setUserId(fresh)
  }, [])

  // Stable date range — recomputed on first render only. Re-mounts pick a
  // fresh window if the user reloads, which is fine for C1.
  const range = useMemo(
    () => ({ fromDate: istDateOffset(-90), toDate: istDateOffset(7) }),
    [],
  )

  const result = useQuery(
    api.checkIns.listEventsByRange,
    userId
      ? { userId, fromDate: range.fromDate, toDate: range.toDate }
      : 'skip',
  )

  // F05 chunk 5.C — visit + blood-work events fetched alongside check-in/
  // flare events. Chunk 5.A owns these queries (`listVisits`,
  // `listBloodWork`); during pre-merge isolation the queries may not yet
  // exist on the deploy, in which case `useQuery` resolves to `undefined`
  // and we treat the lists as empty. The integration step replaces these
  // with the canonical aggregation query (decision deferred per
  // docs/features/05-doctor-visits.md US-5.C.3 acceptance).
  const visitsResult = useQuery(
    // Cast through unknown because `anyApi` is a runtime proxy — the
    // generated api type doesn't yet declare these functions until 5.A
    // lands. Keeps this file compilable in the parallel build worktree.
    (api as unknown as { doctorVisits: { listVisits: typeof api.checkIns.listEventsByRange } })
      .doctorVisits?.listVisits,
    userId
      ? { userId, fromDate: range.fromDate, toDate: range.toDate }
      : 'skip',
  )
  const bloodWorkResult = useQuery(
    (api as unknown as { bloodWork: { listBloodWork: typeof api.checkIns.listEventsByRange } })
      .bloodWork?.listBloodWork,
    userId
      ? { userId, fromDate: range.fromDate, toDate: range.toDate }
      : 'skip',
  )

  // Today in IST drives the visit pending/done classification (future-dated
  // visits surface as pending). Re-derived per render — cheap, and avoids a
  // stale clock if the page is left mounted across midnight.
  const todayIST = useMemo(() => istDateOffset(0), [])

  const events = useMemo<MemoryEvent[]>(() => {
    const checkInEvents = result?.events ?? []
    const visitRows = (visitsResult as { items?: DoctorVisitRow[] } | undefined)
      ?.items
    const bloodWorkRows = (
      bloodWorkResult as { items?: BloodWorkRow[] } | undefined
    )?.items
    const visitEvents = (visitRows ?? []).map((row) =>
      eventFromVisit(row, todayIST),
    )
    const bloodWorkEvents = (bloodWorkRows ?? []).map((row) =>
      eventFromBloodWork(row),
    )
    return [...checkInEvents, ...visitEvents, ...bloodWorkEvents]
  }, [result?.events, visitsResult, bloodWorkResult, todayIST])

  // Loading = userId is provisioned but the primary check-in query hasn't
  // resolved. Visit / blood-work queries don't gate the loading banner —
  // they degrade silently to empty lists when chunk 5.A's deploy lags.
  const isLoading = userId !== null && result === undefined

  return (
    <MemoryTab
      events={events}
      initialFilter={initialFilter}
      isLoading={isLoading}
    />
  )
}

export default function JourneyMemoryPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <JourneyMemoryInner />
    </Suspense>
  )
}
