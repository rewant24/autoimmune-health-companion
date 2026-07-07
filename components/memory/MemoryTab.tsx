'use client'

/**
 * MemoryTab — top-level layout for the Memory screen.
 *
 * Feature 02, Chunk 2.B, US-2.B.1.
 *
 * Composes:
 *   - Header: "Memory" title + search icon button (44pt hit target).
 *     Search icon is a no-op stub here; chunk 2.E wires SearchBar.
 *   - <WeekScrubber> (chunk 2.B)
 *   - <FilterTabs>   (chunk 2.B)
 *   - day-list area  — placeholder testid; chunk 2.C composes <DayView>
 *     into this slot at integration.
 *
 * State:
 *   - selectedDate: defaults to today IST, controlled by scrubber.
 *   - filter: initial from prop (read off `?filter=` in the page),
 *     reflected back into the URL via `router.replace` on change.
 */

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { MemoryEvent, MemoryFilter } from './_types'
import { applyFilter } from '@/lib/memory/filters'
import { todayIST } from '@/lib/format/date'
import { WeekScrubber } from './WeekScrubber'
import { FilterTabs } from './FilterTabs'
import { DayView } from './DayView'

export interface MemoryTabProps {
  events: MemoryEvent[]
  initialFilter?: MemoryFilter
  /**
   * True while the parent is still resolving events (e.g. Convex query
   * pending). Surfaces a subtle "Loading your memory…" line so the screen
   * doesn't read as empty during the first round-trip.
   */
  isLoading?: boolean
}

export function MemoryTab({
  events,
  initialFilter = 'all',
  isLoading = false,
}: MemoryTabProps): React.JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selectedDate, setSelectedDate] = useState<string>(() => todayIST())
  const [filter, setFilter] = useState<MemoryFilter>(initialFilter)

  const handleFilterChange = useCallback(
    (next: MemoryFilter): void => {
      setFilter(next)
      // Preserve other query params, just update `filter`.
      const params = new URLSearchParams(
        searchParams ? Array.from(searchParams.entries()) : [],
      )
      if (next === 'all') {
        params.delete('filter')
      } else {
        params.set('filter', next)
      }
      const qs = params.toString()
      const target = qs ? `${pathname}?${qs}` : pathname
      // `replace` keeps history clean — no entry per filter tap.
      router.replace(target)
    },
    [pathname, router, searchParams],
  )

  return (
    <main
      data-testid="memory-tab"
      className={
        'mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col gap-3 px-4 ' +
        'pt-[max(1rem,env(safe-area-inset-top))] ' +
        // Bottom padding leaves room for the persistent <BottomNav /> mounted
        // by app/journey/layout.tsx (~4rem tall + safe-area). Without this,
        // the last event row scrolls under the nav.
        'pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] ' +
        'overflow-x-hidden'
      }
      style={{ background: 'var(--bg)' }}
    >
      <header className="flex items-center justify-between gap-2 py-2">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--ink)]">
          Memory
        </h1>
        {/*
          Search affordance was a no-op stub from F02 (chunk 2.E was deferred).
          Hidden until the real cross-table search ships — promising
          functionality through a disabled icon was misleading at smoke. See
          docs/post-mvp-backlog.md for the scoped follow-up.
        */}
      </header>

      <WeekScrubber
        selectedDate={selectedDate}
        events={events}
        onSelectDay={setSelectedDate}
      />

      <FilterTabs value={filter} onChange={handleFilterChange} />

      {/*
        Day-list area — renders <DayView> for the currently selected day.
        Filtered events are derived from the global events prop. Reverse-
        chronological scroll across previous days is a C2 enhancement; C1
        ships single-day rendering for the selected scrubber day.
      */}
      <DayListArea
        selectedDate={selectedDate}
        events={events}
        filter={filter}
        isLoading={isLoading}
      />

      {/*
        F05 Cycle 1, Chunk 5.B, US-5.B.3 — log-visit / log-blood-work
        affordance at the bottom of the day-view region. Originally a
        `<details>` popover; replaced with side-by-side CTA pills in Lane D
        (housekeeping #10, spike doc docs/spikes/journey-bottom-cta.md).
        Placed once at the bottom of MemoryTab content (rather than per
        day) to avoid touching DayView, which is owned by another chunk.
      */}
      <LogVisitOrBloodWorkAffordance />
    </main>
  )
}

/**
 * Bottom-of-MemoryTab affordance for manual visit + blood-work logging.
 *
 * Lane D (housekeeping #10) replaced the original `<details>` popover with
 * two side-by-side CTA pills — recommendation B in
 * `docs/spikes/journey-bottom-cta.md`. Rationale:
 *   - One tap to flow (popover required two).
 *   - Zero new dependency, no popover state.
 *   - Matches Memory's existing pill vocabulary (filter tabs, event chips).
 *   - Hierarchy is "Log visit" filled (sage-deep, primary) + "Log blood
 *     work" outline (secondary) — resolves the "neither feels primary"
 *     two-equal-pills risk noted in § 4 of the spike.
 *
 * Test IDs preserved verbatim from the popover era so any downstream
 * selectors (analytics, e2e, manual smoke notes) keep working:
 *   - `memory-log-affordance` (container)
 *   - `memory-log-affordance-visit`
 *   - `memory-log-affordance-bloodwork`
 * The popover-era `memory-log-affordance-trigger` testid is intentionally
 * dropped — the trigger no longer exists.
 */
function LogVisitOrBloodWorkAffordance(): React.JSX.Element {
  return (
    <div
      data-testid="memory-log-affordance"
      className="flex flex-wrap gap-2 px-3 pt-2 pb-4"
    >
      <Link
        href="/visits/new"
        data-testid="memory-log-affordance-visit"
        className="min-h-[44px] flex-1 rounded-full px-5 py-3 text-center text-[15px] font-medium"
        style={{
          background: 'var(--sage-deep)',
          color: 'var(--bg-elevated)',
        }}
      >
        + Log visit
      </Link>
      <Link
        href="/blood-work/new"
        data-testid="memory-log-affordance-bloodwork"
        className="min-h-[44px] flex-1 rounded-full border px-5 py-3 text-center text-[15px] font-medium"
        style={{
          borderColor: 'var(--rule)',
          color: 'var(--ink)',
          background: 'transparent',
        }}
      >
        Log blood work
      </Link>
    </div>
  )
}

/**
 * Day-list area — single-day DayView for C1.
 *
 * Filters `events` to the selected date, then applies the active filter,
 * then hands the result to <DayView>. Wrapped as its own component so the
 * test selector `day-list-area` data-testid keeps a stable hook for the
 * smoke test, and so the C2 reverse-chron-scroll work has a clear seam.
 */
function DayListArea({
  selectedDate,
  events,
  filter,
  isLoading,
}: {
  selectedDate: string
  events: MemoryEvent[]
  filter: MemoryFilter
  isLoading: boolean
}): React.JSX.Element {
  const dayEvents = useMemo(
    () =>
      applyFilter(
        events.filter((e) => e.date === selectedDate),
        filter,
      ),
    [events, selectedDate, filter],
  )

  return (
    <div
      data-testid="day-list-area"
      data-selected-date={selectedDate}
      data-filter={filter}
      data-loading={isLoading ? 'true' : 'false'}
      className="flex flex-1 flex-col gap-4"
    >
      {isLoading ? (
        <div
          data-testid="day-list-loading"
          aria-live="polite"
          className="px-3 py-4 text-sm text-[color:var(--ink-subtle)]"
        >
          Loading your memory…
        </div>
      ) : (
        <DayView date={selectedDate} events={dayEvents} />
      )}
    </div>
  )
}
