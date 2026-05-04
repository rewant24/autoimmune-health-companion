/**
 * RegimenList tests — F04 chunk 4.B, US-4.B.2.
 *
 * Coverage:
 *   - Loading state placeholder when `medications === undefined`.
 *   - Empty state copy + add CTA when `medications === []`.
 *   - Populated state renders one MedicationCard per medication.
 *   - Card click bubbles `onEdit(id)`; Dose change → `onDoseChange(id)`;
 *     Deactivate → `onDeactivate(id)`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RegimenList } from '@/components/medications/RegimenList'
import type { MedicationCardData } from '@/components/medications/MedicationCard'

function noop(): void {
  /* no-op */
}

function makeMed(over: Partial<MedicationCardData> = {}): MedicationCardData {
  return {
    id: 'med-1',
    name: 'Methotrexate',
    dose: '15mg',
    frequency: 'once weekly',
    category: 'immunosuppressant',
    ...over,
  }
}

describe('RegimenList', () => {
  it('renders the loading placeholder when medications is undefined', () => {
    render(
      <RegimenList
        medications={undefined}
        onAdd={noop}
        onEdit={noop}
        onDoseChange={noop}
        onDeactivate={noop}
      />,
    )
    expect(screen.getByTestId('regimen-list-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('regimen-list-empty')).not.toBeInTheDocument()
    expect(screen.queryByTestId('regimen-list')).not.toBeInTheDocument()
  })

  it('renders the empty state with the locked copy + add CTA', async () => {
    const onAdd = vi.fn()
    render(
      <RegimenList
        medications={[]}
        onAdd={onAdd}
        onEdit={noop}
        onDoseChange={noop}
        onDeactivate={noop}
      />,
    )
    expect(screen.getByTestId('regimen-list-empty')).toBeInTheDocument()
    expect(
      screen.getByText(/your regimen is empty — add what you take\./i),
    ).toBeInTheDocument()

    const cta = screen.getByTestId('regimen-list-add-cta')
    expect(cta).toHaveTextContent(/\+ add medication/i)
    await userEvent.click(cta)
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('renders a card per active medication and routes actions back', async () => {
    const onEdit = vi.fn()
    const onDoseChange = vi.fn()
    const onDeactivate = vi.fn()
    render(
      <RegimenList
        medications={[
          makeMed({ id: 'med-1', name: 'Methotrexate' }),
          makeMed({ id: 'med-2', name: 'Folic acid', category: 'supplement' }),
        ]}
        onAdd={noop}
        onEdit={onEdit}
        onDoseChange={onDoseChange}
        onDeactivate={onDeactivate}
      />,
    )
    expect(screen.getByTestId('regimen-list')).toBeInTheDocument()
    expect(screen.getByTestId('medication-card-med-1')).toBeInTheDocument()
    expect(screen.getByTestId('medication-card-med-2')).toBeInTheDocument()

    // Edit by clicking the card body button.
    await userEvent.click(screen.getByLabelText(/edit methotrexate/i))
    expect(onEdit).toHaveBeenCalledWith('med-1')

    // Dose change buttons (one per card) — pick the first.
    const [doseChangeBtn] = screen.getAllByRole('button', {
      name: /dose change/i,
    })
    await userEvent.click(doseChangeBtn)
    expect(onDoseChange).toHaveBeenCalledWith('med-1')

    // Deactivate buttons.
    const [deactivateBtn] = screen.getAllByRole('button', {
      name: /deactivate/i,
    })
    await userEvent.click(deactivateBtn)
    expect(onDeactivate).toHaveBeenCalledWith('med-1')
  })
})
