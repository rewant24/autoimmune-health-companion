/**
 * <EventRow> + <TaskStateIcon> tests (US-2.C.2 + US-2.C.3).
 *
 * Asserts row layout, click + keyboard activation, aria-label format,
 * sr-only state label, and the colour-blind-safe shape contract on
 * TaskStateIcon (each state's glyph is structurally distinct).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EventRow } from '@/components/memory/EventRow'
import { TaskStateIcon } from '@/components/memory/TaskStateIcon'
import type { MemoryEvent, TaskState } from '@/components/memory/_types'

function makeEvent(overrides: Partial<MemoryEvent> = {}): MemoryEvent {
  return {
    type: 'check-in',
    eventId: 'checkin:abc',
    date: '2026-04-25',
    time: '08:30',
    title: 'Daily check-in',
    meta: 'Pain 3 · Okay',
    taskState: 'done',
    ...overrides,
  } as MemoryEvent
}

describe('<EventRow />', () => {
  it('renders title, time, meta, and the state icon', () => {
    render(<EventRow event={makeEvent()} />)
    expect(screen.getByText('Daily check-in')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()
    expect(screen.getByText('Pain 3 · Okay')).toBeInTheDocument()
    // sr-only label from TaskStateIcon proves the icon is mounted.
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('fires onTap with eventId when clicked', async () => {
    const onTap = vi.fn()
    render(<EventRow event={makeEvent({ eventId: 'evt-1' })} onTap={onTap} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onTap).toHaveBeenCalledWith('evt-1')
  })

  it('activates on keyboard Enter', async () => {
    const onTap = vi.fn()
    render(<EventRow event={makeEvent({ eventId: 'evt-2' })} onTap={onTap} />)
    const btn = screen.getByRole('button')
    btn.focus()
    await userEvent.keyboard('{Enter}')
    expect(onTap).toHaveBeenCalledWith('evt-2')
  })

  it('activates on keyboard Space', async () => {
    const onTap = vi.fn()
    render(<EventRow event={makeEvent({ eventId: 'evt-3' })} onTap={onTap} />)
    const btn = screen.getByRole('button')
    btn.focus()
    await userEvent.keyboard(' ')
    expect(onTap).toHaveBeenCalledWith('evt-3')
  })

  it('aria-label follows "{time}, {title}, {state}" format', () => {
    render(
      <EventRow
        event={makeEvent({ time: '09:15', title: 'Take meds', taskState: 'pending' })}
      />,
    )
    expect(
      screen.getByRole('button', { name: '09:15, Take meds, Pending' }),
    ).toBeInTheDocument()
  })

  it('renders the sr-only state label that matches the icon state', () => {
    const { rerender } = render(<EventRow event={makeEvent({ taskState: 'pending' })} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    rerender(<EventRow event={makeEvent({ taskState: 'missed' })} />)
    expect(screen.getByText('Missed')).toBeInTheDocument()
  })

  it('hides meta line when meta is empty', () => {
    render(<EventRow event={makeEvent({ meta: '' })} />)
    expect(screen.queryByText('Pain 3 · Okay')).not.toBeInTheDocument()
  })

  it('does not add an entrance animation class (reduced-motion safe)', () => {
    render(<EventRow event={makeEvent()} />)
    const btn = screen.getByRole('button')
    // Smoke check: row uses transition-colors only (no transform/opacity
    // entrance). If a future tweak adds e.g. animate-fade-in, this guards
    // it behind a reduced-motion gate.
    expect(btn.className).not.toMatch(/animate-/)
  })
})

describe('<TaskStateIcon />', () => {
  const STATES: TaskState[] = ['pending', 'done', 'missed']

  it.each(STATES)('renders an sr-only label for "%s"', (state) => {
    const labels: Record<TaskState, string> = {
      pending: 'Pending',
      done: 'Done',
      missed: 'Missed',
    }
    render(<TaskStateIcon state={state} />)
    expect(screen.getByText(labels[state])).toBeInTheDocument()
  })

  it('renders structurally distinct glyphs across states (colour-blind safe)', () => {
    const { container, rerender } = render(<TaskStateIcon state="pending" />)
    // pending: circle only, no extra path.
    expect(container.querySelectorAll('circle').length).toBe(1)
    expect(container.querySelector('polyline')).toBeNull()
    expect(container.querySelector('line')).toBeNull()

    // done: circle + polyline (check mark).
    rerender(<TaskStateIcon state="done" />)
    expect(container.querySelector('polyline')).not.toBeNull()
    expect(container.querySelector('line')).toBeNull()

    // missed: circle + line (strike).
    rerender(<TaskStateIcon state="missed" />)
    expect(container.querySelector('polyline')).toBeNull()
    expect(container.querySelector('line')).not.toBeNull()
  })

  it('honours the size prop', () => {
    const { container } = render(<TaskStateIcon state="done" size={32} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('32')
    expect(svg?.getAttribute('height')).toBe('32')
  })
})
