/**
 * Onboarding Shell — full-chain smoke test (Task 2.2).
 *
 * Drives the chain end-to-end and asserts the `saha.profile.v1` localStorage
 * shape after the user has walked through every screen:
 *
 *   /                 → "Get started" CTA visible (pre-onboarded)
 *   /onboarding/1..5  → Next ×4, then "Start my first check-in" → /setup/name
 *   /setup/name       → write name
 *   /setup/dob        → write dobIso
 *   /setup/email      → write email (lowercased + trimmed)
 *   /setup/condition  → write condition (+ optional conditionOther)
 *   /welcome          → markOnboarded() runs on mount
 *   /home             → bottom nav present, Home active
 *
 * Approach: each step's per-component test already covers DOM behaviour,
 * routing, and field validation. The smoke test's value is asserting that
 * (a) the chain wires up the SAME `saha.profile.v1` storage end-to-end,
 * (b) `markOnboarded()` flips correctly on /welcome mount,
 * (c) the final localStorage shape matches the locked Profile contract.
 *
 * Driving this through `userEvent.click` on each page in sequence would
 * require remounting the next page after each navigation (useRouter is
 * mocked) — heavy and largely redundant with per-step tests. Instead we
 * exercise the public storage API + WelcomeScreen mount, then assert the
 * single integrated shape.
 *
 * Owned by orchestrator (Task 2 integration).
 */

import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replaceSpy = vi.fn()
const pushSpy = vi.fn()
const mockRouter = {
  push: pushSpy,
  replace: replaceSpy,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}
let mockPathname = '/welcome'
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}))

import { WelcomeScreen } from '@/components/welcome/WelcomeScreen'
import {
  clearProfile,
  markOnboarded,
  readProfile,
  writeProfile,
} from '@/lib/profile/storage'
import { PROFILE_KEY } from '@/lib/profile/types'

beforeEach(() => {
  clearProfile()
  pushSpy.mockReset()
  replaceSpy.mockReset()
  mockPathname = '/welcome'
})

afterEach(() => {
  clearProfile()
})

describe('Onboarding Shell — full-chain smoke', () => {
  it('walking the chain produces a complete saha.profile.v1 in localStorage', async () => {
    // /setup/name — user types "Asha"
    writeProfile({ name: 'Asha' })

    // /setup/dob — user picks 1990-05-12
    writeProfile({ dobIso: '1990-05-12' })

    // /setup/email — page lowercases + trims before write
    writeProfile({ email: 'asha@example.com' })

    // /setup/condition — picks lupus (no Other free text)
    writeProfile({ condition: 'lupus' })

    // /welcome — mount runs markOnboarded() and renders the greeting.
    render(<WelcomeScreen />)
    // The component pulls the name async via useEffect — wait for the
    // personalised greeting before we look at localStorage.
    await waitFor(() =>
      expect(
        screen.getByText(/Asha, this is yours to endure/i),
      ).toBeInTheDocument(),
    )

    const profile = readProfile()
    expect(profile).not.toBeNull()
    expect(profile).toMatchObject({
      v: 1,
      name: 'Asha',
      dobIso: '1990-05-12',
      email: 'asha@example.com',
      condition: 'lupus',
      conditionOther: null,
      onboarded: true,
    })
    // Spot-check the storage key contract.
    const raw = window.localStorage.getItem(PROFILE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).v).toBe(1)
    // Sanity: createdAtMs ≤ updatedAtMs and updatedAtMs is recent.
    const now = Date.now()
    expect(profile!.createdAtMs).toBeLessThanOrEqual(profile!.updatedAtMs)
    expect(now - profile!.updatedAtMs).toBeLessThan(5_000)
  })

  it('the "Other" condition path persists conditionOther free text', () => {
    writeProfile({ name: 'Riya', dobIso: '1985-01-01', email: 'r@x.io' })
    writeProfile({ condition: 'other', conditionOther: 'IgG4 disease' })
    markOnboarded()

    const profile = readProfile()
    expect(profile?.condition).toBe('other')
    expect(profile?.conditionOther).toBe('IgG4 disease')
    expect(profile?.onboarded).toBe(true)
  })

  it('markOnboarded() is idempotent — second call leaves onboarded=true', () => {
    writeProfile({ name: 'A', dobIso: '1990-01-01', email: 'a@b.co', condition: 'lupus' })
    markOnboarded()
    const first = readProfile()
    markOnboarded()
    const second = readProfile()
    expect(first?.onboarded).toBe(true)
    expect(second?.onboarded).toBe(true)
    // updatedAtMs is monotonic — second mark is ≥ first.
    expect(second!.updatedAtMs).toBeGreaterThanOrEqual(first!.updatedAtMs)
  })
})
