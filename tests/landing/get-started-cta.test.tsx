/**
 * Landing "Get started" CTA tests — Onboarding Shell cycle, Chunk C,
 * Landing.US-1.
 *
 * Coverage:
 *   - Pre-hydration / no profile: label "Get started", href /onboarding/1.
 *   - Onboarded profile: label "Open your home page", href /home.
 *   - Profile present but onboarded=false: still routes to /onboarding/1.
 *   - Renders inside the LandingPage hero (additive insertion guard).
 */

import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GetStartedCTA } from '@/components/landing/GetStartedCTA'
import { LandingPage } from '@/app/LandingPage'
import {
  PROFILE_KEY,
  type Profile,
} from '@/lib/profile/types'
import { clearProfile } from '@/lib/profile/storage'

function seedProfile(patch: Partial<Profile>): void {
  const base: Profile = {
    v: 1,
    name: null,
    dobIso: null,
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
})

describe('<GetStartedCTA />', () => {
  it('defaults to "Get started" → /onboarding/1 when no profile is stored', async () => {
    render(<GetStartedCTA />)
    const cta = screen.getByTestId('landing-get-started-cta')
    // After effect runs there's still no profile → still default.
    await waitFor(() =>
      expect(cta.getAttribute('data-onboarded')).toBe('false'),
    )
    expect(cta.getAttribute('href')).toBe('/onboarding/1')
    expect(cta.textContent ?? '').toMatch(/get started/i)
  })

  it('flips to "Open your home page" → /home when profile.onboarded === true', async () => {
    seedProfile({ name: 'Asha', onboarded: true })
    render(<GetStartedCTA />)
    const cta = screen.getByTestId('landing-get-started-cta')
    await waitFor(() =>
      expect(cta.getAttribute('data-onboarded')).toBe('true'),
    )
    expect(cta.getAttribute('href')).toBe('/home')
    expect(cta.textContent ?? '').toMatch(/open your home page/i)
  })

  it('keeps the default label when a profile exists but is not onboarded', async () => {
    seedProfile({ name: 'Asha', onboarded: false })
    render(<GetStartedCTA />)
    const cta = screen.getByTestId('landing-get-started-cta')
    // Wait long enough for the effect to run; should remain false.
    await waitFor(() =>
      expect(cta.getAttribute('data-onboarded')).toBe('false'),
    )
    expect(cta.getAttribute('href')).toBe('/onboarding/1')
  })
})

describe('LandingPage — additive CTA insertion', () => {
  it('renders the new GetStartedCTA inside the hero', () => {
    render(<LandingPage />)
    expect(
      screen.getByTestId('landing-get-started-cta'),
    ).toBeInTheDocument()
  })

  it('keeps the existing waitlist form intact alongside the new CTA', () => {
    render(<LandingPage />)
    expect(screen.getByTestId('landing-get-started-cta')).toBeInTheDocument()
    // WaitlistForm renders a form element with an email input — assert at
    // least one is present (the page renders the form twice, hero + final
    // CTA section).
    const emailInputs = document.querySelectorAll('input[type="email"]')
    expect(emailInputs.length).toBeGreaterThan(0)
  })
})
