/**
 * BloodWorkCard tests — F05 chunk 5.B, US-5.B.3.
 *
 * Coverage:
 *   - Renders date + marker count.
 *   - Abnormal-flag pill renders only when any marker has `abnormal: true`.
 *   - Tap bubbles `onSelect(id)`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BloodWorkCard } from '@/components/blood-work/BloodWorkCard'

describe('BloodWorkCard', () => {
  it('renders date + marker count and no abnormal pill when none flagged', () => {
    render(
      <BloodWorkCard
        bloodWork={{
          id: 'b-1',
          date: '2026-04-01',
          markers: [
            { name: 'CRP', value: 5, unit: 'mg/L' },
            { name: 'ESR', value: 12, unit: 'mm/hr' },
          ],
        }}
      />,
    )
    expect(screen.getByTestId('blood-work-card-b-1')).toBeInTheDocument()
    expect(screen.getByText(/Apr/)).toBeInTheDocument()
    expect(screen.getByText(/2 markers/i)).toBeInTheDocument()
    expect(
      screen.queryByTestId('blood-work-card-abnormal-b-1'),
    ).not.toBeInTheDocument()
  })

  it('renders the abnormal pill when at least one marker is flagged', () => {
    render(
      <BloodWorkCard
        bloodWork={{
          id: 'b-2',
          date: '2026-04-01',
          markers: [
            { name: 'CRP', value: 5, unit: 'mg/L' },
            { name: 'ESR', value: 50, unit: 'mm/hr', abnormal: true },
          ],
        }}
      />,
    )
    expect(
      screen.getByTestId('blood-work-card-abnormal-b-2'),
    ).toHaveTextContent(/abnormal/i)
  })

  it('uses the singular noun "marker" when count is 1', () => {
    render(
      <BloodWorkCard
        bloodWork={{
          id: 'b-3',
          date: '2026-04-01',
          markers: [{ name: 'CRP', value: 5, unit: 'mg/L' }],
        }}
      />,
    )
    expect(screen.getByText(/^1 marker$/i)).toBeInTheDocument()
  })

  it('bubbles onSelect with the entry id when tapped', async () => {
    const onSelect = vi.fn()
    render(
      <BloodWorkCard
        bloodWork={{
          id: 'b-4',
          date: '2026-04-01',
          markers: [{ name: 'CRP', value: 5, unit: 'mg/L' }],
        }}
        onSelect={onSelect}
      />,
    )
    await userEvent.click(screen.getByLabelText(/open blood work/i))
    expect(onSelect).toHaveBeenCalledWith('b-4')
  })
})
