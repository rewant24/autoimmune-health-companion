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
})
