/**
 * F02 C1 smoke test — wires MemoryTab end-to-end with seeded events.
 *
 * Per the build plan, C1 ships chunks 2.A + 2.B + 2.C only. The full
 * integration test (US-2.F.2 — seed 45 check-ins, edit, delete, etc.)
 * lands in C2. This test is the lightweight C1 gate: load the Memory
 * tab with 5 seeded events on the selected day, assert the scrubber +
 * filter tabs + day list all render, and that the day list reflects
 * the events.
 *
 * Tests the component (not the full page) so Convex mocking from
 * tests/setup.ts doesn't matter — events are passed in as a prop.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// next/navigation hooks (`useRouter`, `usePathname`, `useSearchParams`)
// throw outside the App Router runtime. MemoryTab calls all three for
// URL filter sync; stub them so the component can mount in tests.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => {}, push: () => {}, back: () => {} }),
  usePathname: () => '/journey/memory',
  useSearchParams: () => new URLSearchParams(),
}))

import { MemoryTab, todayIST } from '@/components/memory/MemoryTab'
import type { MemoryEvent } from '@/components/memory/_types'

function seedEvents(date: string): MemoryEvent[] {
  // 5 events on the given day: 2 check-ins, 1 flare, 1 intake, 1 visit.
  // All `taskState='done'` so they land in the Completed group (matches
  // C1 reality: eventFromCheckin emits done check-ins by default).
  return [
    {
      type: 'check-in',
      eventId: 'checkin:s1',
      date,
      time: '08:00',
      title: 'Daily check-in',
      meta: 'Pain 3 · Bright',
      taskState: 'done',
      payload: {
        pain: 3,
        mood: 'bright',
        adherenceTaken: true,
        energy: 7,
        transcript: 'Slept well.',
        checkinId: 's1',
      },
    },
    {
      type: 'check-in',
      eventId: 'checkin:s2',
      date,
      time: '20:00',
      title: 'Daily check-in',
      meta: 'Pain 5 · Okay',
      taskState: 'done',
      payload: {
        pain: 5,
        mood: 'okay',
        adherenceTaken: false,
        energy: 4,
        transcript: 'Stiffness in fingers.',
        checkinId: 's2',
      },
    },
    {
      type: 'flare',
      eventId: 'flare:s2',
      date,
      time: '20:00',
      title: 'Flare-up logged',
      meta: '',
      taskState: 'done',
      payload: { checkinId: 's2' },
    },
    {
      type: 'intake',
      eventId: 'intake:i1',
      date,
      time: '09:00',
      title: 'Methotrexate',
      meta: '15mg',
      taskState: 'done',
      payload: {},
    },
    {
      type: 'visit',
      eventId: 'visit:v1',
      date,
      time: '14:30',
      title: 'Rheumatology follow-up',
      meta: 'Dr. Sharma',
      taskState: 'done',
      payload: {},
    },
  ] as MemoryEvent[]
}

describe('F02 C1 smoke — MemoryTab integrated with seeded events', () => {
  it('renders header, scrubber, filter tabs, and day-list area', () => {
    render(<MemoryTab events={seedEvents(todayIST())} />)

    // Header — title + search icon.
    expect(
      screen.getByRole('heading', { name: 'Memory', level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Search your check-ins' }),
    ).toBeInTheDocument()

    // FilterTabs — 5 labels in fixed order. Filter chips use <nav> +
    // aria-pressed (not WAI-ARIA tablist) per F02 C1 review pass.
    const filterNav = screen.getByRole('navigation', {
      name: /filter memory/i,
    })
    const tabs = within(filterNav).getAllByRole('button')
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      'All',
      'Check-ins',
      'Intake events',
      'Flare-ups',
      'Visits',
    ])

    // Day-list area exists with selectedDate + filter data attrs.
    const dayList = screen.getByTestId('day-list-area')
    expect(dayList).toHaveAttribute('data-selected-date', todayIST())
    expect(dayList).toHaveAttribute('data-filter', 'all')
  })

  it('renders DayView for the selected day with the seeded events', () => {
    render(<MemoryTab events={seedEvents(todayIST())} />)

    const dayList = screen.getByTestId('day-list-area')

    // DayView renders the "Today" sticky header.
    expect(within(dayList).getByText('Today')).toBeInTheDocument()

    // All 5 seeded events are taskState='done' → all collapse into the
    // Completed group with count "(5)" — collapsed by default.
    const completedToggle = within(dayList).getByRole('button', {
      name: /Completed \(5\)/,
    })
    expect(completedToggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders empty when no events for the selected day', () => {
    // Seed events on a non-selected day; today should show no Completed.
    render(<MemoryTab events={seedEvents('2025-01-01')} />)

    const dayList = screen.getByTestId('day-list-area')
    expect(within(dayList).getByText('Today')).toBeInTheDocument()
    expect(within(dayList).queryByText(/Completed/)).not.toBeInTheDocument()
  })
})
