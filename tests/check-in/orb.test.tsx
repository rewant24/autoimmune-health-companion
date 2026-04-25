/**
 * Orb render tests (US-1.C.2).
 *
 * Asserts aria-label changes per state, tap fires onTap, and the data
 * attribute that encodes visual state is present so downstream styles
 * and integration tests can hook onto it.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Orb } from '@/components/check-in/Orb'
import { ORB_STATES, type OrbVisualState } from '@/components/check-in/OrbStates'

const STATES: OrbVisualState[] = ['idle', 'listening', 'processing', 'error']

describe('<Orb />', () => {
  it.each(STATES)('renders aria-label for state "%s"', (s) => {
    render(<Orb orbState={s} onTap={() => {}} />)
    expect(
      screen.getByRole('button', { name: ORB_STATES[s].ariaLabel }),
    ).toBeInTheDocument()
  })

  it('fires onTap when clicked', async () => {
    const onTap = vi.fn()
    render(<Orb orbState="idle" onTap={onTap} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('does not fire onTap when disabled', async () => {
    const onTap = vi.fn()
    render(<Orb orbState="idle" onTap={onTap} disabled />)
    await userEvent.click(screen.getByRole('button'))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('reflects visual state via data-orb-state attribute', () => {
    const { rerender } = render(<Orb orbState="idle" onTap={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('data-orb-state', 'idle')
    rerender(<Orb orbState="listening" onTap={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-orb-state',
      'listening',
    )
    rerender(<Orb orbState="error" onTap={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-orb-state',
      'error',
    )
  })

  it('renders the transient label when provided', () => {
    render(<Orb orbState="listening" onTap={() => {}} label="Listening" />)
    expect(screen.getByText('Listening')).toBeInTheDocument()
  })

  it('attempts haptic vibrate on tap when navigator.vibrate exists', async () => {
    const vibrate = vi.fn().mockReturnValue(true)
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    })
    const onTap = vi.fn()
    render(<Orb orbState="idle" onTap={onTap} />)
    await userEvent.click(screen.getByRole('button'))
    expect(vibrate).toHaveBeenCalledWith(50)
    expect(onTap).toHaveBeenCalled()
  })

  it('swallows vibrate errors without breaking tap', async () => {
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      configurable: true,
      value: () => {
        throw new Error('no hardware')
      },
    })
    const onTap = vi.fn()
    render(<Orb orbState="idle" onTap={onTap} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalled()
  })
})
