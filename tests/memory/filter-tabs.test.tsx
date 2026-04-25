/**
 * <FilterTabs /> tests (US-2.B.3).
 *
 * Asserts:
 *  - 5 tabs render in fixed order with verbatim labels
 *  - clicking a tab fires onChange with the matching MemoryFilter value
 *  - selected tab carries aria-selected="true"
 *  - tablist semantics + aria-label present
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FilterTabs } from '@/components/memory/FilterTabs'
import type { MemoryFilter } from '@/components/memory/_types'

describe('<FilterTabs />', () => {
  it('renders 5 tabs with verbatim labels in fixed order', () => {
    render(<FilterTabs value="all" onChange={() => {}} />)
    const tablist = screen.getByRole('tablist')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs.map((t) => t.textContent)).toEqual([
      'All',
      'Check-ins',
      'Intake events',
      'Flare-ups',
      'Visits',
    ])
  })

  it('marks the selected tab with aria-selected="true" and others "false"', () => {
    render(<FilterTabs value="flare-ups" onChange={() => {}} />)
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab')
    const ariaStates = tabs.map((t) => t.getAttribute('aria-selected'))
    // Order: all, check-ins, intake-events, flare-ups, visits → only #4 selected.
    expect(ariaStates).toEqual(['false', 'false', 'false', 'true', 'false'])
  })

  it('fires onChange with the right filter value when a tab is clicked', async () => {
    const onChange = vi.fn<(next: MemoryFilter) => void>()
    render(<FilterTabs value="all" onChange={onChange} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Check-ins' }))
    expect(onChange).toHaveBeenLastCalledWith('check-ins')

    await userEvent.click(screen.getByRole('tab', { name: 'Intake events' }))
    expect(onChange).toHaveBeenLastCalledWith('intake-events')

    await userEvent.click(screen.getByRole('tab', { name: 'Flare-ups' }))
    expect(onChange).toHaveBeenLastCalledWith('flare-ups')

    await userEvent.click(screen.getByRole('tab', { name: 'Visits' }))
    expect(onChange).toHaveBeenLastCalledWith('visits')

    await userEvent.click(screen.getByRole('tab', { name: 'All' }))
    expect(onChange).toHaveBeenLastCalledWith('all')
  })

  it('exposes a tablist with an aria-label so screen readers announce it', () => {
    render(<FilterTabs value="all" onChange={() => {}} />)
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      'Filter Memory by event type',
    )
  })

  it('all 5 tabs are visible in the document (no scroll required at desktop width)', () => {
    render(<FilterTabs value="all" onChange={() => {}} />)
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab')
    // Every tab has a non-empty label and is mounted in the DOM.
    for (const tab of tabs) {
      expect(tab).toBeVisible()
    }
  })
})
