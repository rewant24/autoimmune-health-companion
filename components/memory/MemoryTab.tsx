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
import type { MemoryEvent, MemoryFilter } from './_types'
import { applyFilter } from '@/lib/memory/filters'
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

/** Today as YYYY-MM-DD in IST (en-CA emits ISO-style YYYY-MM-DD). */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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
        <button
          type="button"
          aria-label="Search your check-ins"
          aria-disabled="true"
          title="Search coming soon"
          data-testid="memory-search-icon"
          onClick={() => {
            /* chunk 2.E wires SearchBar */
          }}
          className={
            'flex h-11 w-11 items-center justify-center rounded-full ' +
            'text-[color:var(--ink-subtle)] hover:bg-[color:var(--sage-soft)] ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sage)] ' +
            'cursor-not-allowed'
          }
        >
          <svg
            aria-hidden
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
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
    </main>
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
