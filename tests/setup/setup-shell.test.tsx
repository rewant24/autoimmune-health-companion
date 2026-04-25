/**
 * SetupShell — shared layout for Setup B screens.
 *
 * Onboarding Shell cycle, Build-B (Chunk B).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SetupShell } from '@/components/setup/SetupShell'

describe('<SetupShell />', () => {
  it('renders heading + step number on the progress dots', () => {
    render(
      <SetupShell step={2} heading="DOB?" disabled onNext={() => undefined}>
        <div>field</div>
      </SetupShell>,
    )
    expect(screen.getByRole('heading', { name: 'DOB?' })).toBeInTheDocument()
    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveAttribute('aria-valuenow', '2')
    expect(progress).toHaveAttribute('aria-valuemax', '4')
  })

  it('disables the Next button when `disabled` is true', () => {
    const onNext = vi.fn()
    render(
      <SetupShell step={1} heading="Name?" disabled onNext={onNext}>
        <div />
      </SetupShell>,
    )
    const next = screen.getByRole('button', { name: 'Next' })
    expect(next).toBeDisabled()
    fireEvent.click(next)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('fires onNext when not disabled', () => {
    const onNext = vi.fn()
    render(
      <SetupShell step={1} heading="Name?" disabled={false} onNext={onNext}>
        <div />
      </SetupShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('honours nextLabel override', () => {
    render(
      <SetupShell
        step={4}
        heading="Final"
        disabled={false}
        onNext={() => undefined}
        nextLabel="Finish"
      >
        <div />
      </SetupShell>,
    )
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
  })
})
