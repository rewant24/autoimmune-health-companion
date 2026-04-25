/**
 * /setup/name — Setup.US-1.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pushSpy = vi.fn()
const replaceSpy = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
}))

import SetupNamePage from '@/app/setup/name/page'
import { clearProfile, readProfile } from '@/lib/profile/storage'
import { isValidName } from '@/components/setup/NameField'

describe('/setup/name page', () => {
  beforeEach(() => {
    pushSpy.mockReset()
    replaceSpy.mockReset()
    clearProfile()
  })
  afterEach(() => clearProfile())

  it('renders the locked label "What should Saha call you?"', () => {
    render(<SetupNamePage />)
    expect(
      screen.getByLabelText(/what should saha call you/i),
    ).toBeInTheDocument()
  })

  it('disables Next while the name is empty', () => {
    render(<SetupNamePage />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('disables Next while the name is whitespace-only', () => {
    render(<SetupNamePage />)
    fireEvent.change(screen.getByTestId('name-input'), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('enables Next, writes a trimmed name, and routes to /setup/dob on Next', () => {
    render(<SetupNamePage />)
    fireEvent.change(screen.getByTestId('name-input'), {
      target: { value: '  Asha  ' },
    })
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(readProfile()?.name).toBe('Asha')
    expect(pushSpy).toHaveBeenCalledWith('/setup/dob')
  })
})

describe('isValidName', () => {
  it('rejects empty + whitespace, accepts non-empty', () => {
    expect(isValidName('')).toBe(false)
    expect(isValidName('   ')).toBe(false)
    expect(isValidName('Asha')).toBe(true)
  })
})
