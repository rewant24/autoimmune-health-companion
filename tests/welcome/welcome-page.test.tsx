/**
 * /welcome tests — Onboarding Shell cycle, Chunk C, Welcome.US-1.
 *
 * Coverage:
 *   - Renders the personalized greeting using `name` from `readProfile()`.
 *   - Falls back to a non-personalized greeting if name is null.
 *   - Calls `markOnboarded()` on mount.
 *   - Single CTA "Open my home page" links to /home.
 *   - Voice = "endurance + together" — explicitly assert the greeting
 *     contains "endure" + does NOT contain the prior "gentle / soft / calm"
 *     framing.
 */

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import WelcomePage from '@/app/welcome/page'
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
  vi.restoreAllMocks()
})

describe('/welcome page', () => {
  it('renders the personalized greeting with the user’s name from profile', () => {
    seedProfile({ name: 'Asha' })
    render(<WelcomePage />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent ?? '').toMatch(/Asha/)
  })

  it('falls back gracefully when no name is in the profile', () => {
    seedProfile({ name: null })
    render(<WelcomePage />)
    const heading = screen.getByRole('heading', { level: 1 })
    // The fallback text should still render (no crash, no "null") — assert
    // both that "null" doesn't leak and that we see the endurance line.
    expect(heading.textContent ?? '').not.toMatch(/null/i)
    expect(heading.textContent ?? '').toMatch(/endure/i)
  })

  it('renders even with an entirely empty profile (direct-link safety)', () => {
    // No seed at all.
    render(<WelcomePage />)
    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
  })

  it('marks the profile onboarded on mount', () => {
    seedProfile({ name: 'Asha', onboarded: false })
    render(<WelcomePage />)
    const stored = JSON.parse(
      window.localStorage.getItem(PROFILE_KEY) ?? '{}',
    ) as Profile
    expect(stored.onboarded).toBe(true)
    expect(stored.name).toBe('Asha')
  })

  it('shows a single primary CTA "Open my home page" linking to /home', () => {
    render(<WelcomePage />)
    const cta = screen.getByTestId('welcome-cta')
    expect(cta.getAttribute('href')).toBe('/home')
    expect(cta.textContent ?? '').toMatch(/open my home page/i)
  })

  it('uses the "endurance + together" brand voice (rebrand guard)', () => {
    seedProfile({ name: 'Asha' })
    render(<WelcomePage />)
    const region = screen.getByTestId('welcome-screen')
    const text = region.textContent ?? ''
    // Must speak in the locked voice.
    expect(text).toMatch(/endure/i)
    // Must NOT use the prior "gentle/soft/calm/kind" framing.
    expect(text).not.toMatch(/\bgentle\b/i)
    expect(text).not.toMatch(/\bsoft\b/i)
    expect(text).not.toMatch(/\bcalm\b/i)
  })
})
