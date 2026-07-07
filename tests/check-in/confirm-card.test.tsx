/**
 * <ConfirmCard /> tests — W2-4 (Lane 1D part 2).
 *
 * Supersedes event-confirm-card.test.tsx and adds the dose-change variant
 * coverage MedicationConfirmCard never had (spike §4.2). Covers:
 *   - the three kinds' prompt rendering,
 *   - prompt → saved | dismissed | error transitions,
 *   - P1 undo semantics: undo-after-save calls onUndoSave then restores
 *     the prompt; undo-after-dismiss restores the prompt without any
 *     callback; a failed undo leaves the saved row (and its chip) alone,
 *   - the retry-after-error path R3 #5 flagged as fragile — see the
 *     INVARIANT comment in ConfirmCard.tsx that pins why 'error' must NOT
 *     be in the early-return guard,
 *   - the error-state "Not now" (dead button in the old
 *     MedicationConfirmCard — its guard blocked dismissal from 'error'),
 *   - the blood-work unit-picker fallback when a marker has unit: null.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmCard } from '@/components/check-in/ConfirmCard'

function doseCard(
  overrides: Partial<React.ComponentProps<typeof ConfirmCard>> = {},
) {
  return (
    <ConfirmCard
      kind="dose-change"
      medicationName="Tacrolimus"
      oldDose="1mg"
      newDose="2mg"
      onConfirm={vi.fn()}
      onUndoSave={vi.fn()}
      {...(overrides as object)}
    />
  )
}

describe('<ConfirmCard /> — dose-change kind', () => {
  it('renders prompt with medication name, doses, and reason', () => {
    render(doseCard({ reason: 'tapering per Dr. Shah' }))
    const card = screen.getByTestId('confirm-card-dose-change')
    expect(card).toHaveAttribute('data-state', 'prompt')
    expect(
      screen.getByText(/Dose change for Tacrolimus\?/),
    ).toBeInTheDocument()
    expect(screen.getByText(/I heard: 1mg → 2mg/)).toBeInTheDocument()
    expect(
      screen.getByTestId('confirm-card-dose-change-reason'),
    ).toHaveTextContent('tapering per Dr. Shah')
  })

  it('Save → onConfirm fires, transitions to saved row with Undo chip', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(doseCard({ onConfirm }))
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-confirm'),
    )
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Saved Tacrolimus → 2mg\./)).toBeInTheDocument()
    expect(
      screen.getByTestId('confirm-card-dose-change-undo'),
    ).toBeInTheDocument()
  })

  it('Save throws → error state; retry re-fires onConfirm and saves (retry-guard invariant)', async () => {
    // The retry path is the regression R3 #5 flagged. The setDone('prompt')
    // in the retry click handler is queued; handleConfirm reads stale
    // done='error' but is allowed through because the early-return guard
    // does NOT include 'error'. This test pins that contract for the
    // dose-change variant, which previously had zero coverage.
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('first try fails'))
      .mockResolvedValueOnce(undefined)
    render(doseCard({ onConfirm }))
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-confirm'),
    )
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'error',
      )
    })
    await userEvent.click(screen.getByTestId('confirm-card-dose-change-retry'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it('error-state "Not now" dismisses (dead button in the old MedicationConfirmCard)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'))
    render(doseCard({ onConfirm }))
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-confirm'),
    )
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'error',
      )
    })
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-dismiss'),
    )
    expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
      'data-state',
      'dismissed',
    )
  })
})

describe('<ConfirmCard /> — P1 undo semantics', () => {
  it('"Not now" → dismissed row stays rendered with an Undo chip (no silent drop)', async () => {
    render(doseCard())
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-dismiss'),
    )
    const card = screen.getByTestId('confirm-card-dose-change')
    expect(card).toHaveAttribute('data-state', 'dismissed')
    expect(screen.getByText(/Okay, not saving this\./)).toBeInTheDocument()
    expect(
      screen.getByTestId('confirm-card-dose-change-undo'),
    ).toBeInTheDocument()
  })

  it('undo-after-dismiss restores the prompt card', async () => {
    render(doseCard())
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-dismiss'),
    )
    await userEvent.click(screen.getByTestId('confirm-card-dose-change-undo'))
    expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
      'data-state',
      'prompt',
    )
    expect(
      screen.getByTestId('confirm-card-dose-change-confirm'),
    ).toBeInTheDocument()
  })

  it('undo-after-save calls onUndoSave then restores the prompt card', async () => {
    const onUndoSave = vi.fn().mockResolvedValue(undefined)
    render(doseCard({ onConfirm: vi.fn().mockResolvedValue(undefined), onUndoSave }))
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-confirm'),
    )
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    await userEvent.click(screen.getByTestId('confirm-card-dose-change-undo'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'prompt',
      )
    })
    expect(onUndoSave).toHaveBeenCalledTimes(1)
  })

  it('failed undo-after-save keeps the saved row and its Undo chip (retryable)', async () => {
    const onUndoSave = vi.fn().mockRejectedValue(new Error('network'))
    render(doseCard({ onConfirm: vi.fn().mockResolvedValue(undefined), onUndoSave }))
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-confirm'),
    )
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    await userEvent.click(screen.getByTestId('confirm-card-dose-change-undo'))
    await waitFor(() => expect(onUndoSave).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
      'data-state',
      'saved',
    )
    expect(
      screen.getByTestId('confirm-card-dose-change-undo'),
    ).toBeInTheDocument()
  })

  it('save works again after undo-after-save (fresh write)', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      doseCard({
        onConfirm,
        onUndoSave: vi.fn().mockResolvedValue(undefined),
      }),
    )
    await userEvent.click(
      screen.getByTestId('confirm-card-dose-change-confirm'),
    )
    await userEvent.click(
      await screen.findByTestId('confirm-card-dose-change-undo'),
    )
    await userEvent.click(
      await screen.findByTestId('confirm-card-dose-change-confirm'),
    )
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-dose-change')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })
})

describe('<ConfirmCard /> — visit kind', () => {
  it('renders prompt with formatted date, doctor name + visit type', () => {
    render(
      <ConfirmCard
        kind="visit"
        date="2026-05-09"
        doctorName="Dr. Mehta"
        visitType="follow-up"
        onConfirm={vi.fn()}
        onUndoSave={vi.fn()}
      />,
    )
    expect(screen.getByTestId('confirm-card-visit')).toHaveAttribute(
      'data-state',
      'prompt',
    )
    // Title uses formatted date "Sat, 9 May 2026" (IST), not the ISO YYYY-MM-DD.
    expect(
      screen.getByText(/Doctor visit on Sat, 9 May 2026/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Dr\. Mehta · Follow-up/)).toBeInTheDocument()
  })

  it('Save → onConfirm fires, saved row carries the doctor name', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <ConfirmCard
        kind="visit"
        date="2026-05-09"
        doctorName="Dr. Mehta"
        visitType="consultation"
        onConfirm={onConfirm}
        onUndoSave={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId('confirm-card-visit-confirm'))
    await waitFor(() => {
      expect(screen.getByTestId('confirm-card-visit')).toHaveAttribute(
        'data-state',
        'saved',
      )
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Saved — Dr\. Mehta/)).toBeInTheDocument()
  })
})

describe('<ConfirmCard /> — blood-work kind', () => {
  it('passes resolved markers (with unit) when unit was provided', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <ConfirmCard
        kind="blood-work"
        date="2026-05-09"
        markers={[{ name: 'CRP', value: 12, unit: 'mg/L' }]}
        onConfirm={onConfirm}
        onUndoSave={vi.fn()}
      />,
    )
    await userEvent.click(
      screen.getByTestId('confirm-card-blood-work-confirm'),
    )
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith([
      { name: 'CRP', value: 12, unit: 'mg/L' },
    ])
  })

  it('renders unit picker when marker.unit === null and uses default unit on save', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <ConfirmCard
        kind="blood-work"
        date="2026-05-09"
        markers={[{ name: 'CRP', value: 12, unit: null }]}
        onConfirm={onConfirm}
        onUndoSave={vi.fn()}
      />,
    )
    expect(
      screen.getByTestId('confirm-card-blood-work-unit-0'),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByTestId('confirm-card-blood-work-confirm'),
    )
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    // Default is the first COMMON_UNITS entry — 'mg/L'.
    expect(onConfirm).toHaveBeenCalledWith([
      { name: 'CRP', value: 12, unit: 'mg/L' },
    ])
  })

  it('user-selected unit overrides default and survives a dismiss/undo round-trip', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <ConfirmCard
        kind="blood-work"
        date="2026-05-09"
        markers={[{ name: 'ESR', value: 30, unit: null }]}
        onConfirm={onConfirm}
        onUndoSave={vi.fn()}
      />,
    )
    await userEvent.selectOptions(
      screen.getByTestId('confirm-card-blood-work-unit-0'),
      'mm/hr',
    )
    // Dismiss then undo — the pick must survive (state never unmounts).
    await userEvent.click(
      screen.getByTestId('confirm-card-blood-work-dismiss'),
    )
    await userEvent.click(screen.getByTestId('confirm-card-blood-work-undo'))
    await userEvent.click(
      screen.getByTestId('confirm-card-blood-work-confirm'),
    )
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith([
      { name: 'ESR', value: 30, unit: 'mm/hr' },
    ])
  })
})
