/**
 * TapInput component tests (Feature 01, Cycle 2, Chunk 2.C).
 *
 * Stories: US-1.E.3 (per-metric controls) + US-1.E.4 (skip-today affordance).
 */

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TapInput } from '@/components/check-in/TapInput'

describe('<TapInput />', () => {
  describe('pain (slider 1-10)', () => {
    it('renders a slider with min=1 max=10 and shows the current value above', () => {
      render(
        <TapInput
          metric="pain"
          value={5}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      const slider = screen.getByRole('slider', { name: /pain/i })
      expect(slider).toHaveAttribute('min', '1')
      expect(slider).toHaveAttribute('max', '10')
      expect(slider).toHaveAttribute('aria-valuenow', '5')
      expect(screen.getByTestId('tap-input-pain-readout')).toHaveTextContent('5')
    })

    it('calls onUpdate when slider changes', () => {
      const onUpdate = vi.fn()
      render(
        <TapInput
          metric="pain"
          value={3}
          declined={false}
          onUpdate={onUpdate}
          onDecline={() => {}}
        />,
      )
      const slider = screen.getByRole('slider', { name: /pain/i })
      fireEvent.change(slider, { target: { value: '7' } })
      expect(onUpdate).toHaveBeenCalledWith('pain', 7)
    })

    it('uses a 44pt min hit target', () => {
      render(
        <TapInput
          metric="pain"
          value={5}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      const slider = screen.getByRole('slider', { name: /pain/i })
      expect(slider).toHaveClass('min-h-11')
    })
  })

  describe('energy (slider 1-10)', () => {
    it('renders a slider with min=1 max=10', () => {
      render(
        <TapInput
          metric="energy"
          value={4}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      const slider = screen.getByRole('slider', { name: /energy/i })
      expect(slider).toHaveAttribute('min', '1')
      expect(slider).toHaveAttribute('max', '10')
      expect(slider).toHaveAttribute('aria-valuenow', '4')
    })
  })

  describe('mood (5-chip group)', () => {
    it('renders the five mood chips in scoping order', () => {
      render(
        <TapInput
          metric="mood"
          value={null}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      const chips = screen.getAllByRole('radio')
      expect(chips).toHaveLength(5)
      expect(chips.map((c) => c.textContent)).toEqual([
        'heavy',
        'flat',
        'okay',
        'bright',
        'great',
      ])
    })

    it('selects the active chip via aria-checked', () => {
      render(
        <TapInput
          metric="mood"
          value="okay"
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      const okay = screen.getByRole('radio', { name: 'okay' })
      expect(okay).toHaveAttribute('aria-checked', 'true')
    })

    it('calls onUpdate with the chip value when tapped', async () => {
      const onUpdate = vi.fn()
      render(
        <TapInput
          metric="mood"
          value={null}
          declined={false}
          onUpdate={onUpdate}
          onDecline={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('radio', { name: 'bright' }))
      expect(onUpdate).toHaveBeenCalledWith('mood', 'bright')
    })

    it('uses min-h-11 (44pt) on each chip', () => {
      render(
        <TapInput
          metric="mood"
          value={null}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      const chips = screen.getAllByRole('radio')
      for (const chip of chips) {
        expect(chip).toHaveClass('min-h-11')
      }
    })
  })

  describe('adherenceTaken (two-toggle)', () => {
    it('renders "took them" / "missed" toggles', () => {
      render(
        <TapInput
          metric="adherenceTaken"
          value={null}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      expect(screen.getByRole('radio', { name: /took them/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /missed/i })).toBeInTheDocument()
    })

    it('calls onUpdate with true when "took them" tapped', async () => {
      const onUpdate = vi.fn()
      render(
        <TapInput
          metric="adherenceTaken"
          value={null}
          declined={false}
          onUpdate={onUpdate}
          onDecline={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('radio', { name: /took them/i }))
      expect(onUpdate).toHaveBeenCalledWith('adherenceTaken', true)
    })

    it('calls onUpdate with false when "missed" tapped', async () => {
      const onUpdate = vi.fn()
      render(
        <TapInput
          metric="adherenceTaken"
          value={null}
          declined={false}
          onUpdate={onUpdate}
          onDecline={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('radio', { name: /missed/i }))
      expect(onUpdate).toHaveBeenCalledWith('adherenceTaken', false)
    })
  })

  describe('flare (three-toggle)', () => {
    it('renders three toggles: not a flare / yes, flaring / still ongoing', () => {
      render(
        <TapInput
          metric="flare"
          value={null}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      expect(
        screen.getByRole('radio', { name: /not a flare/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('radio', { name: /yes, flaring/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('radio', { name: /still ongoing/i }),
      ).toBeInTheDocument()
    })

    it('maps "yes, flaring" tap to onUpdate("flare", "yes")', async () => {
      const onUpdate = vi.fn()
      render(
        <TapInput
          metric="flare"
          value={null}
          declined={false}
          onUpdate={onUpdate}
          onDecline={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('radio', { name: /yes, flaring/i }))
      expect(onUpdate).toHaveBeenCalledWith('flare', 'yes')
    })

    it('maps "still ongoing" to "ongoing"', async () => {
      const onUpdate = vi.fn()
      render(
        <TapInput
          metric="flare"
          value={null}
          declined={false}
          onUpdate={onUpdate}
          onDecline={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('radio', { name: /still ongoing/i }))
      expect(onUpdate).toHaveBeenCalledWith('flare', 'ongoing')
    })

    it('maps "not a flare" to "no"', async () => {
      const onUpdate = vi.fn()
      render(
        <TapInput
          metric="flare"
          value={null}
          declined={false}
          onUpdate={onUpdate}
          onDecline={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('radio', { name: /not a flare/i }))
      expect(onUpdate).toHaveBeenCalledWith('flare', 'no')
    })
  })

  describe('skip-today affordance (US-1.E.4)', () => {
    it('shows a "Skip today" link when not declined', () => {
      render(
        <TapInput
          metric="pain"
          value={null}
          declined={false}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      expect(
        screen.getByRole('button', { name: /skip today/i }),
      ).toBeInTheDocument()
    })

    it('calls onDecline with the metric when skip tapped', async () => {
      const onDecline = vi.fn()
      render(
        <TapInput
          metric="pain"
          value={null}
          declined={false}
          onUpdate={() => {}}
          onDecline={onDecline}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: /skip today/i }))
      expect(onDecline).toHaveBeenCalledWith('pain')
    })

    it('renders "— skipped today" and hides controls when declined', () => {
      render(
        <TapInput
          metric="pain"
          value={null}
          declined={true}
          onUpdate={() => {}}
          onDecline={() => {}}
        />,
      )
      expect(screen.getByText(/— skipped today/)).toBeInTheDocument()
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /skip today/i }),
      ).not.toBeInTheDocument()
    })
  })
})
