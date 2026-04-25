/**
 * /setup/condition — Setup.US-4 + Setup.US-5 (direct-link guard).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pushSpy = vi.fn()
const replaceSpy = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
}))

import SetupConditionPage from '@/app/setup/condition/page'
import {
  CONDITION_OPTIONS,
  isValidCondition,
} from '@/components/setup/ConditionField'
import { clearProfile, readProfile, writeProfile } from '@/lib/profile/storage'

describe('/setup/condition page', () => {
  beforeEach(() => {
    pushSpy.mockReset()
    replaceSpy.mockReset()
    clearProfile()
  })
  afterEach(() => clearProfile())

  it('redirects to /setup/name when nothing in profile', () => {
    render(<SetupConditionPage />)
    expect(replaceSpy).toHaveBeenCalledWith('/setup/name')
  })

  it('redirects to /setup/email when name + dob filled but email missing', () => {
    writeProfile({ name: 'Asha', dobIso: '1992-04-12' })
    render(<SetupConditionPage />)
    expect(replaceSpy).toHaveBeenCalledWith('/setup/email')
  })

  it('renders all 10 conditions + the Other option', () => {
    writeProfile({
      name: 'Asha',
      dobIso: '1992-04-12',
      email: 'a@b.co',
    })
    render(<SetupConditionPage />)
    for (const opt of CONDITION_OPTIONS) {
      expect(screen.getByTestId(`condition-option-${opt.id}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('condition-option-other')).toBeInTheDocument()
  })

  it('disables Next when no condition selected', () => {
    writeProfile({
      name: 'Asha',
      dobIso: '1992-04-12',
      email: 'a@b.co',
    })
    render(<SetupConditionPage />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('writes condition + null conditionOther and routes to /welcome', () => {
    writeProfile({
      name: 'Asha',
      dobIso: '1992-04-12',
      email: 'a@b.co',
    })
    render(<SetupConditionPage />)
    fireEvent.click(screen.getByTestId('condition-option-lupus'))
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(readProfile()?.condition).toBe('lupus')
    expect(readProfile()?.conditionOther).toBeNull()
    expect(pushSpy).toHaveBeenCalledWith('/welcome')
  })

  it('reveals free-text input when "Other" is selected', () => {
    writeProfile({
      name: 'Asha',
      dobIso: '1992-04-12',
      email: 'a@b.co',
    })
    render(<SetupConditionPage />)
    expect(screen.queryByTestId('condition-other-input')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('condition-option-other'))
    expect(screen.getByTestId('condition-other-input')).toBeInTheDocument()
  })

  it('keeps Next disabled when "Other" is selected but free-text empty', () => {
    writeProfile({
      name: 'Asha',
      dobIso: '1992-04-12',
      email: 'a@b.co',
    })
    render(<SetupConditionPage />)
    fireEvent.click(screen.getByTestId('condition-option-other'))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.change(screen.getByTestId('condition-other-input'), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('writes condition=other + conditionOther free-text and routes to /welcome', () => {
    writeProfile({
      name: 'Asha',
      dobIso: '1992-04-12',
      email: 'a@b.co',
    })
    render(<SetupConditionPage />)
    fireEvent.click(screen.getByTestId('condition-option-other'))
    fireEvent.change(screen.getByTestId('condition-other-input'), {
      target: { value: '  POTS  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(readProfile()?.condition).toBe('other')
    expect(readProfile()?.conditionOther).toBe('POTS')
    expect(pushSpy).toHaveBeenCalledWith('/welcome')
  })

  it('does not redirect when every required field is already filled', () => {
    writeProfile({
      name: 'Asha',
      dobIso: '1992-04-12',
      email: 'a@b.co',
      condition: 'lupus',
    })
    render(<SetupConditionPage />)
    expect(replaceSpy).not.toHaveBeenCalled()
  })
})

describe('isValidCondition', () => {
  it('rejects null', () => {
    expect(isValidCondition({ condition: null, conditionOther: null })).toBe(false)
  })
  it('accepts a non-other condition', () => {
    expect(isValidCondition({ condition: 'lupus', conditionOther: null })).toBe(true)
  })
  it('rejects other with empty conditionOther', () => {
    expect(isValidCondition({ condition: 'other', conditionOther: '' })).toBe(false)
    expect(isValidCondition({ condition: 'other', conditionOther: '  ' })).toBe(false)
    expect(isValidCondition({ condition: 'other', conditionOther: null })).toBe(false)
  })
  it('accepts other with non-empty free-text', () => {
    expect(isValidCondition({ condition: 'other', conditionOther: 'POTS' })).toBe(true)
  })
})
