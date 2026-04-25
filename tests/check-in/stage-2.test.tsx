/**
 * Stage 2 component tests (Feature 01, Cycle 2, Chunk 2.C).
 *
 * Stories: US-1.E.1 (layout + recap + adaptive header) and US-1.E.2
 * (tap-row reveals inline TapInput for correction). Plus integration of
 * the skip-today affordance from US-1.E.4 into Stage 2.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Stage2 } from '@/components/check-in/Stage2'
import type { Transcript } from '@/lib/voice/types'

const TRANSCRIPT: Transcript = {
  text: 'Pain is around 5 today, mood is okay.',
  durationMs: 4200,
}

const noopUpdate = () => {}
const noopDecline = () => {}
const noopContinue = () => {}

describe('<Stage2 />', () => {
  it('renders the "Heard you on:" recap header', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{ pain: 5, mood: 'okay' }}
        missing={['adherenceTaken', 'flare', 'energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    expect(screen.getByText('Heard you on:')).toBeInTheDocument()
  })

  it('renders "Just two more:" when there are 2+ missing metrics', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{ pain: 5, mood: 'okay' }}
        missing={['adherenceTaken', 'flare', 'energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    expect(screen.getByText('Just two more:')).toBeInTheDocument()
  })

  it('renders "Just one more:" when exactly one metric is missing', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{
          pain: 5,
          mood: 'okay',
          adherenceTaken: true,
          flare: 'no',
        }}
        missing={['energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    expect(screen.getByText('Just one more:')).toBeInTheDocument()
    expect(screen.queryByText('Just two more:')).not.toBeInTheDocument()
  })

  it('omits the missing-metric column entirely when none are missing', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{
          pain: 5,
          mood: 'okay',
          adherenceTaken: true,
          flare: 'no',
          energy: 6,
        }}
        missing={[]}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    expect(screen.queryByText('Just one more:')).not.toBeInTheDocument()
    expect(screen.queryByText('Just two more:')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('missing-metric-list'),
    ).not.toBeInTheDocument()
  })

  it('renders missing TapInputs in scoping order (pain → mood → adherence → flare → energy)', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        // Pass metrics in a deliberately scrambled order — component should
        // still render in the locked scoping order.
        metrics={{}}
        missing={['energy', 'pain', 'flare', 'mood', 'adherenceTaken']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    const list = screen.getByTestId('missing-metric-list')
    const tapInputs = within(list).getAllByTestId(
      /^tap-input-(pain|mood|adherenceTaken|flare|energy)$/,
    )
    expect(tapInputs.map((el) => el.getAttribute('data-testid'))).toEqual([
      'tap-input-pain',
      'tap-input-mood',
      'tap-input-adherenceTaken',
      'tap-input-flare',
      'tap-input-energy',
    ])
  })

  it('renders covered metric values in the recap (✓ Pain — 5, Mood — okay)', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{ pain: 5, mood: 'okay' }}
        missing={['adherenceTaken', 'flare', 'energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    const painRow = screen.getByTestId('heard-you-on-pain')
    expect(painRow).toHaveAttribute('data-state', 'covered')
    expect(painRow).toHaveTextContent('Pain')
    expect(painRow).toHaveTextContent('5')
    const moodRow = screen.getByTestId('heard-you-on-mood')
    expect(moodRow).toHaveTextContent('Mood')
    expect(moodRow).toHaveTextContent('okay')
  })

  it('marks declined metrics in the recap as "skipped today"', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{}}
        missing={['mood', 'flare', 'energy']}
        declined={['pain']}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    const painRow = screen.getByTestId('heard-you-on-pain')
    expect(painRow).toHaveAttribute('data-state', 'declined')
    expect(painRow).toHaveTextContent('skipped today')
  })

  it('reveals an inline TapInput when a recap row is tapped (correction path, US-1.E.2)', async () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{ pain: 5, mood: 'okay' }}
        missing={['adherenceTaken', 'flare', 'energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    const painRow = screen.getByTestId('heard-you-on-pain')
    // Recap should NOT include a TapInput before the row is tapped
    const recap = screen.getByTestId('stage-2-recap')
    expect(within(recap).queryByTestId('tap-input-pain')).not.toBeInTheDocument()
    await userEvent.click(painRow)
    expect(within(recap).getByTestId('tap-input-pain')).toBeInTheDocument()
  })

  it('updating a recap-row TapInput calls onMetricUpdate with the right shape', async () => {
    const onMetricUpdate = vi.fn()
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{ pain: 5, mood: 'okay' }}
        missing={['adherenceTaken', 'flare', 'energy']}
        declined={[]}
        onMetricUpdate={onMetricUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    await userEvent.click(screen.getByTestId('heard-you-on-mood'))
    const recap = screen.getByTestId('stage-2-recap')
    await userEvent.click(within(recap).getByRole('radio', { name: 'bright' }))
    expect(onMetricUpdate).toHaveBeenCalledWith('mood', 'bright')
  })

  it('forwards onMetricUpdate from a missing-metric TapInput', async () => {
    const onMetricUpdate = vi.fn()
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{}}
        missing={['mood', 'flare']}
        declined={[]}
        onMetricUpdate={onMetricUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    const list = screen.getByTestId('missing-metric-list')
    await userEvent.click(within(list).getByRole('radio', { name: 'flat' }))
    expect(onMetricUpdate).toHaveBeenCalledWith('mood', 'flat')
  })

  it('forwards onMetricDeclined when "Skip today" is tapped on a missing metric', async () => {
    const onMetricDeclined = vi.fn()
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{}}
        missing={['energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={onMetricDeclined}
        onContinue={noopContinue}
      />,
    )
    const list = screen.getByTestId('missing-metric-list')
    await userEvent.click(
      within(list).getByRole('button', { name: /skip today/i }),
    )
    expect(onMetricDeclined).toHaveBeenCalledWith('energy')
  })

  it('renders all 5 controls in Day-1 mode (forceAllControls) even when nothing is missing', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{
          pain: 5,
          mood: 'okay',
          adherenceTaken: true,
          flare: 'no',
          energy: 6,
        }}
        missing={[]}
        declined={[]}
        forceAllControls
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    const list = screen.getByTestId('missing-metric-list')
    const tapInputs = within(list).getAllByTestId(
      /^tap-input-(pain|mood|adherenceTaken|flare|energy)$/,
    )
    expect(tapInputs).toHaveLength(5)
  })

  it('Day-1 mode header: "Just two more:" applies even when count > 2', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{}}
        missing={[]}
        declined={[]}
        forceAllControls
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    expect(screen.getByText('Just two more:')).toBeInTheDocument()
  })

  it('continue button calls onContinue', async () => {
    const onContinue = vi.fn()
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{ pain: 5, mood: 'okay' }}
        missing={['adherenceTaken', 'flare', 'energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={onContinue}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('does not include declined metrics in the missing column', () => {
    render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{}}
        missing={['mood', 'flare']}
        declined={['mood']}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    const list = screen.getByTestId('missing-metric-list')
    expect(within(list).queryByTestId('tap-input-mood')).not.toBeInTheDocument()
    expect(within(list).getByTestId('tap-input-flare')).toBeInTheDocument()
  })

  it('uses the locked language guardrail — no "caregiver" or "squad" in rendered text', () => {
    const { container } = render(
      <Stage2
        transcript={TRANSCRIPT}
        metrics={{ pain: 5 }}
        missing={['mood', 'adherenceTaken', 'flare', 'energy']}
        declined={[]}
        onMetricUpdate={noopUpdate}
        onMetricDeclined={noopDecline}
        onContinue={noopContinue}
      />,
    )
    expect(container.textContent ?? '').not.toMatch(/caregiver/i)
    expect(container.textContent ?? '').not.toMatch(/squad/i)
  })
})
