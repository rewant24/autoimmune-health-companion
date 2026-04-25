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

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { MemoryEvent, MemoryFilter } from './_types'
import { WeekScrubber } from './WeekScrubber'
import { FilterTabs } from './FilterTabs'

export interface MemoryTabProps {
  events: MemoryEvent[]
  initialFilter?: MemoryFilter
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
        'pb-[max(1rem,env(safe-area-inset-bottom))] ' +
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
          data-testid="memory-search-icon"
          onClick={() => {
            /* chunk 2.E wires SearchBar */
          }}
          className={
            'flex h-11 w-11 items-center justify-center rounded-full ' +
            'text-[color:var(--ink-muted)] hover:bg-[color:var(--sage-soft)] ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sage)]'
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
        Day-list area — chunk 2.C composes <DayView> in here at
        integration. Until then, just an empty container so the layout
        height is stable.
      */}
      <div
        data-testid="day-list-area"
        data-selected-date={selectedDate}
        data-filter={filter}
        className="flex flex-1 flex-col gap-4"
      />
    </main>
  )
}
