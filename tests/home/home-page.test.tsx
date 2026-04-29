/**
 * /home tests — Onboarding Shell cycle, Chunk C, Home.US-1 + US-2.
 *
 * Coverage:
 *   - Composition order: greeting → check-in → meds → viz → bottom nav.
 *   - Personalized greeting when name in profile.
 *   - "Welcome" fallback when no name.
 *   - Direct-link guard: not onboarded → redirect to /onboarding/1.
 *   - Direct-link guard: empty profile → redirect to /onboarding/1.
 *   - MedsSetupNudgeCard is aria-disabled.
 *   - MetricVizPlaceholder uses the locked Q4 copy.
 *   - CheckInPromptCard CTA links to /check-in.
 *   - BottomNav is rendered.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const replaceSpy = vi.fn()
let mockPathname = '/home'
// Stabilize the mocked router across renders. Returning a fresh object on
// every `useRouter()` call would invalidate any `useEffect` dep on `router`
// every render and (when the effect calls `setState` with an object) loop
// forever. Same pattern as the setup tests.
const mockRouter = {
  push: vi.fn(),
  replace: replaceSpy,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}))

import HomePage from '@/app/home/page'
import {
  PROFILE_KEY,
  type Profile,
} from '@/lib/profile/types'
import { clearProfile } from '@/lib/profile/storage'

function seedProfile(patch: Partial<Profile>): void {
  const base: Profile = {
    v: 2,
    name: null,
    dobMonth: null,
    dobYear: null,
    email: null,
    condition: null,
    conditionOther: null,
    onboarded: false,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  }
  window.localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...base, ...patch }),
  )
}

afterEach(() => {
  clearProfile()
  replaceSpy.mockReset()
  mockPathname = '/home'
})

describe('/home page', () => {
  it('renders the composition in top-to-bottom order when onboarded', async () => {
    seedProfile({ name: 'Asha', onboarded: true })
    render(<HomePage />)
    await waitFor(() =>
      expect(screen.getByTestId('home-page')).toBeInTheDocument(),
    )

    const main = screen.getByTestId('home-page')
    const order = [
      'home-greeting',
      'checkin-prompt-card',
      'meds-setup-nudge',
      'metric-viz-placeholder',
      'bottom-nav',
    ]
    const positions = order.map((id) => {
      const el = main.querySelector(`[data-testid="${id}"]`)
      expect(el, `expected ${id} in /home`).toBeTruthy()
      // compareDocumentPosition gives a stable left-to-right reading order.
      return el as Element
    })
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1]!
      const curr = positions[i]!
      // eslint-disable-next-line no-bitwise
      const flags = prev.compareDocumentPosition(curr)
      // eslint-disable-next-line no-bitwise
      expect(flags & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('shows personalized "Welcome, [name]" when name is in profile', async () => {
    seedProfile({ name: 'Asha', onboarded: true })
    render(<HomePage />)
    await waitFor(() =>
      expect(screen.getByTestId('home-page')).toBeInTheDocument(),
    )
    expect(screen.getByText(/welcome, asha/i)).toBeInTheDocument()
  })

  it('shows plain "Welcome" when name is missing but onboarded is true', async () => {
    seedProfile({ name: null, onboarded: true })
    render(<HomePage />)
    await waitFor(() =>
      expect(screen.getByTestId('home-page')).toBeInTheDocument(),
    )
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent?.trim()).toBe('Welcome')
  })

  it('redirects to /onboarding/1 when profile is missing entirely', async () => {
    render(<HomePage />)
    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith('/onboarding/1'),
    )
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })

  it('redirects to /onboarding/1 when onboarded is false', async () => {
    seedProfile({ name: 'Asha', onboarded: false })
    render(<HomePage />)
    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith('/onboarding/1'),
    )
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })

  it('MedsSetupNudgeCard is non-interactive (no link, no button)', async () => {
    // R3 review #10: aria-disabled is meaningful only on interactive widgets;
    // applying it to a non-interactive landmark is a misuse. The card's
    // "disabled" state is communicated visually (opacity) and structurally
    // (zero focusable children).
    seedProfile({ name: 'Asha', onboarded: true })
    render(<HomePage />)
    await waitFor(() =>
      expect(screen.getByTestId('home-page')).toBeInTheDocument(),
    )
    const card = screen.getByTestId('meds-setup-nudge')
    expect(card.querySelector('a')).toBeNull()
    expect(card.querySelector('button')).toBeNull()
  })

  it('renders MetricVizPlaceholder with the locked Q4 copy', async () => {
    seedProfile({ onboarded: true })
    render(<HomePage />)
    await waitFor(() =>
      expect(screen.getByTestId('home-page')).toBeInTheDocument(),
    )
    expect(
      screen.getByText(
        /your patterns will appear here once you've been checking in/i,
      ),
    ).toBeInTheDocument()
  })

  it('CheckInPromptCard CTA links to /check-in', async () => {
    seedProfile({ onboarded: true })
    render(<HomePage />)
    await waitFor(() =>
      expect(screen.getByTestId('home-page')).toBeInTheDocument(),
    )
    const cta = screen.getByTestId('checkin-prompt-cta')
    expect(cta.getAttribute('href')).toBe('/check-in')
  })

  it('renders BottomNav with Home pillar marked active', async () => {
    seedProfile({ onboarded: true })
    render(<HomePage />)
    await waitFor(() =>
      expect(screen.getByTestId('home-page')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    const home = document.querySelector('[data-nav-key="home"]')
    expect(home?.getAttribute('data-active')).toBe('true')
  })
})
