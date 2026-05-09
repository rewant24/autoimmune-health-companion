/**
 * <EventConfirmCard /> tests — F05 chunk 5.C, follow-up to review.
 *
 * Covers the four state transitions (prompt → saved | dismissed | error)
 * and the unit-picker fallback when an extracted blood-work marker has
 * unit: null. Also locks the retry-after-error path that R3 #5 flagged
 * as fragile — see the INVARIANT comment in EventConfirmCard.tsx that
 * pins why 'error' must NOT be added to the early-return guard.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EventConfirmCard } from '@/components/check-in/EventConfirmCard'

describe('<EventConfirmCard /> — visit kind', () => {
  it('renders prompt with doctor name + visit type', () => {
    render(
      <EventConfirmCard
        kind="visit"
        date="2026-05-09"
        doctorName="Dr. Mehta"
        visitType="follow-up"
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByTestId('event-confirm-card-visit')).toHaveAttribute(
      'data-state',
      'prompt',
    )
    expect(screen.getByText(/Doctor visit on 2026-05-09/)).toBeInTheDocument()
    expect(screen.getByText(/Dr\. Mehta · Follow-up/)).toBeInTheDocument()
  })

  it('Save → onConfirm fires, transitions to saved', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <EventConfirmCard
        kind="visit"
        date="2026-05-09"
        doctorName="Dr. Mehta"
        visitType="consultation"
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId('event-confirm-card-visit-confirm'))
    await waitFor(() => {
      expect(screen.getByTestId('event-confirm-card-visit')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Not now → onDismiss fires, card disappears (dismissed silent)', async () => {
    const onDismiss = vi.fn()
    render(
      <EventConfirmCard
        kind="visit"
        date="2026-05-09"
        doctorName="Dr. Mehta"
        visitType="urgent"
        onConfirm={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    await userEvent.click(screen.getByTestId('event-confirm-card-visit-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('event-confirm-card-visit')).not.toBeInTheDocument()
  })

  it('Save throws → transitions to error with retry affordance', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('network'))
    render(
      <EventConfirmCard
        kind="visit"
        date="2026-05-09"
        doctorName="Dr. Mehta"
        visitType="other"
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId('event-confirm-card-visit-confirm'))
    await waitFor(() => {
      expect(screen.getByTestId('event-confirm-card-visit')).toHaveAttribute(
        'data-state',
        'error',
      )
    })
    expect(screen.getByTestId('event-confirm-card-visit-retry')).toBeInTheDocument()
  })

  it('Retry from error path re-fires onConfirm and saves on success', async () => {
    // The retry path is the regression R3 #5 flagged. The setDone('prompt')
    // in the retry click handler is queued; handleConfirm reads stale
    // done='error' but is allowed through because the early-return guard
    // does NOT include 'error'. This test pins that contract.
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('first try fails'))
      .mockResolvedValueOnce(undefined)
    render(
      <EventConfirmCard
        kind="visit"
        date="2026-05-09"
        doctorName="Dr. Mehta"
        visitType="follow-up"
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId('event-confirm-card-visit-confirm'))
    await waitFor(() => {
      expect(screen.getByTestId('event-confirm-card-visit')).toHaveAttribute(
        'data-state',
        'error',
      )
    })
    await userEvent.click(screen.getByTestId('event-confirm-card-visit-retry'))
    await waitFor(() => {
      expect(screen.getByTestId('event-confirm-card-visit')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })
})

describe('<EventConfirmCard /> — blood-work kind', () => {
  it('passes resolved markers (with unit) when unit was provided', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <EventConfirmCard
        kind="blood-work"
        date="2026-05-09"
        markers={[{ name: 'CRP', value: 12, unit: 'mg/L' }]}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    await userEvent.click(
      screen.getByTestId('event-confirm-card-blood-work-confirm'),
    )
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith([
      { name: 'CRP', value: 12, unit: 'mg/L' },
    ])
  })

  it('renders unit picker when marker.unit === null and uses default unit on save', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <EventConfirmCard
        kind="blood-work"
        date="2026-05-09"
        markers={[{ name: 'CRP', value: 12, unit: null }]}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    expect(
      screen.getByTestId('event-confirm-card-blood-work-unit-0'),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByTestId('event-confirm-card-blood-work-confirm'),
    )
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    // Default is the first COMMON_UNITS entry — 'mg/L'.
    expect(onConfirm).toHaveBeenCalledWith([
      { name: 'CRP', value: 12, unit: 'mg/L' },
    ])
  })

  it('user-selected unit overrides default', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <EventConfirmCard
        kind="blood-work"
        date="2026-05-09"
        markers={[{ name: 'ESR', value: 30, unit: null }]}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    )
    await userEvent.selectOptions(
      screen.getByTestId('event-confirm-card-blood-work-unit-0'),
      'mm/hr',
    )
    await userEvent.click(
      screen.getByTestId('event-confirm-card-blood-work-confirm'),
    )
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith([
      { name: 'ESR', value: 30, unit: 'mm/hr' },
    ])
  })
})
