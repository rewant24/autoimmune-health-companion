'use client'

/**
 * WeekScrubber — horizontal calendar strip showing one week at a time.
 *
 * Feature 02, Chunk 2.B, US-2.B.2.
 *
 * - 7 cells (Sun-Sat) with date numbers; week is derived from
 *   `selectedDate` (YYYY-MM-DD IST).
 * - Selected day filled in sage-teal accent. Today carries a distinct
 *   ring indicator.
 * - Each cell shows a small dot if any event for that day exists, plus
 *   a flare marker (red) if any flare event for that day.
 * - Swipe left → next week, right → previous week. Tap → onSelectDay.
 * - Keyboard: arrow-left / arrow-right move selection by one day.
 * - No tier clamp — full history navigable.
 */

import { useMemo, useRef } from 'react'
import type { MemoryEvent } from './_types'

export interface WeekScrubberProps {
  /** Currently-selected day, YYYY-MM-DD IST. */
  selectedDate: string
  /** All events the page has loaded; used to show event-dot + flare marker. */
  events: MemoryEvent[]
  /** Fired when the user picks a different day. */
  onSelectDay: (date: string) => void
  /**
   * Optional override for "today" — used by tests so the snapshot is
   * deterministic. Defaults to `todayIST()`.
   */
  todayDate?: string
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Parse YYYY-MM-DD as a local Date at midnight (no TZ shenanigans). */
function parseISO(date: string): Date {
  const [y, m, d] = date.split('-').map((s) => Number(s))
  return new Date(y, m - 1, d)
}

/** Format a Date as YYYY-MM-DD using its local fields. */
function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today as YYYY-MM-DD in IST. */
function todayIST(): string {
  // en-CA emits ISO-style YYYY-MM-DD directly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Sunday of the week containing `iso`. */
function sundayOf(iso: string): Date {
  const d = parseISO(iso)
  const dow = d.getDay() // 0 = Sun
  d.setDate(d.getDate() - dow)
  return d
}

/** Build the 7 dates for the week containing `iso`. */
function buildWeek(iso: string): Date[] {
  const sunday = sundayOf(iso)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return d
  })
}

export function WeekScrubber({
  selectedDate,
  events,
  onSelectDay,
  todayDate,
}: WeekScrubberProps): React.JSX.Element {
  const today = todayDate ?? todayIST()

  const week = useMemo(() => buildWeek(selectedDate), [selectedDate])

  // Index events by date so cell render is O(1) per cell.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, { hasEvent: boolean; hasFlare: boolean }>()
    for (const ev of events) {
      const prev = map.get(ev.date) ?? { hasEvent: false, hasFlare: false }
      map.set(ev.date, {
        hasEvent: true,
        hasFlare: prev.hasFlare || ev.type === 'flare',
      })
    }
    return map
  }, [events])

  const monthLabel = useMemo(() => {
    const sel = parseISO(selectedDate)
    return `${MONTH_NAMES[sel.getMonth()]} ${sel.getFullYear()}`
  }, [selectedDate])

  // Swipe handling — track touchstart X and threshold on touchend.
  const touchStartXRef = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>): void => {
    const start = touchStartXRef.current
    touchStartXRef.current = null
    if (start === null) return
    const end = e.changedTouches[0]?.clientX ?? start
    const dx = end - start
    if (Math.abs(dx) < 50) return
    // Snap a full week.
    const sel = parseISO(selectedDate)
    sel.setDate(sel.getDate() + (dx < 0 ? 7 : -7))
    onSelectDay(formatISO(sel))
  }

  const handleKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    day: Date,
  ): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = new Date(day)
    next.setDate(day.getDate() + (e.key === 'ArrowRight' ? 1 : -1))
    onSelectDay(formatISO(next))
  }

  return (
    <div data-testid="week-scrubber" className="flex flex-col gap-2 select-none">
      <div
        data-testid="week-scrubber-month"
        className="sticky top-0 z-10 px-1 py-1 text-sm font-medium text-[color:var(--ink-muted)]"
      >
        {monthLabel}
      </div>

      <div
        role="group"
        aria-label="Week navigation"
        className="grid grid-cols-7 gap-1 px-1"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {week.map((day, i) => {
          const iso = formatISO(day)
          const isSelected = iso === selectedDate
          const isToday = iso === today
          const flags = eventsByDate.get(iso)
          const hasEvent = !!flags?.hasEvent
          const hasFlare = !!flags?.hasFlare

          const dayName = DAY_NAMES[day.getDay()]
          const ariaLabel = `${dayName}, ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}. ${
            hasEvent ? 'Check-in saved.' : 'No check-in.'
          }`

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-testid={`week-cell-${iso}`}
              data-selected={isSelected ? 'true' : 'false'}
              data-today={isToday ? 'true' : 'false'}
              aria-selected={isSelected}
              aria-label={ariaLabel}
              onClick={() => onSelectDay(iso)}
              onKeyDown={(e) => handleKey(e, day)}
              className={[
                'relative flex h-14 min-h-[44px] flex-col items-center justify-center',
                'rounded-xl text-sm transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sage)]',
                isSelected
                  ? 'bg-[color:var(--sage)] text-white'
                  : 'bg-[color:var(--bg-card)] text-[color:var(--ink)] hover:bg-[color:var(--sage-soft)]',
                isToday && !isSelected
                  ? 'ring-2 ring-[color:var(--sage)] ring-offset-1 ring-offset-[color:var(--bg)]'
                  : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-[10px] font-medium uppercase tracking-wider',
                  isSelected
                    ? 'text-white/80'
                    : 'text-[color:var(--ink-subtle)]',
                ].join(' ')}
                aria-hidden
              >
                {DAY_LETTERS[i]}
              </span>
              <span className="text-base font-semibold leading-none" aria-hidden>
                {day.getDate()}
              </span>

              {/* Markers row — event dot + flare marker. Hidden from a11y
                  tree because the aria-label already describes state. */}
              <span
                className="mt-1 flex items-center justify-center gap-0.5"
                aria-hidden
              >
                {hasEvent ? (
                  <span
                    data-testid={`week-cell-${iso}-event-dot`}
                    className={[
                      'block h-1 w-1 rounded-full',
                      isSelected
                        ? 'bg-white'
                        : 'bg-[color:var(--sage)]',
                    ].join(' ')}
                  />
                ) : null}
                {hasFlare ? (
                  <span
                    data-testid={`week-cell-${iso}-flare-marker`}
                    className={[
                      'block h-1 w-1 rounded-full',
                      isSelected ? 'bg-white' : 'bg-[color:var(--terracotta)]',
                    ].join(' ')}
                  />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
