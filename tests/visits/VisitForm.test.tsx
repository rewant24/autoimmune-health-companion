/**
 * VisitForm — chunk 5.B, US-5.B.1.
 *
 * Coverage:
 *   - Renders the locked copy.
 *   - Submit disabled until date + doctorName + visitType are all filled.
 *   - Validates required fields on submit attempt (inline errors).
 *   - Strips empty optionals; trims doctorName, specialty, notes.
 *   - Reports submitting state on the button.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { VisitForm, isValidVisit } from '@/components/visits/VisitForm'

describe('VisitForm — pure validity', () => {
  it('rejects when date / doctor / visitType is missing', () => {
    expect(
      isValidVisit({
        date: '',
        doctorName: 'Dr. M',
        specialty: '',
        visitType: 'consultation',
        notes: '',
      }),
    ).toBe(false)
    expect(
      isValidVisit({
        date: '2026-04-30',
        doctorName: '   ',
        specialty: '',
        visitType: 'consultation',
        notes: '',
      }),
    ).toBe(false)
    expect(
      isValidVisit({
        date: '2026-04-30',
        doctorName: 'Dr. M',
        specialty: '',
        visitType: '',
        notes: '',
      }),
    ).toBe(false)
  })

  it('accepts a complete value', () => {
    expect(
      isValidVisit({
        date: '2026-04-30',
        doctorName: 'Dr. M',
        specialty: '',
        visitType: 'follow-up',
        notes: '',
      }),
    ).toBe(true)
  })
})

describe('<VisitForm />', () => {
  it('renders the locked labels and submit copy', () => {
    render(<VisitForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('When?')).toBeInTheDocument()
    expect(screen.getByLabelText('Who did you see?')).toBeInTheDocument()
    // Specialty placeholder is visible inside the empty option
    expect(
      screen.getByRole('combobox', { name: /specialty/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Type of visit')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Anything you want to remember (optional)'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save visit/i })).toBeInTheDocument()
  })

  it('disables submit when doctorName + visitType are missing', () => {
    render(<VisitForm onSubmit={vi.fn()} />)
    const submit = screen.getByTestId('visit-submit')
    expect(submit).toBeDisabled()
  })

  it('enables submit once all required fields are filled', () => {
    render(<VisitForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByTestId('visit-doctor-input'), {
      target: { value: 'Dr. Mehta' },
    })
    fireEvent.click(screen.getByTestId('visit-type-consultation'))
    expect(screen.getByTestId('visit-submit')).not.toBeDisabled()
  })

  it('shows inline errors on submit when required fields are blank', async () => {
    const onSubmit = vi.fn()
    render(<VisitForm onSubmit={onSubmit} />)
    // Clear the date so we can verify the date error path too.
    const dateInput = screen.getByTestId('visit-date-input') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '' } })
    // Force-submit by firing a submit event on the form (the disabled
    // button blocks click-driven submits but we want to verify the
    // touched-state logic).
    const form = screen.getByTestId('visit-form')
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByTestId('visit-date-error')).toBeInTheDocument()
    expect(screen.getByTestId('visit-doctor-error')).toBeInTheDocument()
    expect(screen.getByTestId('visit-type-error')).toBeInTheDocument()
  })

  it('submits a normalized payload with trimmed strings + omitted optionals', async () => {
    const onSubmit = vi.fn()
    render(<VisitForm onSubmit={onSubmit} initial={{ date: '2026-04-30' }} />)
    fireEvent.change(screen.getByTestId('visit-doctor-input'), {
      target: { value: '  Dr. Mehta  ' },
    })
    fireEvent.click(screen.getByTestId('visit-type-follow-up'))
    await act(async () => {
      fireEvent.submit(screen.getByTestId('visit-form'))
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-04-30',
      doctorName: 'Dr. Mehta',
      visitType: 'follow-up',
    })
  })

  it('passes notes + specialty when supplied (trimmed)', async () => {
    const onSubmit = vi.fn()
    render(<VisitForm onSubmit={onSubmit} initial={{ date: '2026-04-30' }} />)
    fireEvent.change(screen.getByTestId('visit-doctor-input'), {
      target: { value: 'Dr. Mehta' },
    })
    fireEvent.change(screen.getByTestId('visit-specialty-input'), {
      target: { value: 'Rheumatology' },
    })
    fireEvent.change(screen.getByTestId('visit-notes-input'), {
      target: { value: '  Adjusted MTX dose.  ' },
    })
    fireEvent.click(screen.getByTestId('visit-type-consultation'))
    await act(async () => {
      fireEvent.submit(screen.getByTestId('visit-form'))
    })
    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-04-30',
      doctorName: 'Dr. Mehta',
      specialty: 'Rheumatology',
      visitType: 'consultation',
      notes: 'Adjusted MTX dose.',
    })
  })

  it('disables the submit button while isSubmitting', () => {
    render(
      <VisitForm
        onSubmit={vi.fn()}
        isSubmitting
        initial={{
          date: '2026-04-30',
          doctorName: 'Dr. M',
          visitType: 'consultation',
        }}
      />,
    )
    expect(screen.getByTestId('visit-submit')).toBeDisabled()
    expect(screen.getByTestId('visit-submit')).toHaveTextContent('Saving')
  })
})
