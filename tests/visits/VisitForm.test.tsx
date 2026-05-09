/**
 * VisitForm tests — F05 chunk 5.B, US-5.B.1 + US-5.B.3.
 *
 * Coverage:
 *   - Submit disabled until date + doctorName + visitType are filled.
 *   - Submit calls `onSubmit` with trimmed values + selected enum.
 *   - Pre-fill via `initial` populates the form for edit mode.
 *   - Edit-mode submit label reads "Save changes".
 *   - Inline error from `errorMessage` renders.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { VisitForm, type VisitFormValues } from '@/components/visits/VisitForm'

describe('VisitForm', () => {
  it('disables submit until doctorName is filled (date + visitType default)', async () => {
    render(<VisitForm onSubmit={vi.fn()} />)
    const submit = screen.getByTestId('visit-form-submit')
    expect(submit).toBeDisabled()

    await userEvent.type(
      screen.getByLabelText(/who did you see\?/i),
      'Dr. Mehta',
    )
    expect(submit).not.toBeDisabled()

    // Whitespace-only doctorName fails the trim guard.
    await userEvent.clear(screen.getByLabelText(/who did you see\?/i))
    await userEvent.type(screen.getByLabelText(/who did you see\?/i), '   ')
    expect(submit).toBeDisabled()
  })

  it('submits trimmed values + selected visitType via onSubmit', async () => {
    const onSubmit = vi.fn<(v: VisitFormValues) => Promise<void>>(async () => {
      /* no-op */
    })
    render(<VisitForm onSubmit={onSubmit} />)

    await userEvent.type(
      screen.getByLabelText(/who did you see\?/i),
      '  Dr. Mehta  ',
    )
    await userEvent.type(
      screen.getByLabelText(/specialty/i),
      'Rheumatologist',
    )
    await userEvent.selectOptions(
      screen.getByLabelText(/type of visit/i),
      'follow-up',
    )
    await userEvent.type(
      screen.getByLabelText(/notes/i),
      '  CRP up to 12  ',
    )

    await userEvent.click(screen.getByTestId('visit-form-submit'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const call = onSubmit.mock.calls[0][0]
    expect(call.doctorName).toBe('Dr. Mehta')
    expect(call.specialty).toBe('Rheumatologist')
    expect(call.visitType).toBe('follow-up')
    expect(call.notes).toBe('CRP up to 12')
    // date defaults to today (YYYY-MM-DD); just assert the shape.
    expect(call.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('pre-fills via initial for edit mode and uses the edit-mode submit label', () => {
    render(
      <VisitForm
        mode="edit"
        initial={{
          date: '2026-04-01',
          doctorName: 'Dr. Iyer',
          specialty: 'Rheumatologist',
          visitType: 'urgent',
          notes: 'Sent for blood work',
        }}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/who did you see\?/i)).toHaveValue('Dr. Iyer')
    expect(screen.getByLabelText(/specialty/i)).toHaveValue('Rheumatologist')
    expect(screen.getByLabelText(/type of visit/i)).toHaveValue('urgent')
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Sent for blood work')
    expect(screen.getByTestId('visit-form-submit')).toHaveTextContent(
      /save changes/i,
    )
  })

  it('renders an inline error from `errorMessage`', () => {
    render(
      <VisitForm
        onSubmit={vi.fn()}
        errorMessage="Network slipped — try again."
      />,
    )
    const err = screen.getByTestId('visit-form-error')
    expect(err).toHaveTextContent(/network slipped/i)
    expect(err).toHaveAttribute('role', 'alert')
  })
})
