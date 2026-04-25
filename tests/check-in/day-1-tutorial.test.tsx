/**
 * Tests for `<Day1Tutorial>` (Feature 01, Cycle 2, Chunk 2.F, story Day1.US-1.J.1).
 *
 * `<Day1Tutorial>` is a thin wrapper component that renders its children
 * and — when `forceTooltip === true` — appends a tooltip ribbon below
 * each child. The orchestrator wires `forceTooltip` to
 * `forceAllControls && dayOneTooltipsForcedOn` (i.e. Day-1 mode in Stage 2).
 *
 * Copy is verbatim from scoping § Day-1 micro-tutorial.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Day1Tutorial } from '@/components/check-in/Day1Tutorial'

const TUTORIAL_COPY =
  'Tap any of these to correct or skip — you can also use them instead of talking.'

describe('<Day1Tutorial />', () => {
  it('renders the tooltip ribbon when forceTooltip is true', () => {
    render(
      <Day1Tutorial forceTooltip>
        <div data-testid="child-control">stub-control</div>
      </Day1Tutorial>,
    )
    expect(screen.getByTestId('child-control')).toBeInTheDocument()
    expect(screen.getByTestId('day-1-tutorial-ribbon')).toBeInTheDocument()
    expect(screen.getByTestId('day-1-tutorial-ribbon')).toHaveTextContent(
      TUTORIAL_COPY,
    )
  })

  it('hides the tooltip ribbon when forceTooltip is false', () => {
    render(
      <Day1Tutorial forceTooltip={false}>
        <div data-testid="child-control">stub-control</div>
      </Day1Tutorial>,
    )
    expect(screen.getByTestId('child-control')).toBeInTheDocument()
    expect(screen.queryByTestId('day-1-tutorial-ribbon')).toBeNull()
  })

  it('hides the tooltip ribbon when forceTooltip is omitted (default false)', () => {
    render(
      <Day1Tutorial>
        <div data-testid="child-control">stub-control</div>
      </Day1Tutorial>,
    )
    expect(screen.queryByTestId('day-1-tutorial-ribbon')).toBeNull()
  })

  it('renders the child whether or not the tooltip is shown', () => {
    const { rerender } = render(
      <Day1Tutorial forceTooltip>
        <button>my-tap-input</button>
      </Day1Tutorial>,
    )
    expect(screen.getByRole('button', { name: 'my-tap-input' })).toBeInTheDocument()

    rerender(
      <Day1Tutorial forceTooltip={false}>
        <button>my-tap-input</button>
      </Day1Tutorial>,
    )
    expect(screen.getByRole('button', { name: 'my-tap-input' })).toBeInTheDocument()
  })

  it('uses the verbatim Day-1 micro-tutorial copy', () => {
    render(
      <Day1Tutorial forceTooltip>
        <div>x</div>
      </Day1Tutorial>,
    )
    // Spec literal — failure here means scoping copy was edited without updating the component.
    expect(screen.getByText(TUTORIAL_COPY)).toBeInTheDocument()
  })
})
