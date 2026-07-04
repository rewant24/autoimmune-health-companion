/**
 * ErrorSlot per-kind plain-language copy (2026-07-04 assessment, Q5).
 *
 * Load-bearing behaviors:
 *   - every VoiceErrorKind (plus save-failed) maps to a human headline +
 *     sentence — no user ever gets a bare debug slug as the explanation
 *   - the slug survives, demoted to a detail line (bug reports)
 *   - unknown kinds fall back to the generic copy instead of crashing
 *   - retry affordance + focus behavior unchanged
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ERROR_COPY, ErrorSlot } from '@/components/check-in/ErrorSlot'
import type { VoiceErrorKind } from '@/lib/voice/types'

describe('ErrorSlot — per-kind copy (Q5)', () => {
  it('permission-denied gets mic copy, not the slug as headline', () => {
    render(<ErrorSlot kind="permission-denied" />)
    expect(screen.getByRole('heading')).toHaveTextContent(
      "Saha can't hear you yet.",
    )
    expect(screen.getByText(/blocking the microphone/i)).toBeInTheDocument()
  })

  it('no-speech copy owns the silence without blaming the user', () => {
    render(<ErrorSlot kind="no-speech" />)
    expect(screen.getByRole('heading')).toHaveTextContent(
      "I didn't catch anything.",
    )
  })

  it('network copy absorbs blame ("not you")', () => {
    render(<ErrorSlot kind="network" />)
    expect(screen.getByText(/not\s+you/i)).toBeInTheDocument()
  })

  it('save-failed reassures nothing is lost', () => {
    render(<ErrorSlot kind="save-failed" />)
    expect(screen.getByRole('heading')).toHaveTextContent("That didn't save.")
    expect(screen.getByText(/nothing is lost/i)).toBeInTheDocument()
  })

  it('every VoiceErrorKind has dedicated copy', () => {
    const kinds: VoiceErrorKind[] = [
      'permission-denied',
      'no-speech',
      'network',
      'unsupported',
      'aborted',
      'rate-limited',
    ]
    for (const kind of kinds) {
      expect(ERROR_COPY[kind]).toBeDefined()
      expect(ERROR_COPY[kind]?.title.length).toBeGreaterThan(0)
      expect(ERROR_COPY[kind]?.body.length).toBeGreaterThan(0)
    }
    expect(ERROR_COPY['save-failed']).toBeDefined()
  })

  it('unknown kind falls back to the generic copy', () => {
    render(<ErrorSlot kind="some-future-kind" />)
    expect(screen.getByRole('heading')).toHaveTextContent(
      'Something got in the way.',
    )
  })

  it('the slug is still present as a demoted detail line', () => {
    render(<ErrorSlot kind="permission-denied" />)
    expect(screen.getByText('permission-denied')).toBeInTheDocument()
    expect(screen.getByTestId('error-slot')).toHaveAttribute(
      'data-error-kind',
      'permission-denied',
    )
  })

  it('optional message still renders alongside the copy', () => {
    render(<ErrorSlot kind="save-failed" message="Row conflict" />)
    expect(screen.getByText('Row conflict')).toBeInTheDocument()
  })

  it('retry button fires onRetry and takes focus on mount', async () => {
    const onRetry = vi.fn()
    render(<ErrorSlot kind="network" onRetry={onRetry} />)
    const button = screen.getByRole('button', { name: 'Try again' })
    expect(button).toHaveFocus()
    await userEvent.click(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
