/**
 * Tests for `components/check-in/StopButton.tsx` (Voice C1 fix-pass Phase 4).
 *
 * Mirrors `tests/check-in/switch-to-taps-button.test.tsx`. The button is
 * a leaf component with no state-machine coupling — visibility is owned
 * by the parent — so these tests just lock in the click contract and
 * the fade-in / reduced-motion behaviour.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { StopButton } from '@/components/check-in/StopButton'
import { SwitchToTapsButton } from '@/components/check-in/SwitchToTapsButton'

/** The `[bottom:calc(...)]` arbitrary-value class of the fixed wrapper. */
function bottomOffsetOf(button: HTMLElement): string {
  const wrapper = button.parentElement
  expect(wrapper).not.toBeNull()
  const match = wrapper!.className.match(/\[bottom:[^\]]+\]/)
  expect(match).not.toBeNull()
  return match![0]
}

describe('StopButton', () => {
  it('renders a button labelled "Tap when done"', () => {
    render(<StopButton onStop={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Tap when done' })
    expect(btn).toBeInTheDocument()
  })

  it('calls onStop when clicked', () => {
    const onStop = vi.fn()
    render(<StopButton onStop={onStop} />)
    fireEvent.click(screen.getByTestId('stop-button'))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('starts at opacity 0 then fades to opacity 1 after rAF', async () => {
    render(<StopButton onStop={() => {}} />)
    const btn = screen.getByTestId('stop-button')
    expect(btn.style.opacity).toBe('0')
    await waitFor(() => {
      expect(btn.style.opacity).toBe('1')
    })
  })

  // Housekeeping #17 regression: in `listening-answer` both StopButton
  // and SwitchToTapsButton mount. Pre-fix both rendered at the identical
  // fixed offset (`bottom:calc(5rem+env(safe-area-inset-bottom))` z-50),
  // so "Switch to taps" painted on top of "Tap when done" and
  // intercepted its pointer events — a tap aimed at the stop affordance
  // bailed the whole voice loop to Stage 2 (found by the A2 harness,
  // PR #40).
  describe('stacking alongside SwitchToTapsButton (housekeeping #17)', () => {
    it('renders at a distinct bottom offset when stacked, so both buttons are tappable', () => {
      render(
        <>
          <StopButton stacked onStop={vi.fn()} />
          <SwitchToTapsButton onBail={vi.fn()} />
        </>,
      )
      const stopOffset = bottomOffsetOf(screen.getByTestId('stop-button'))
      const bailOffset = bottomOffsetOf(
        screen.getByTestId('switch-to-taps-button'),
      )
      // The load-bearing assertion: the two fixed wrappers must not
      // share the same bottom offset. Fails on the pre-fix layout.
      expect(stopOffset).not.toBe(bailOffset)
      // And the stop button takes the higher slot (one button + gap up).
      expect(stopOffset).toBe(
        '[bottom:calc(8.5rem+env(safe-area-inset-bottom))]',
      )
      expect(bailOffset).toBe(
        '[bottom:calc(5rem+env(safe-area-inset-bottom))]',
      )
    })

    it('keeps the original bottom slot when rendered alone (not stacked)', () => {
      render(<StopButton onStop={vi.fn()} />)
      expect(bottomOffsetOf(screen.getByTestId('stop-button'))).toBe(
        '[bottom:calc(5rem+env(safe-area-inset-bottom))]',
      )
    })
  })
})
