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

const TEST_USER_KEY = 'saumya.testUser.v1'

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

/** YYYY-MM-DD in IST for an offset (in days) from today. */
function istDateOffset(daysOffset: number): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + daysOffset)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
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

  const events = result?.events ?? []

  return <MemoryTab events={events} initialFilter={initialFilter} />
}

export default function JourneyMemoryPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <JourneyMemoryInner />
    </Suspense>
  )
}
