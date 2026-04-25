/**
 * Tests for `<MilestoneCelebration>` (Feature 01, Cycle 2, Chunk 2.F,
 * story Milestone.US-1.J.4).
 *
 * Whoop-style ring stack: one ring per day-N up to a visual cap. Closer
 * text overlays the heading. A single primary "Keep going" CTA fires the
 * `onContinue` callback (orchestrator dispatches `CELEBRATION_DONE` and
 * routes to `/check-in/saved`).
 *
 * Reduced-motion: when `prefersReducedMotion === true` the ring stack
 * collapses to a static fill and the animation classes are dropped.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MilestoneCelebration } from '@/components/check-in/MilestoneCelebration'

describe('<MilestoneCelebration />', () => {
  it('renders the closer text as the heading', () => {
    render(
      <MilestoneCelebration
        kind="day-7"
        closerText="Seven in a row — you showed up."
        onContinue={() => {}}
      />,
    )
    expect(
      screen.getByRole('heading', { name: /seven in a row/i }),
    ).toBeInTheDocument()
  })

  it('renders 1 ring for day-1', () => {
    render(
      <MilestoneCelebration
        kind="day-1"
        closerText="Day one."
        onContinue={() => {}}
      />,
    )
    expect(screen.getAllByTestId('milestone-ring')).toHaveLength(1)
  })

  it('renders 7 rings for day-7', () => {
    render(
      <MilestoneCelebration
        kind="day-7"
        closerText="Seven."
        onContinue={() => {}}
      />,
    )
    expect(screen.getAllByTestId('milestone-ring')).toHaveLength(7)
  })

  it('renders 30 rings for day-30', () => {
    render(
      <MilestoneCelebration
        kind="day-30"
        closerText="Thirty."
        onContinue={() => {}}
      />,
    )
    expect(screen.getAllByTestId('milestone-ring')).toHaveLength(30)
  })

  it('caps the visual ring count at 30 for day-90 (denser cluster note in DOM)', () => {
    render(
      <MilestoneCelebration
        kind="day-90"
        closerText="Ninety."
        onContinue={() => {}}
      />,
    )
    expect(screen.getAllByTestId('milestone-ring')).toHaveLength(30)
  })

  it('caps the visual ring count at 30 for day-365', () => {
    render(
      <MilestoneCelebration
        kind="day-365"
        closerText="One year."
        onContinue={() => {}}
      />,
    )
    expect(screen.getAllByTestId('milestone-ring')).toHaveLength(30)
  })

  it('renders a single "Keep going" CTA', () => {
    render(
      <MilestoneCelebration
        kind="day-7"
        closerText="."
        onContinue={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent(/keep going/i)
  })

  it('calls onContinue when the "Keep going" CTA is clicked', () => {
    const onContinue = vi.fn()
    render(
      <MilestoneCelebration
        kind="day-7"
        closerText="."
        onContinue={onContinue}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /keep going/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('drops the animation class when prefersReducedMotion is true (collapses to static)', () => {
    render(
      <MilestoneCelebration
        kind="day-7"
        closerText="."
        onContinue={() => {}}
        prefersReducedMotion
      />,
    )
    const stack = screen.getByTestId('milestone-ring-stack')
    expect(stack).toHaveAttribute('data-reduced-motion', 'true')
    // Each ring is rendered fully filled (no animation class).
    for (const ring of screen.getAllByTestId('milestone-ring')) {
      expect(ring).not.toHaveClass('milestone-ring-animate')
      expect(ring).toHaveAttribute('data-filled', 'true')
    }
  })

  it('keeps the animation class when prefersReducedMotion is false (default)', () => {
    render(
      <MilestoneCelebration
        kind="day-7"
        closerText="."
        onContinue={() => {}}
      />,
    )
    const stack = screen.getByTestId('milestone-ring-stack')
    expect(stack).toHaveAttribute('data-reduced-motion', 'false')
    for (const ring of screen.getAllByTestId('milestone-ring')) {
      expect(ring).toHaveClass('milestone-ring-animate')
    }
  })

  it('declares the milestone kind on the root for downstream styling/analytics', () => {
    render(
      <MilestoneCelebration
        kind="day-30"
        closerText="."
        onContinue={() => {}}
      />,
    )
    expect(screen.getByTestId('milestone-celebration')).toHaveAttribute(
      'data-kind',
      'day-30',
    )
  })
})
