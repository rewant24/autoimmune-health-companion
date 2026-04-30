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
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { MemoryFilter } from '@/components/memory/_types'
import { MemoryTab } from '@/components/memory/MemoryTab'

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

  const events = result?.events ?? []
  // Loading = userId is provisioned but Convex query hasn't resolved.
  // Pre-userId render is also a kind of "loading" but instant — keep the
  // banner specifically for the network round-trip so it doesn't flash.
  const isLoading = userId !== null && result === undefined

  return (
    <>
      <MemoryTab
        events={events}
        initialFilter={initialFilter}
        isLoading={isLoading}
      />
      {/*
        Sprint F05 chunk 5.B — manual-capture entry points. Per
        docs/features/05-doctor-visits.md US-5.B.3: "Memory affordance is a
        single button at the bottom of the day view: '+ Log visit or blood
        work'." Kept light: two stacked link buttons inside a max-w-2xl
        container, sage-soft on the parent so they sit visually under the
        day list rather than competing with the FilterTabs.
      */}
      <div
        data-testid="memory-log-affordance"
        className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-2 px-6 pb-8"
      >
        <Link
          href="/visits/new"
          data-testid="memory-log-visit-link"
          className={
            'inline-flex h-12 w-full items-center justify-center rounded-full ' +
            'border border-[var(--rule)] bg-[var(--bg-card)] text-sm text-[var(--ink-muted)] ' +
            'transition-colors hover:border-[var(--sage)] hover:text-[var(--ink)]'
          }
        >
          + Log visit
        </Link>
        <Link
          href="/blood-work/new"
          data-testid="memory-log-blood-work-link"
          className={
            'inline-flex h-12 w-full items-center justify-center rounded-full ' +
            'border border-[var(--rule)] bg-[var(--bg-card)] text-sm text-[var(--ink-muted)] ' +
            'transition-colors hover:border-[var(--sage)] hover:text-[var(--ink)]'
          }
        >
          + Log blood work
        </Link>
      </div>
    </>
  )
}

export default function JourneyMemoryPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <JourneyMemoryInner />
    </Suspense>
  )
}
