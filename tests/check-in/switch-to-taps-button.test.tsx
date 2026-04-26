/**
 * Tests for `<SwitchToTapsButton>` (Feature 01, Voice C1, Wave 2 task 2.4).
 *
 * Behaviour under test:
 *   - Renders a button with copy "Switch to taps".
 *   - Clicking calls the supplied `onBail` handler.
 *   - Default render starts at opacity 0 then fades to 1 via rAF.
 *   - When `prefers-reduced-motion: reduce` is set, the button renders
 *     visible immediately with a 0ms transition.
 *   - Min hit target ≥44pt (h-11 utility on the button).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SwitchToTapsButton } from '@/components/check-in/SwitchToTapsButton'

interface MatchMediaResult {
  matches: boolean
  media: string
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  addListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  onchange: null
  dispatchEvent: () => boolean
}

function setReducedMotion(preferred: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MatchMediaResult => ({
      matches: preferred && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: (): boolean => true,
    }),
  })
}

beforeEach(() => {
  setReducedMotion(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('<SwitchToTapsButton />', () => {
  it('renders a "Switch to taps" button', () => {
    render(<SwitchToTapsButton onBail={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Switch to taps' }),
    ).toBeInTheDocument()
  })

  it('calls onBail when clicked', () => {
    const onBail = vi.fn()
    render(<SwitchToTapsButton onBail={onBail} />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to taps' }))
    expect(onBail).toHaveBeenCalledTimes(1)
  })

  it('starts at opacity 0 then fades to opacity 1 after rAF', async () => {
    render(<SwitchToTapsButton onBail={() => {}} />)
    const button = screen.getByRole('button', { name: 'Switch to taps' })
    expect(button.style.opacity).toBe('0')
    await waitFor(() => {
      expect(button.style.opacity).toBe('1')
    })
  })

  it('renders fully visible immediately when prefers-reduced-motion is set', () => {
    setReducedMotion(true)
    render(<SwitchToTapsButton onBail={() => {}} />)
    const button = screen.getByRole('button', { name: 'Switch to taps' })
    expect(button.style.opacity).toBe('1')
    expect(button.style.transitionDuration).toBe('0ms')
  })

  it('uses a transition duration of 200ms when motion is allowed', async () => {
    render(<SwitchToTapsButton onBail={() => {}} />)
    const button = screen.getByRole('button', { name: 'Switch to taps' })
    expect(button.style.transitionDuration).toBe('200ms')
  })

  it('button has a minimum 44pt hit target (min-h-11 utility)', () => {
    render(<SwitchToTapsButton onBail={() => {}} />)
    const button = screen.getByRole('button', { name: 'Switch to taps' })
    expect(button.className).toMatch(/min-h-11/)
  })
})
