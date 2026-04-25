/**
 * /setup/email — Setup.US-3 + Setup.US-5 (direct-link guard).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pushSpy = vi.fn()
const replaceSpy = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
}))

import SetupEmailPage from '@/app/setup/email/page'
import { isValidEmail } from '@/components/setup/EmailField'
import { clearProfile, readProfile, writeProfile } from '@/lib/profile/storage'

describe('/setup/email page', () => {
  beforeEach(() => {
    pushSpy.mockReset()
    replaceSpy.mockReset()
    clearProfile()
  })
  afterEach(() => clearProfile())

  it('redirects to /setup/name when nothing in profile', () => {
    render(<SetupEmailPage />)
    expect(replaceSpy).toHaveBeenCalledWith('/setup/name')
  })

  it('redirects to /setup/dob when only name is filled', () => {
    writeProfile({ name: 'Asha' })
    render(<SetupEmailPage />)
    expect(replaceSpy).toHaveBeenCalledWith('/setup/dob')
  })

  it('does not redirect when name + dob are filled', () => {
    writeProfile({ name: 'Asha', dobIso: '1992-04-12' })
    render(<SetupEmailPage />)
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('disables Next while email is invalid', () => {
    writeProfile({ name: 'Asha', dobIso: '1992-04-12' })
    render(<SetupEmailPage />)
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'not-an-email' },
    })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('writes lowercased + trimmed email and routes to /setup/condition', () => {
    writeProfile({ name: 'Asha', dobIso: '1992-04-12' })
    render(<SetupEmailPage />)
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: '  Asha@Example.COM  ' },
    })
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(readProfile()?.email).toBe('asha@example.com')
    expect(pushSpy).toHaveBeenCalledWith('/setup/condition')
  })
})

describe('isValidEmail', () => {
  it('rejects empty', () => {
    expect(isValidEmail('')).toBe(false)
  })
  it('rejects missing @', () => {
    expect(isValidEmail('asha.example.com')).toBe(false)
  })
  it('rejects missing dot in domain', () => {
    expect(isValidEmail('asha@example')).toBe(false)
  })
  it('accepts a basic address', () => {
    expect(isValidEmail('asha@example.com')).toBe(true)
  })
  it('trims whitespace before matching', () => {
    expect(isValidEmail('  asha@example.com  ')).toBe(true)
  })
})
