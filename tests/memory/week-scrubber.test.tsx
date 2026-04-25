/**
 * <WeekScrubber /> tests (US-2.B.2).
 *
 * Asserts:
 *  - 7 cells render with the expected date numbers
 *  - selected cell carries `aria-current="date"` + data-selected="true"
 *  - tap fires onSelectDay with the YYYY-MM-DD of the tapped cell
 *  - cell with an event in `events` shows the event-dot
 *  - cell with a flare event shows the flare marker
 *  - month label reflects the selected date
 *  - keyboard arrow-left / arrow-right navigates by one day
 *  - prev/next week buttons jump 7 days (kbd-accessible alternative to swipe)
 *
 * a11y note: cells are plain buttons inside a `<nav>`, not `gridcell` —
 * see Reviewer 3 catch during F02 C1 review.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WeekScrubber } from '@/components/memory/WeekScrubber'
import type { MemoryEvent } from '@/components/memory/_types'

// 2026-04-22 is a Wednesday — the week is Sun 19 ... Sat 25 April 2026.
const SELECTED = '2026-04-22'
const SUNDAY = '2026-04-19'
const SATURDAY = '2026-04-25'

function makeEvent(overrides: Partial<MemoryEvent> = {}): MemoryEvent {
  // The cast to MemoryEvent is intentional — the discriminated union
  // requires `payload` per variant, but for scrubber rendering only the
  // surface fields are read. The fixture stays minimal.
  return {
    type: 'check-in',
    eventId: 'e1',
    date: SELECTED,
    time: '08:00',
    title: 'Daily check-in',
    meta: 'Pain 3',
    taskState: 'done',
    ...overrides,
  } as MemoryEvent
}

describe('<WeekScrubber />', () => {
  it('renders 7 cells for the week containing the selected date', () => {
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={() => {}}
        todayDate="2026-04-25"
      />,
    )
    // Week starts Sunday 19 → ends Saturday 25.
    for (let day = 19; day <= 25; day++) {
      const iso = `2026-04-${String(day).padStart(2, '0')}`
      expect(screen.getByTestId(`week-cell-${iso}`)).toBeInTheDocument()
    }
    // First and last day numbers visible in the strip.
    expect(screen.getByTestId(`week-cell-${SUNDAY}`)).toHaveTextContent('19')
    expect(screen.getByTestId(`week-cell-${SATURDAY}`)).toHaveTextContent('25')
  })

  it('marks the selected cell with aria-current="date" + data-selected', () => {
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={() => {}}
        todayDate="2026-04-25"
      />,
    )
    const cell = screen.getByTestId(`week-cell-${SELECTED}`)
    expect(cell).toHaveAttribute('aria-current', 'date')
    expect(cell).toHaveAttribute('data-selected', 'true')
    // Sibling is not selected — aria-current omitted entirely on non-selected cells.
    const sibling = screen.getByTestId(`week-cell-${SUNDAY}`)
    expect(sibling).not.toHaveAttribute('aria-current')
    expect(sibling).toHaveAttribute('data-selected', 'false')
  })

  it('marks the today cell with data-today even when not selected', () => {
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={() => {}}
        todayDate="2026-04-23"
      />,
    )
    expect(screen.getByTestId('week-cell-2026-04-23')).toHaveAttribute(
      'data-today',
      'true',
    )
    expect(screen.getByTestId(`week-cell-${SELECTED}`)).toHaveAttribute(
      'data-today',
      'false',
    )
  })

  it('fires onSelectDay with the tapped cell date', async () => {
    const onSelectDay = vi.fn()
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={onSelectDay}
        todayDate="2026-04-25"
      />,
    )
    await userEvent.click(screen.getByTestId(`week-cell-${SUNDAY}`))
    expect(onSelectDay).toHaveBeenCalledWith(SUNDAY)
  })

  it('shows the event-dot when an event exists for that day', () => {
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[makeEvent({ date: '2026-04-21' })]}
        onSelectDay={() => {}}
        todayDate="2026-04-25"
      />,
    )
    expect(
      screen.getByTestId('week-cell-2026-04-21-event-dot'),
    ).toBeInTheDocument()
    // No event on Sunday → no dot.
    expect(
      screen.queryByTestId(`week-cell-${SUNDAY}-event-dot`),
    ).not.toBeInTheDocument()
  })

  it('shows a flare marker when a flare event exists for that day', () => {
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[makeEvent({ date: '2026-04-22', type: 'flare' })]}
        onSelectDay={() => {}}
        todayDate="2026-04-25"
      />,
    )
    expect(
      screen.getByTestId('week-cell-2026-04-22-flare-marker'),
    ).toBeInTheDocument()
  })

  it('shows the month label and updates with the selected date', () => {
    const { rerender } = render(
      <WeekScrubber
        selectedDate="2026-04-22"
        events={[]}
        onSelectDay={() => {}}
        todayDate="2026-04-25"
      />,
    )
    expect(screen.getByTestId('week-scrubber-month')).toHaveTextContent(
      'April 2026',
    )
    rerender(
      <WeekScrubber
        selectedDate="2026-05-04"
        events={[]}
        onSelectDay={() => {}}
        todayDate="2026-04-25"
      />,
    )
    expect(screen.getByTestId('week-scrubber-month')).toHaveTextContent(
      'May 2026',
    )
  })

  it('arrow-right moves selection forward by one day', async () => {
    const onSelectDay = vi.fn()
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={onSelectDay}
        todayDate="2026-04-25"
      />,
    )
    const cell = screen.getByTestId(`week-cell-${SELECTED}`)
    cell.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelectDay).toHaveBeenCalledWith('2026-04-23')
  })

  it('arrow-left moves selection back by one day', async () => {
    const onSelectDay = vi.fn()
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={onSelectDay}
        todayDate="2026-04-25"
      />,
    )
    const cell = screen.getByTestId(`week-cell-${SELECTED}`)
    cell.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onSelectDay).toHaveBeenCalledWith('2026-04-21')
  })

  it('next-week button jumps selection forward by 7 days', async () => {
    const onSelectDay = vi.fn()
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={onSelectDay}
        todayDate="2026-04-25"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-04-29')
  })

  it('prev-week button jumps selection back by 7 days', async () => {
    const onSelectDay = vi.fn()
    render(
      <WeekScrubber
        selectedDate={SELECTED}
        events={[]}
        onSelectDay={onSelectDay}
        todayDate="2026-04-25"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-04-15')
  })
})
