/**
 * BloodWorkForm tests — F05 chunk 5.B, US-5.B.2.
 *
 * Coverage:
 *   - Default markers (CRP, ESR, WBC, Hb) pre-populated as four rows.
 *   - "+ Add another marker" appends a freeform row.
 *   - X removes a row.
 *   - Submit disabled until ≥1 marker has name + value + unit AND value is
 *     a finite number.
 *   - Submit calls `onSubmit` with parsed numerics + abnormal flag derived
 *     when both bounds present.
 *   - Inline error from `errorMessage` renders.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  BloodWorkForm,
  type BloodWorkFormValues,
} from '@/components/blood-work/BloodWorkForm'

describe('BloodWorkForm', () => {
  it('pre-populates the four default markers', () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    const list = screen.getByTestId('blood-work-marker-list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    // Marker name fields are pre-populated. Use exact label match so we
    // don't pick up the X button's "Remove marker N" aria-label.
    const nameInputs = within(list).getAllByLabelText('Marker')
    const values = nameInputs.map((el) => (el as HTMLInputElement).value)
    expect(values).toEqual(['CRP', 'ESR', 'WBC', 'Hb'])
  })

  it('appends a row via "+ Add another marker" and removes via X', async () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    const list = screen.getByTestId('blood-work-marker-list')

    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    await userEvent.click(screen.getByTestId('blood-work-add-marker'))
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)

    // Remove the first row (CRP).
    await userEvent.click(screen.getByTestId('marker-remove-0'))
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
  })

  it('keeps submit disabled until ≥1 marker has name + value + unit', async () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    const submit = screen.getByTestId('blood-work-form-submit')
    expect(submit).toBeDisabled()

    // Fill value on the CRP row but skip unit — still disabled.
    const list = screen.getByTestId('blood-work-marker-list')
    const valueInputs = within(list).getAllByLabelText(/^value$/i)
    await userEvent.type(valueInputs[0], '12')
    expect(submit).toBeDisabled()

    // Now fill unit — enabled.
    const unitInputs = within(list).getAllByLabelText(/^unit$/i)
    await userEvent.type(unitInputs[0], 'mg/L')
    expect(submit).not.toBeDisabled()

    // Type a non-numeric value — re-disabled (NaN guard).
    await userEvent.clear(valueInputs[0])
    await userEvent.type(valueInputs[0], 'abc')
    expect(submit).toBeDisabled()
  })

  it('submits parsed numerics + derives abnormal when both ref bounds present', async () => {
    const onSubmit = vi.fn<(v: BloodWorkFormValues) => Promise<void>>(
      async () => {
        /* no-op */
      },
    )
    render(<BloodWorkForm onSubmit={onSubmit} />)
    const list = screen.getByTestId('blood-work-marker-list')

    const valueInputs = within(list).getAllByLabelText(/^value$/i)
    const unitInputs = within(list).getAllByLabelText(/^unit$/i)
    const lowInputs = within(list).getAllByLabelText(/ref low/i)
    const highInputs = within(list).getAllByLabelText(/ref high/i)

    // CRP = 12, ref 0–10 → abnormal.
    await userEvent.type(valueInputs[0], '12')
    await userEvent.type(unitInputs[0], 'mg/L')
    await userEvent.type(lowInputs[0], '0')
    await userEvent.type(highInputs[0], '10')

    await userEvent.click(screen.getByTestId('blood-work-form-submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const call = onSubmit.mock.calls[0][0]
    expect(call.markers).toHaveLength(1)
    expect(call.markers[0]).toMatchObject({
      name: 'CRP',
      value: 12,
      unit: 'mg/L',
      refRangeLow: 0,
      refRangeHigh: 10,
      abnormal: true,
    })
    expect(call.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('renders an inline error from `errorMessage`', () => {
    render(
      <BloodWorkForm
        onSubmit={vi.fn()}
        errorMessage="Server slipped — try again."
      />,
    )
    const err = screen.getByTestId('blood-work-form-error')
    expect(err).toHaveTextContent(/server slipped/i)
    expect(err).toHaveAttribute('role', 'alert')
  })
})
