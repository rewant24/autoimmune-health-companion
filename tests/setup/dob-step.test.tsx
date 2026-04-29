/**
 * /setup/dob — optional DOB (month + year) per 2026-04-29 tweak.
 *
 * Setup.US-2 + Setup.US-5 (direct-link guard).
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
  composeDobMonthYear,
  isOrphanMonth,
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

  it('Next is enabled by default (DOB is optional)', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
  })

  it('skipping both dropdowns persists (null, null) and routes to /setup/email', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const profile = readProfile()
    expect(profile?.dobMonth).toBeNull()
    expect(profile?.dobYear).toBeNull()
    expect(pushSpy).toHaveBeenCalledWith('/setup/email')
  })

  it('year only persists (null, year) and routes to /setup/email', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    fireEvent.change(screen.getByTestId('dob-year'), { target: { value: '1992' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const profile = readProfile()
    expect(profile?.dobMonth).toBeNull()
    expect(profile?.dobYear).toBe(1992)
    expect(pushSpy).toHaveBeenCalledWith('/setup/email')
  })

  it('month + year persists both and routes to /setup/email', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    fireEvent.change(screen.getByTestId('dob-month'), { target: { value: '4' } })
    fireEvent.change(screen.getByTestId('dob-year'), { target: { value: '1992' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const profile = readProfile()
    expect(profile?.dobMonth).toBe(4)
    expect(profile?.dobYear).toBe(1992)
    expect(pushSpy).toHaveBeenCalledWith('/setup/email')
  })

  it('month-only shows the orphan hint and Next still routes (persists null/null)', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupDobPage />)
    fireEvent.change(screen.getByTestId('dob-month'), { target: { value: '4' } })
    expect(screen.getByTestId('dob-orphan-month-hint')).toBeInTheDocument()
    // The orphan month stays visible in the dropdown so the user can correct.
    expect((screen.getByTestId('dob-month') as HTMLSelectElement).value).toBe('4')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const profile = readProfile()
    expect(profile?.dobMonth).toBeNull()
    expect(profile?.dobYear).toBeNull()
    expect(pushSpy).toHaveBeenCalledWith('/setup/email')
  })

  it('rehydrates prior dobMonth + dobYear from storage', () => {
    writeProfile({ name: 'Asha', dobMonth: 4, dobYear: 1992 })
    render(<SetupDobPage />)
    expect((screen.getByTestId('dob-month') as HTMLSelectElement).value).toBe('4')
    expect((screen.getByTestId('dob-year') as HTMLSelectElement).value).toBe('1992')
  })
})

describe('DOBField helpers', () => {
  it('isOrphanMonth: true only when month set without year', () => {
    expect(isOrphanMonth({ month: 4, year: null })).toBe(true)
    expect(isOrphanMonth({ month: null, year: null })).toBe(false)
    expect(isOrphanMonth({ month: null, year: 1990 })).toBe(false)
    expect(isOrphanMonth({ month: 4, year: 1990 })).toBe(false)
  })

  it('composeDobMonthYear: passes through valid pairs', () => {
    expect(composeDobMonthYear({ month: 4, year: 1992 })).toEqual({
      dobMonth: 4,
      dobYear: 1992,
    })
    expect(composeDobMonthYear({ month: null, year: 1992 })).toEqual({
      dobMonth: null,
      dobYear: 1992,
    })
    expect(composeDobMonthYear({ month: null, year: null })).toEqual({
      dobMonth: null,
      dobYear: null,
    })
  })

  it('composeDobMonthYear: orphan month coerces to (null, null)', () => {
    expect(composeDobMonthYear({ month: 4, year: null })).toEqual({
      dobMonth: null,
      dobYear: null,
    })
  })

  it('composeDobMonthYear: rejects pre-1925 years', () => {
    expect(composeDobMonthYear({ month: null, year: 1924 })).toEqual({
      dobMonth: null,
      dobYear: null,
    })
  })

  it('composeDobMonthYear: accepts 1925 boundary', () => {
    expect(composeDobMonthYear({ month: null, year: 1925 })).toEqual({
      dobMonth: null,
      dobYear: 1925,
    })
  })

  it('composeDobMonthYear: rejects future years', () => {
    const next = new Date().getFullYear() + 1
    expect(composeDobMonthYear({ month: null, year: next })).toEqual({
      dobMonth: null,
      dobYear: null,
    })
  })
})
