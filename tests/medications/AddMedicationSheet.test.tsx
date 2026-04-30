/**
 * AddMedicationSheet tests — F04 chunk 4.B, US-4.B.1 + US-4.B.2.
 *
 * Coverage:
 *   - Renders nothing when `open === false`.
 *   - Submit is disabled until name + dose + frequency are all non-empty.
 *   - Submit calls `onSubmit` with trimmed values + locked enums.
 *   - Pre-fill via `initial` populates the form for edit mode.
 *   - "edit" mode shows "Save changes"; "add" mode shows "Save medication".
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  AddMedicationSheet,
  type MedicationFormValues,
} from '@/components/medications/AddMedicationSheet'

describe('AddMedicationSheet', () => {
  it('renders nothing when closed', () => {
    render(
      <AddMedicationSheet
        open={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('add-medication-sheet')).not.toBeInTheDocument()
  })

  it('disables submit until all required text fields are filled', async () => {
    const onSubmit = vi.fn()
    render(
      <AddMedicationSheet
        open={true}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    const submit = screen.getByTestId('add-medication-submit')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/^name$/i), 'Methotrexate')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/^dose$/i), '15mg')
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/^frequency$/i), 'once weekly')
    expect(submit).not.toBeDisabled()

    // Whitespace-only inputs should not satisfy the requirement.
    await userEvent.clear(screen.getByLabelText(/^name$/i))
    await userEvent.type(screen.getByLabelText(/^name$/i), '   ')
    expect(submit).toBeDisabled()
  })

  it('submits trimmed values + selected enums via onSubmit', async () => {
    const onSubmit = vi.fn<(v: MedicationFormValues) => Promise<void>>(
      async () => {
        /* no-op */
      },
    )
    render(
      <AddMedicationSheet
        open={true}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await userEvent.type(
      screen.getByLabelText(/^name$/i),
      '  Methotrexate  ',
    )
    await userEvent.type(screen.getByLabelText(/^dose$/i), '15mg')
    await userEvent.type(screen.getByLabelText(/^frequency$/i), 'once weekly')
    await userEvent.selectOptions(
      screen.getByLabelText(/^category$/i),
      'immunosuppressant',
    )
    await userEvent.selectOptions(
      screen.getByLabelText(/^delivery$/i),
      'oral',
    )

    await userEvent.click(screen.getByTestId('add-medication-submit'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Methotrexate',
      dose: '15mg',
      frequency: 'once weekly',
      category: 'immunosuppressant',
      delivery: 'oral',
    })
  })

  it('pre-fills via `initial` for edit mode and uses the edit-mode submit label', () => {
    render(
      <AddMedicationSheet
        open={true}
        mode="edit"
        initial={{
          name: 'Prednisone',
          dose: '10mg',
          frequency: 'once daily',
          category: 'steroid',
          delivery: 'oral',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Prednisone')
    expect(screen.getByLabelText(/^dose$/i)).toHaveValue('10mg')
    expect(screen.getByLabelText(/^frequency$/i)).toHaveValue('once daily')
    expect(screen.getByTestId('add-medication-submit')).toHaveTextContent(
      /save changes/i,
    )
  })
})
