/**
 * <ConfirmSummary /> tests (US-1.F.1 + US-1.F.2).
 *
 * Heading verbatim: "Here's what I heard"
 * Bonus capture line: "Plus: …" — only when transcript word count > 30.
 * Save button label: "Save today's check-in" (sticky-bottom, full-width).
 * Discard secondary link label: "Discard this check-in".
 *
 * Save flow:
 *   - onSave() fires once on click (no payload — orchestrator owns shape).
 *   - isSaving=true → button shows "Saving…" + disabled.
 *   - saveError !== null → ErrorSlot renders inline with two CTAs:
 *       "Try again" → onRetry()
 *       "Keep this for later" → onSaveLater()
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmSummary } from '@/components/check-in/ConfirmSummary'
import type { CheckinMetrics, Metric } from '@/lib/checkin/types'

const baseMetrics: CheckinMetrics = {
  pain: 5,
  mood: 'okay',
  adherenceTaken: true,
  flare: 'no',
  energy: 6,
}

const noopProps = {
  metrics: baseMetrics,
  declined: [] as Metric[],
  transcript: { text: 'short transcript today' },
  closerText: 'Same time tomorrow.',
  onMetricUpdate: vi.fn(),
  onMetricDeclined: vi.fn(),
  onSave: vi.fn(),
  onDiscard: vi.fn(),
  onRetry: vi.fn(),
  onSaveLater: vi.fn(),
  isSaving: false,
  saveError: null as string | null,
}

describe('<ConfirmSummary />', () => {
  it('renders the verbatim heading', () => {
    render(<ConfirmSummary {...noopProps} />)
    expect(screen.getByText("Here's what I heard")).toBeInTheDocument()
  })

  it('renders all 5 captured metrics when none declined', () => {
    render(<ConfirmSummary {...noopProps} />)
    // Each metric shows a label — pain / mood / adherence / flare / energy.
    expect(screen.getByText(/pain/i)).toBeInTheDocument()
    expect(screen.getByText(/mood/i)).toBeInTheDocument()
    expect(screen.getByText(/adherence/i)).toBeInTheDocument()
    expect(screen.getByText(/flare/i)).toBeInTheDocument()
    expect(screen.getByText(/energy/i)).toBeInTheDocument()
  })

  it('marks declined metrics as "skipped today"', () => {
    render(
      <ConfirmSummary
        {...noopProps}
        metrics={{ ...baseMetrics, flare: null }}
        declined={['flare']}
      />,
    )
    expect(screen.getAllByText(/skipped today/i).length).toBeGreaterThan(0)
  })

  it('does not show the bonus "Plus:" line when transcript word count <= 30', () => {
    render(<ConfirmSummary {...noopProps} />)
    expect(screen.queryByText(/^Plus:/)).not.toBeInTheDocument()
  })

  it('shows the bonus "Plus:" line when transcript word count > 30', () => {
    const longText = Array.from({ length: 35 }, (_, i) => `word${i}`).join(' ')
    render(
      <ConfirmSummary {...noopProps} transcript={{ text: longText }} />,
    )
    expect(screen.getByText(/^Plus:/)).toBeInTheDocument()
  })

  it('renders the closer text', () => {
    render(
      <ConfirmSummary {...noopProps} closerText="Same time tomorrow." />,
    )
    expect(screen.getByText('Same time tomorrow.')).toBeInTheDocument()
  })

  it('Save button uses verbatim label', () => {
    render(<ConfirmSummary {...noopProps} />)
    expect(
      screen.getByRole('button', { name: "Save today's check-in" }),
    ).toBeInTheDocument()
  })

  it('Save click fires onSave', async () => {
    const onSave = vi.fn()
    render(<ConfirmSummary {...noopProps} onSave={onSave} />)
    await userEvent.click(
      screen.getByRole('button', { name: "Save today's check-in" }),
    )
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('isSaving shows "Saving…" and disables the button', () => {
    render(<ConfirmSummary {...noopProps} isSaving />)
    const button = screen.getByRole('button', { name: /saving/i })
    expect(button).toBeDisabled()
  })

  it('Discard link uses verbatim label and opens the modal', async () => {
    render(<ConfirmSummary {...noopProps} />)
    const link = screen.getByRole('button', {
      name: 'Discard this check-in',
    })
    expect(link).toBeInTheDocument()
    await userEvent.click(link)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('confirming the discard modal fires onDiscard', async () => {
    const onDiscard = vi.fn()
    render(<ConfirmSummary {...noopProps} onDiscard={onDiscard} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard this check-in' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('Keep editing dismisses the modal without firing onDiscard', async () => {
    const onDiscard = vi.fn()
    render(<ConfirmSummary {...noopProps} onDiscard={onDiscard} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard this check-in' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Keep editing' }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it('saveError renders ErrorSlot with both recovery CTAs', () => {
    render(
      <ConfirmSummary {...noopProps} saveError="checkin.save_failed" />,
    )
    expect(screen.getByTestId('error-slot')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /keep this for later/i }),
    ).toBeInTheDocument()
  })

  it('"Try again" calls onRetry', async () => {
    const onRetry = vi.fn()
    render(
      <ConfirmSummary
        {...noopProps}
        saveError="checkin.save_failed"
        onRetry={onRetry}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('"Keep this for later" calls onSaveLater', async () => {
    const onSaveLater = vi.fn()
    render(
      <ConfirmSummary
        {...noopProps}
        saveError="checkin.save_failed"
        onSaveLater={onSaveLater}
      />,
    )
    await userEvent.click(
      screen.getByRole('button', { name: /keep this for later/i }),
    )
    expect(onSaveLater).toHaveBeenCalledTimes(1)
  })
})
