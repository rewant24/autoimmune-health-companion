/**
 * /setup/dob — Setup.US-2 + Setup.US-5 (direct-link guard).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pushSpy = vi.fn()
const replaceSpy = vi.fn()
// Stabilize the mocked router across renders. See condition-step.test.tsx
// for the rationale.
const mockRouter = { push: pushSpy, replace: replaceSpy }
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

import SetupDobPage from '@/app/setup/dob/page'
import {
  composeDobIso,
  isValidDob,
} from '@/components/setup/DOBField'
import { clearProfile, readProfile, writeProfile } from '@/lib/profile/storage'

describe('/setup/dob page', () => {
  beforeEach(() => {
    pushSpy.mockReset()
    replaceSpy.mockReset()
    clearProfile()
  })
  afterEach(() => clearProfile())

  it('redirects to /setup/name when name is missing', () => {
    render(<SetupDobPage />)
    expect(replaceSpy).toHaveBeenCalledWith('/setup/name')
  })

  it('does not redirect when name is filled', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('disables Next until a valid date is composed', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('writes dobIso and routes to /setup/email when filled', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    fireEvent.change(screen.getByTestId('dob-month'), { target: { value: '4' } })
    fireEvent.change(screen.getByTestId('dob-day'), { target: { value: '12' } })
    fireEvent.change(screen.getByTestId('dob-year'), { target: { value: '1992' } })
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(readProfile()?.dobIso).toBe('1992-04-12')
    expect(pushSpy).toHaveBeenCalledWith('/setup/email')
  })
})

describe('composeDobIso / isValidDob (DOBField helpers)', () => {
  it('rejects incomplete values', () => {
    expect(composeDobIso({ month: null, day: 1, year: 1990 })).toBeNull()
    expect(composeDobIso({ month: 1, day: null, year: 1990 })).toBeNull()
    expect(composeDobIso({ month: 1, day: 1, year: null })).toBeNull()
  })

  it('rejects future dates', () => {
    const next = new Date().getFullYear() + 1
    expect(composeDobIso({ month: 1, day: 1, year: next })).toBeNull()
    expect(isValidDob({ month: 1, day: 1, year: next })).toBe(false)
  })

  it('rejects pre-1925 dates', () => {
    expect(composeDobIso({ month: 1, day: 1, year: 1924 })).toBeNull()
  })

  it('accepts the year 1925 boundary', () => {
    expect(composeDobIso({ month: 1, day: 1, year: 1925 })).toBe('1925-01-01')
  })

  it('rejects Feb 29 in a non-leap year', () => {
    expect(composeDobIso({ month: 2, day: 29, year: 1990 })).toBeNull()
  })

  it('accepts Feb 29 in a leap year', () => {
    expect(composeDobIso({ month: 2, day: 29, year: 1992 })).toBe('1992-02-29')
  })

  it('rejects Feb 30', () => {
    expect(composeDobIso({ month: 2, day: 30, year: 1992 })).toBeNull()
  })

  it('produces zero-padded YYYY-MM-DD', () => {
    expect(composeDobIso({ month: 4, day: 5, year: 2000 })).toBe('2000-04-05')
  })
})
