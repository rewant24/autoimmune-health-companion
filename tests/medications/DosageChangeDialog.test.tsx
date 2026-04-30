/**
 * DosageChangeDialog tests — F04 chunk 4.B, US-4.B.3.
 *
 * Coverage:
 *   - Renders nothing when `open === false`.
 *   - Shows the medication name + current (read-only) dose.
 *   - Save is disabled until newDose is non-empty AND differs from current.
 *   - Submit fires `onSubmit({ newDose, reason })` with reason `null` when
 *     the optional reason field is left empty.
 *   - Submit fires with the trimmed reason string when filled.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DosageChangeDialog } from '@/components/medications/DosageChangeDialog'

describe('DosageChangeDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <DosageChangeDialog
        open={false}
        medicationName="Methotrexate"
        currentDose="15mg"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('dosage-change-dialog')).not.toBeInTheDocument()
  })

  it('shows current dose read-only and disables save until newDose differs', async () => {
    render(
      <DosageChangeDialog
        open={true}
        medicationName="Methotrexate"
        currentDose="15mg"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('dosage-change-current-dose')).toHaveTextContent(
      '15mg',
    )

    const submit = screen.getByTestId('dosage-change-submit')
    expect(submit).toBeDisabled()

    // Same value as currentDose — still disabled.
    await userEvent.type(screen.getByLabelText(/^new dose$/i), '15mg')
    expect(submit).toBeDisabled()

    // Different value — enabled.
    await userEvent.clear(screen.getByLabelText(/^new dose$/i))
    await userEvent.type(screen.getByLabelText(/^new dose$/i), '20mg')
    expect(submit).not.toBeDisabled()
  })

  it('records oldDose → newDose with null reason when reason left empty', async () => {
    const onSubmit = vi.fn<
      (v: { newDose: string; reason: string | null }) => Promise<void>
    >(async () => {
      /* no-op */
    })
    render(
      <DosageChangeDialog
        open={true}
        medicationName="Methotrexate"
        currentDose="15mg"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText(/^new dose$/i), '20mg')
    await userEvent.click(screen.getByTestId('dosage-change-submit'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      newDose: '20mg',
      reason: null,
    })
  })

  it('passes the trimmed reason string when filled', async () => {
    const onSubmit = vi.fn<
      (v: { newDose: string; reason: string | null }) => Promise<void>
    >(async () => {
      /* no-op */
    })
    render(
      <DosageChangeDialog
        open={true}
        medicationName="Methotrexate"
        currentDose="15mg"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText(/^new dose$/i), '20mg')
    await userEvent.type(screen.getByLabelText(/^reason/i), '  flare  ')
    await userEvent.click(screen.getByTestId('dosage-change-submit'))

    expect(onSubmit).toHaveBeenCalledWith({
      newDose: '20mg',
      reason: 'flare',
    })
  })
})
