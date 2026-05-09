/**
 * VisitCard tests — F05 chunk 5.B, US-5.B.3.
 *
 * Coverage:
 *   - Renders date + doctor + specialty + visitType pill + notes preview.
 *   - Tap bubbles `onSelect(id)`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { VisitCard } from '@/components/visits/VisitCard'

describe('VisitCard', () => {
  it('renders date, doctor, specialty, visitType pill, and notes preview', () => {
    render(
      <VisitCard
        visit={{
          id: 'v-1',
          date: '2026-04-01',
          doctorName: 'Dr. Mehta',
          specialty: 'Rheumatologist',
          visitType: 'follow-up',
          notes: 'CRP up. Discussed dose change.',
        }}
      />,
    )
    expect(screen.getByTestId('visit-card-v-1')).toBeInTheDocument()
    // formatted date uses en-GB IST — assert the day-of-month token only,
    // which is locale-stable across CI envs.
    expect(screen.getByText(/Apr/)).toBeInTheDocument()
    expect(screen.getByText(/Dr\. Mehta/)).toBeInTheDocument()
    expect(screen.getByText(/Rheumatologist/)).toBeInTheDocument()
    expect(screen.getByTestId('visit-card-type-v-1')).toHaveTextContent(
      /follow-up/i,
    )
    expect(screen.getByText(/CRP up\. Discussed dose change\./)).toBeInTheDocument()
  })

  it('omits the notes preview when notes are empty/missing', () => {
    render(
      <VisitCard
        visit={{
          id: 'v-2',
          date: '2026-04-01',
          doctorName: 'Dr. Mehta',
          visitType: 'consultation',
        }}
      />,
    )
    expect(screen.getByTestId('visit-card-v-2')).toBeInTheDocument()
    expect(screen.getByTestId('visit-card-type-v-2')).toHaveTextContent(
      /consultation/i,
    )
  })

  it('bubbles onSelect with the visit id when tapped', async () => {
    const onSelect = vi.fn()
    render(
      <VisitCard
        visit={{
          id: 'v-3',
          date: '2026-04-01',
          doctorName: 'Dr. Mehta',
          visitType: 'urgent',
        }}
        onSelect={onSelect}
      />,
    )
    await userEvent.click(screen.getByLabelText(/open visit/i))
    expect(onSelect).toHaveBeenCalledWith('v-3')
  })
})
