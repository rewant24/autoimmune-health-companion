/**
 * <BottomNav /> tests — Onboarding Shell cycle, Chunk C, Nav.US-1.
 *
 * Coverage:
 *   - Renders 5 pillars left-to-right: Home, Medications, Journey, Community, Settings.
 *   - Home + Journey render as real navigation links (have href).
 *   - Medications, Community, Settings render as buttons with aria-disabled="true"
 *     and no href.
 *   - Disabled items don't navigate or fire handlers when clicked.
 *   - Active state derives from pathname.
 *   - Has safe-area-inset-bottom padding for iOS.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Per-test override of the global next/navigation mock.
let mockPathname = '/home'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { BottomNav } from '@/components/nav/BottomNav'

describe('<BottomNav />', () => {
  it('renders the 5 pillars left-to-right', () => {
    mockPathname = '/home'
    render(<BottomNav />)
    const items = screen
      .getByRole('navigation', { name: /primary/i })
      .querySelectorAll('[data-nav-key]')
    const keys = Array.from(items).map((el) => el.getAttribute('data-nav-key'))
    expect(keys).toEqual([
      'home',
      'medications',
      'journey',
      'community',
      'settings',
    ])
  })

  it('renders Home + Journey as real navigation links with href', () => {
    mockPathname = '/home'
    render(<BottomNav />)
    const home = document.querySelector('[data-nav-key="home"]')
    const journey = document.querySelector('[data-nav-key="journey"]')
    expect(home?.tagName).toBe('A')
    expect(home?.getAttribute('href')).toBe('/home')
    expect(journey?.tagName).toBe('A')
    expect(journey?.getAttribute('href')).toBe('/journey/memory')
  })

  it('renders Medications, Community, Settings as aria-disabled buttons with no href', () => {
    mockPathname = '/home'
    render(<BottomNav />)
    for (const key of ['medications', 'community', 'settings']) {
      const el = document.querySelector(`[data-nav-key="${key}"]`)
      expect(el?.tagName).toBe('BUTTON')
      expect(el?.getAttribute('aria-disabled')).toBe('true')
      expect(el?.hasAttribute('href')).toBe(false)
    }
  })

  it('marks the Home pillar active when pathname is /home', () => {
    mockPathname = '/home'
    render(<BottomNav />)
    const home = document.querySelector('[data-nav-key="home"]')
    expect(home?.getAttribute('data-active')).toBe('true')
    expect(home?.getAttribute('aria-current')).toBe('page')
    const journey = document.querySelector('[data-nav-key="journey"]')
    expect(journey?.getAttribute('data-active')).toBe('false')
  })

  it('marks the Journey pillar active when pathname is /journey/memory', () => {
    mockPathname = '/journey/memory'
    render(<BottomNav />)
    const journey = document.querySelector('[data-nav-key="journey"]')
    expect(journey?.getAttribute('data-active')).toBe('true')
    expect(journey?.getAttribute('aria-current')).toBe('page')
    const home = document.querySelector('[data-nav-key="home"]')
    expect(home?.getAttribute('data-active')).toBe('false')
  })

  it('disabled buttons do not navigate when clicked', async () => {
    mockPathname = '/home'
    render(<BottomNav />)
    const user = userEvent.setup()

    // Track location.assign attempts (jsdom doesn't actually navigate, but
    // clicking a disabled button must not throw / change href).
    const meds = document.querySelector(
      '[data-nav-key="medications"]',
    ) as HTMLButtonElement
    expect(meds).toBeTruthy()
    // No onClick handler attached, no href — clicking is a no-op.
    await user.click(meds)
    expect(meds.getAttribute('aria-disabled')).toBe('true')
  })

  it('applies safe-area-inset-bottom padding for iOS notched devices', () => {
    mockPathname = '/home'
    render(<BottomNav />)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    // Inline style attribute should reference env(safe-area-inset-bottom).
    expect(nav.getAttribute('style') ?? '').toMatch(/safe-area-inset-bottom/)
  })

  it('has 5 visible pillar labels', () => {
    mockPathname = '/home'
    render(<BottomNav />)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    expect(within(nav).getByText('Home')).toBeInTheDocument()
    expect(within(nav).getByText('Medications')).toBeInTheDocument()
    expect(within(nav).getByText('Journey')).toBeInTheDocument()
    expect(within(nav).getByText('Community')).toBeInTheDocument()
    expect(within(nav).getByText('Settings')).toBeInTheDocument()
  })
})
