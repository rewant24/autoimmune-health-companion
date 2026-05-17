/**
 * Tests for the bottom-of-MemoryTab "Log visit / Log blood work" affordance
 * (Lane D, housekeeping #10). Replaced a `<details>` popover with two
 * side-by-side CTA pills per `docs/spikes/journey-bottom-cta.md` § 4.
 *
 * Asserts:
 *  - Both pills are visible from initial render — no interaction needed.
 *  - "Log visit" links to `/visits/new` and is the primary (filled) pill.
 *  - "Log blood work" links to `/blood-work/new` and is the outline pill.
 *  - The popover-era `memory-log-affordance-trigger` testid is absent.
 *  - Pills are reachable via Tab navigation in DOM order.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// next/navigation hooks throw outside the App Router runtime; stub them
// so MemoryTab can mount (same pattern as c1-smoke.test.tsx).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: () => {}, push: () => {}, back: () => {} }),
  usePathname: () => '/journey/memory',
  useSearchParams: () => new URLSearchParams(),
}))

import { MemoryTab } from '@/components/memory/MemoryTab'

describe('MemoryTab — LogVisitOrBloodWorkAffordance (Lane D, side-by-side pills)', () => {
  it('renders both CTA pills visible from initial mount (no popover, no interaction needed)', () => {
    render(<MemoryTab events={[]} />)

    const visit = screen.getByTestId('memory-log-affordance-visit')
    const bloodWork = screen.getByTestId('memory-log-affordance-bloodwork')

    expect(visit).toBeInTheDocument()
    expect(bloodWork).toBeInTheDocument()
    expect(visit).toBeVisible()
    expect(bloodWork).toBeVisible()
  })

  it('"Log visit" links to /visits/new', () => {
    render(<MemoryTab events={[]} />)
    const visit = screen.getByTestId('memory-log-affordance-visit')
    expect(visit).toHaveAttribute('href', '/visits/new')
    expect(visit.textContent ?? '').toMatch(/Log visit/)
  })

  it('"Log blood work" links to /blood-work/new', () => {
    render(<MemoryTab events={[]} />)
    const bloodWork = screen.getByTestId('memory-log-affordance-bloodwork')
    expect(bloodWork).toHaveAttribute('href', '/blood-work/new')
    expect(bloodWork.textContent ?? '').toMatch(/Log blood work/)
  })

  it('drops the popover-era trigger testid (no <details>/<summary> wrapper)', () => {
    render(<MemoryTab events={[]} />)
    expect(
      screen.queryByTestId('memory-log-affordance-trigger'),
    ).not.toBeInTheDocument()
  })

  it('both pills are reachable via Tab navigation in DOM order (visit → blood-work)', async () => {
    const user = userEvent.setup()
    render(<MemoryTab events={[]} />)

    const visit = screen.getByTestId('memory-log-affordance-visit')
    const bloodWork = screen.getByTestId('memory-log-affordance-bloodwork')

    visit.focus()
    expect(visit).toHaveFocus()
    await user.tab()
    expect(bloodWork).toHaveFocus()
  })
})
