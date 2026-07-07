/**
 * <ConfirmCardStack /> tests — W2-4 (Lane 1D part 2).
 *
 * The stack owns the N-rule from feedback_confirm_card_stack_threshold:
 *   - N≤3 → individual cards in the locked order (dose changes →
 *     children/summary slot → visits → blood work),
 *   - N≥4 → grouped presentation: summary first, then a "I also caught N
 *     things to save" section with collapsed rows that expand one at a
 *     time; "Save all" only when no blood-work marker is missing a unit.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  ConfirmCardStack,
  type ConfirmCardStackItem,
} from '@/components/check-in/ConfirmCardStack'

function doseItem(key: string, name = 'Tacrolimus'): ConfirmCardStackItem {
  return {
    key,
    kind: 'dose-change',
    medicationName: name,
    oldDose: '1mg',
    newDose: '2mg',
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onUndoSave: vi.fn(),
  }
}

function visitItem(key: string): ConfirmCardStackItem {
  return {
    key,
    kind: 'visit',
    date: '2026-05-09',
    doctorName: 'Dr. Mehta',
    visitType: 'follow-up',
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onUndoSave: vi.fn(),
  }
}

function bloodWorkItem(
  key: string,
  unit: string | null = 'mg/L',
): ConfirmCardStackItem {
  return {
    key,
    kind: 'blood-work',
    date: '2026-05-09',
    markers: [{ name: 'CRP', value: 12, unit }],
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onUndoSave: vi.fn(),
  }
}

describe('<ConfirmCardStack /> — N≤3 individual presentation', () => {
  it('renders cards individually in locked order around the summary slot', () => {
    render(
      // Deliberately mis-ordered input — the stack owns the order.
      <ConfirmCardStack
        items={[bloodWorkItem('bw-1'), doseItem('dose-1'), visitItem('v-1')]}
      >
        <div data-testid="summary-slot" />
      </ConfirmCardStack>,
    )
    expect(screen.queryByTestId('confirm-card-group')).not.toBeInTheDocument()
    const cards = screen.getAllByTestId(/^confirm-card-(dose-change|visit|blood-work)$/)
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
      'confirm-card-dose-change',
      'confirm-card-visit',
      'confirm-card-blood-work',
    ])
    // Dose card above the summary slot, events below.
    const summary = screen.getByTestId('summary-slot')
    const dose = screen.getByTestId('confirm-card-dose-change')
    const visit = screen.getByTestId('confirm-card-visit')
    expect(
      dose.compareDocumentPosition(summary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      summary.compareDocumentPosition(visit) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders nothing extra when there are no items', () => {
    render(
      <ConfirmCardStack items={[]}>
        <div data-testid="summary-slot" />
      </ConfirmCardStack>,
    )
    expect(screen.getByTestId('summary-slot')).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-card-group')).not.toBeInTheDocument()
  })
})

describe('<ConfirmCardStack /> — N≥4 grouped presentation', () => {
  const fourItems = (): ConfirmCardStackItem[] => [
    doseItem('dose-1'),
    doseItem('dose-2', 'Prednisolone'),
    visitItem('v-1'),
    bloodWorkItem('bw-1'),
  ]

  it('renders the grouped section with a count header and collapsed rows', () => {
    render(
      <ConfirmCardStack items={fourItems()}>
        <div data-testid="summary-slot" />
      </ConfirmCardStack>,
    )
    const group = screen.getByTestId('confirm-card-group')
    expect(
      within(group).getByText(/I also caught 4 things to save/),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('confirm-card-group-row-dose-1'),
    ).toBeVisible()
    // Summary renders ABOVE the group.
    const summary = screen.getByTestId('summary-slot')
    expect(
      summary.compareDocumentPosition(group) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Cards are mounted but hidden until their row is expanded.
    expect(screen.getByTestId('confirm-card-visit')).not.toBeVisible()
  })

  it('expands one row at a time into the full card', async () => {
    render(<ConfirmCardStack items={fourItems()} />)
    await userEvent.click(screen.getByTestId('confirm-card-group-row-v-1'))
    expect(screen.getByTestId('confirm-card-visit')).toBeVisible()
    await userEvent.click(screen.getByTestId('confirm-card-group-row-bw-1'))
    expect(screen.getByTestId('confirm-card-blood-work')).toBeVisible()
    expect(screen.getByTestId('confirm-card-visit')).not.toBeVisible()
  })

  it('saving an expanded card collapses it and flips its row status to ✓', async () => {
    const items = fourItems()
    render(<ConfirmCardStack items={items} />)
    await userEvent.click(screen.getByTestId('confirm-card-group-row-v-1'))
    await userEvent.click(screen.getByTestId('confirm-card-visit-confirm'))
    await waitFor(() => {
      expect(
        screen.getByTestId('confirm-card-group-row-v-1-status'),
      ).toHaveTextContent('✓')
    })
    expect(screen.getByTestId('confirm-card-visit')).not.toBeVisible()
  })

  it('"Save all" saves every pending card', async () => {
    const items = fourItems()
    render(<ConfirmCardStack items={items} />)
    await userEvent.click(screen.getByTestId('confirm-card-group-save-all'))
    for (const item of items) {
      await waitFor(() => expect(item.onConfirm).toHaveBeenCalledTimes(1))
    }
    await waitFor(() => {
      expect(
        screen.getByTestId('confirm-card-group-row-dose-2-status'),
      ).toHaveTextContent('✓')
    })
    // Nothing pending → the bulk affordance goes away.
    expect(
      screen.queryByTestId('confirm-card-group-save-all'),
    ).not.toBeInTheDocument()
  })

  it('hides "Save all" when a blood-work marker is missing a unit (ambiguous)', () => {
    render(
      <ConfirmCardStack
        items={[
          doseItem('dose-1'),
          doseItem('dose-2', 'Prednisolone'),
          visitItem('v-1'),
          bloodWorkItem('bw-1', null),
        ]}
      />,
    )
    expect(
      screen.queryByTestId('confirm-card-group-save-all'),
    ).not.toBeInTheDocument()
  })

  it('a dismissed card keeps its undo path inside the group', async () => {
    render(<ConfirmCardStack items={fourItems()} />)
    await userEvent.click(screen.getByTestId('confirm-card-group-row-v-1'))
    await userEvent.click(screen.getByTestId('confirm-card-visit-dismiss'))
    await waitFor(() => {
      expect(
        screen.getByTestId('confirm-card-group-row-v-1-status'),
      ).toHaveTextContent('—')
    })
    // Re-expand → dismissed row with Undo → back to prompt.
    await userEvent.click(screen.getByTestId('confirm-card-group-row-v-1'))
    await userEvent.click(screen.getByTestId('confirm-card-visit-undo'))
    expect(screen.getByTestId('confirm-card-visit')).toHaveAttribute(
      'data-state',
      'prompt',
    )
    expect(
      screen.getByTestId('confirm-card-group-row-v-1-status'),
    ).toHaveTextContent('○')
  })
})
