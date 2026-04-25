/**
 * <FilterTabs /> tests (US-2.B.3).
 *
 * a11y note: the component intentionally uses `<nav>` + `aria-pressed`
 * rather than the WAI-ARIA tab pattern, because filter chips don't switch
 * panels — they filter content in place. (Reviewer 3 catch during F02 C1
 * review pass.) Tests assert the nav semantics, not tablist.
 *
 * Asserts:
 *  - 5 chips render in fixed order with verbatim labels
 *  - clicking a chip fires onChange with the matching MemoryFilter value
 *  - selected chip carries aria-pressed="true"
 *  - <nav> + aria-label present so SRs announce the filter group
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FilterTabs } from '@/components/memory/FilterTabs'
import type { MemoryFilter } from '@/components/memory/_types'

function getFilterNav(): HTMLElement {
  return screen.getByRole('navigation', {
    name: 'Filter Memory by event type',
  })
}

describe('<FilterTabs />', () => {
  it('renders 5 chips with verbatim labels in fixed order', () => {
    render(<FilterTabs value="all" onChange={() => {}} />)
    const tabs = within(getFilterNav()).getAllByRole('button')
    expect(tabs).toHaveLength(5)
    expect(tabs.map((t) => t.textContent)).toEqual([
      'All',
      'Check-ins',
      'Intake events',
      'Flare-ups',
      'Visits',
    ])
  })

  it('marks the selected chip with aria-pressed="true" and others "false"', () => {
    render(<FilterTabs value="flare-ups" onChange={() => {}} />)
    const tabs = within(getFilterNav()).getAllByRole('button')
    const ariaStates = tabs.map((t) => t.getAttribute('aria-pressed'))
    // Order: all, check-ins, intake-events, flare-ups, visits → only #4 selected.
    expect(ariaStates).toEqual(['false', 'false', 'false', 'true', 'false'])
  })

  it('fires onChange with the right filter value when a chip is clicked', async () => {
    const onChange = vi.fn<(next: MemoryFilter) => void>()
    render(<FilterTabs value="all" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Check-ins' }))
    expect(onChange).toHaveBeenLastCalledWith('check-ins')

    await userEvent.click(screen.getByRole('button', { name: 'Intake events' }))
    expect(onChange).toHaveBeenLastCalledWith('intake-events')

    await userEvent.click(screen.getByRole('button', { name: 'Flare-ups' }))
    expect(onChange).toHaveBeenLastCalledWith('flare-ups')

    await userEvent.click(screen.getByRole('button', { name: 'Visits' }))
    expect(onChange).toHaveBeenLastCalledWith('visits')

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenLastCalledWith('all')
  })

  it('exposes a nav with an aria-label so screen readers announce it', () => {
    render(<FilterTabs value="all" onChange={() => {}} />)
    expect(getFilterNav()).toBeInTheDocument()
  })

  it('all 5 chips are visible in the document (no scroll required at desktop width)', () => {
    render(<FilterTabs value="all" onChange={() => {}} />)
    const tabs = within(getFilterNav()).getAllByRole('button')
    for (const tab of tabs) {
      expect(tab).toBeVisible()
    }
  })
})
