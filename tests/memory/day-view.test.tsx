/**
 * <DayView> tests (US-2.C.1).
 *
 * Asserts: today / non-today header format, fixed group order, that
 * completed events render only in the Completed group (not duplicated),
 * empty groups are skipped, and the Completed group is collapsible.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DayView } from '@/components/memory/DayView'
import type { MemoryEvent } from '@/components/memory/_types'

/** Local copy of DayView's todayIST() so we can drive the today-header
 *  test independently without exporting a private helper. */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function evt(overrides: Partial<MemoryEvent>): MemoryEvent {
  return {
    type: 'check-in',
    eventId: `e-${Math.random().toString(36).slice(2, 7)}`,
    date: '2026-04-22',
    time: '08:00',
    title: 'Daily check-in',
    meta: '',
    taskState: 'pending',
    ...overrides,
  } as MemoryEvent
}

describe('<DayView />', () => {
  it('renders "Today" when date matches today in IST', () => {
    render(<DayView date={todayIST()} events={[]} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders short formatted header for non-today dates', () => {
    // 2026-04-21 IST is a Tuesday.
    render(<DayView date="2026-04-21" events={[]} />)
    // Format: "Tue, Apr 21" via en-US weekday/short.
    const header = screen.getByText(/Tue/)
    expect(header).toBeInTheDocument()
    expect(header.textContent).toMatch(/Apr/)
    expect(header.textContent).toMatch(/21/)
  })

  it('places completed events ONLY in the Completed group', () => {
    const events: MemoryEvent[] = [
      evt({ type: 'check-in', taskState: 'done', title: 'Daily check-in' }),
      evt({ type: 'flare', taskState: 'done', title: 'Flare-up logged' }),
    ]
    render(<DayView date="2026-04-22" events={events} />)

    // The pending group sections must not exist (their headers absent).
    expect(screen.queryByText("Today's check-in")).not.toBeInTheDocument()
    expect(screen.queryByText('Other events')).not.toBeInTheDocument()
    expect(screen.queryByText('Medication intake')).not.toBeInTheDocument()

    // Completed exists and starts collapsed → header reads with count.
    const completedHeader = screen.getByRole('button', {
      name: /Completed \(2\)/,
    })
    expect(completedHeader).toBeInTheDocument()
    expect(completedHeader).toHaveAttribute('aria-expanded', 'false')
  })

  it('places non-completed events in their type group, not Completed', () => {
    const events: MemoryEvent[] = [
      evt({ type: 'check-in', taskState: 'pending', title: 'Daily check-in' }),
      evt({ type: 'intake', taskState: 'pending', title: 'Take meds' }),
      evt({ type: 'flare', taskState: 'missed', title: 'Flare-up' }),
    ]
    render(<DayView date="2026-04-22" events={events} />)

    expect(screen.getByText("Today's check-in")).toBeInTheDocument()
    expect(screen.getByText('Medication intake')).toBeInTheDocument()
    expect(screen.getByText('Other events')).toBeInTheDocument()
    // No Completed section since nothing is done.
    expect(screen.queryByText(/Completed/)).not.toBeInTheDocument()

    // Each row is rendered as a button with our aria-label format.
    expect(
      screen.getByRole('button', { name: /Daily check-in, Pending/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Take meds, Pending/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Flare-up, Missed/ }),
    ).toBeInTheDocument()
  })

  it('does not render headers for empty group sections', () => {
    const events: MemoryEvent[] = [
      evt({ type: 'intake', taskState: 'pending', title: 'Take meds' }),
    ]
    render(<DayView date="2026-04-22" events={events} />)
    expect(screen.getByText('Medication intake')).toBeInTheDocument()
    expect(screen.queryByText("Today's check-in")).not.toBeInTheDocument()
    expect(screen.queryByText('Other events')).not.toBeInTheDocument()
    expect(screen.queryByText(/Completed/)).not.toBeInTheDocument()
  })

  it('Completed group toggles aria-expanded and reveals rows on click', async () => {
    const events: MemoryEvent[] = [
      evt({
        type: 'check-in',
        taskState: 'done',
        title: 'Daily check-in',
        eventId: 'e1',
      }),
    ]
    render(<DayView date="2026-04-22" events={events} />)

    const toggle = screen.getByRole('button', { name: /Completed/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // Row is hidden while collapsed.
    expect(
      screen.queryByRole('button', { name: /Daily check-in, Done/ }),
    ).not.toBeInTheDocument()

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: /Daily check-in, Done/ }),
    ).toBeInTheDocument()

    // Toggle back collapses again.
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('button', { name: /Daily check-in, Done/ }),
    ).not.toBeInTheDocument()
  })

  it('forwards onEventTap from rows up to the consumer', async () => {
    const taps: string[] = []
    const events: MemoryEvent[] = [
      evt({
        type: 'check-in',
        taskState: 'pending',
        title: 'Daily check-in',
        eventId: 'tap-me',
      }),
    ]
    render(
      <DayView
        date="2026-04-22"
        events={events}
        onEventTap={(id) => taps.push(id)}
      />,
    )
    const row = screen.getByRole('button', { name: /Daily check-in, Pending/ })
    await userEvent.click(row)
    expect(taps).toEqual(['tap-me'])
  })

  it('renders sections in the documented order', () => {
    const events: MemoryEvent[] = [
      evt({ type: 'flare', taskState: 'missed', title: 'Flare', eventId: 'e-flare' }),
      evt({ type: 'check-in', taskState: 'pending', title: 'Daily check-in', eventId: 'e-ci' }),
      evt({ type: 'intake', taskState: 'pending', title: 'Take meds', eventId: 'e-intake' }),
    ]
    const { container } = render(<DayView date="2026-04-22" events={events} />)
    const sections = Array.from(
      container.querySelectorAll('section[data-event-group]'),
    )
    const labels = sections.map((s) => s.getAttribute('data-event-group'))
    expect(labels).toEqual([
      "Today's check-in",
      'Medication intake',
      'Other events',
    ])
    // Suppress the unused `within` import warning (keeps the import for
    // future tests; tooling complains otherwise).
    expect(within).toBeDefined()
  })
})
