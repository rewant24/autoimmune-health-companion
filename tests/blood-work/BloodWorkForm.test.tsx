/**
 * BloodWorkForm + MarkerInput — chunk 5.B, US-5.B.2.
 *
 * Coverage:
 *   - Renders 4 default markers (CRP/ESR/WBC/Hb) pre-populated with units.
 *   - Submit disabled when no marker is fully filled (per ADR-031, an empty
 *     markers[] is rejected at the schema/server layer; the UI guards the
 *     same).
 *   - Submit enabled once at least one marker has name + value + unit.
 *   - On submit: numerics are coerced; rows missing fields are dropped;
 *     `abnormal` is auto-derived when both ref-range bounds are present.
 *   - MarkerInput surfaces an "outside reference range" hint when value is
 *     outside [low, high].
 *   - "Add another marker" adds a freeform row.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

import {
  BloodWorkForm,
  buildBloodWorkSubmit,
  countCompleteMarkers,
} from '@/components/blood-work/BloodWorkForm'
import {
  MarkerInput,
  markerAbnormal,
  parseFinite,
  type MarkerValue,
} from '@/components/blood-work/MarkerInput'

describe('parseFinite', () => {
  it('parses finite numbers, rejects empty + non-numeric', () => {
    expect(parseFinite('12.5')).toBe(12.5)
    expect(parseFinite('  10  ')).toBe(10)
    expect(parseFinite('')).toBeUndefined()
    expect(parseFinite('   ')).toBeUndefined()
    expect(parseFinite('abc')).toBeUndefined()
  })
})

describe('markerAbnormal', () => {
  it('auto-flags abnormal when value < low or > high (both bounds present)', () => {
    expect(markerAbnormal(12, 0, 5)).toBe(true) // > high
    expect(markerAbnormal(-1, 0, 5)).toBe(true) // < low
    expect(markerAbnormal(3, 0, 5)).toBe(false) // inside
    expect(markerAbnormal(0, 0, 5)).toBe(false) // boundary
    expect(markerAbnormal(5, 0, 5)).toBe(false) // boundary
  })

  it('returns undefined when either bound is missing', () => {
    expect(markerAbnormal(3, undefined, 5)).toBeUndefined()
    expect(markerAbnormal(3, 0, undefined)).toBeUndefined()
    expect(markerAbnormal(3, undefined, undefined)).toBeUndefined()
  })

  it('returns undefined for non-finite inputs', () => {
    expect(markerAbnormal(Number.NaN, 0, 5)).toBeUndefined()
  })
})

describe('countCompleteMarkers', () => {
  it('counts only rows with name + finite value + unit', () => {
    const rows: MarkerValue[] = [
      { key: '1', name: 'CRP', value: '12', unit: 'mg/L', refRangeLow: '', refRangeHigh: '' },
      { key: '2', name: 'ESR', value: '', unit: 'mm/hr', refRangeLow: '', refRangeHigh: '' },
      { key: '3', name: '', value: '5', unit: 'g/dL', refRangeLow: '', refRangeHigh: '' },
      { key: '4', name: 'WBC', value: 'abc', unit: '×10⁹/L', refRangeLow: '', refRangeHigh: '' },
    ]
    expect(countCompleteMarkers(rows)).toBe(1)
  })
})

describe('buildBloodWorkSubmit', () => {
  it('drops incomplete rows, coerces numerics, derives abnormal', () => {
    const rows: MarkerValue[] = [
      {
        key: '1',
        name: 'CRP',
        value: '12.5',
        unit: 'mg/L',
        refRangeLow: '0',
        refRangeHigh: '10',
      },
      {
        key: '2',
        name: 'ESR',
        value: '',
        unit: 'mm/hr',
        refRangeLow: '',
        refRangeHigh: '',
      },
      {
        key: '3',
        name: 'Hb',
        value: '13',
        unit: 'g/dL',
        refRangeLow: '',
        refRangeHigh: '',
      },
    ]
    const out = buildBloodWorkSubmit('2026-04-30', rows, '  fasted  ')
    expect(out.date).toBe('2026-04-30')
    expect(out.markers).toHaveLength(2)
    expect(out.markers[0]).toEqual({
      name: 'CRP',
      value: 12.5,
      unit: 'mg/L',
      refRangeLow: 0,
      refRangeHigh: 10,
      abnormal: true,
    })
    expect(out.markers[1]).toEqual({
      name: 'Hb',
      value: 13,
      unit: 'g/dL',
    })
    expect(out.notes).toBe('fasted')
  })

  it('omits notes when blank after trim', () => {
    const out = buildBloodWorkSubmit(
      '2026-04-30',
      [
        {
          key: '1',
          name: 'CRP',
          value: '5',
          unit: 'mg/L',
          refRangeLow: '',
          refRangeHigh: '',
        },
      ],
      '   ',
    )
    expect(out.notes).toBeUndefined()
  })
})

describe('<BloodWorkForm />', () => {
  it('renders the 4 default markers pre-populated with names + units', () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    const list = screen.getByTestId('blood-work-markers')
    // 4 default rows on first paint
    expect(list.getAttribute('data-marker-count')).toBe('4')
    // Each default name is filled (find by displayValue inside the list scope)
    expect(within(list).getByDisplayValue('CRP')).toBeInTheDocument()
    expect(within(list).getByDisplayValue('ESR')).toBeInTheDocument()
    expect(within(list).getByDisplayValue('WBC')).toBeInTheDocument()
    expect(within(list).getByDisplayValue('Hb')).toBeInTheDocument()
    expect(within(list).getByDisplayValue('mg/L')).toBeInTheDocument()
    expect(within(list).getByDisplayValue('mm/hr')).toBeInTheDocument()
    expect(within(list).getByDisplayValue('g/dL')).toBeInTheDocument()
  })

  it('renders the locked copy', () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('When was the test?')).toBeInTheDocument()
    expect(
      screen.getByText("Common autoimmune markers (remove any you don\u2019t have)"),
    ).toBeInTheDocument()
    expect(screen.getByTestId('blood-work-add-marker')).toHaveTextContent(
      '+ Add another marker',
    )
    expect(screen.getByTestId('blood-work-submit')).toHaveTextContent(
      'Save results',
    )
  })

  it('disables submit until at least one marker has name + value + unit', async () => {
    const onSubmit = vi.fn()
    render(<BloodWorkForm onSubmit={onSubmit} />)
    const submit = screen.getByTestId('blood-work-submit')
    expect(submit).toBeDisabled()
    // Force-submit attempts should also no-op (per ADR-031 no empty markers).
    await act(async () => {
      fireEvent.submit(screen.getByTestId('blood-work-form'))
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('enables submit once any default row is fully filled', () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    // CRP has unit pre-populated, just enter a value.
    const list = screen.getByTestId('blood-work-markers')
    const crpValueInput = within(list).getAllByPlaceholderText('Value')[0]
    fireEvent.change(crpValueInput, { target: { value: '12' } })
    expect(screen.getByTestId('blood-work-submit')).not.toBeDisabled()
  })

  it('appends a freeform marker row on "Add another marker" tap', () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('blood-work-add-marker'))
    const list = screen.getByTestId('blood-work-markers')
    expect(list.getAttribute('data-marker-count')).toBe('5')
  })

  it('lets the user remove a default marker (e.g. user has no Hb result)', () => {
    render(<BloodWorkForm onSubmit={vi.fn()} />)
    const list = screen.getByTestId('blood-work-markers')
    // Find the Hb row by its name input value
    const hbInput = within(list).getByDisplayValue('Hb')
    const hbRow = hbInput.closest('[data-testid^="marker-row-"]')!
    const removeBtn = hbRow.querySelector(
      '[data-testid^="marker-remove-"]',
    ) as HTMLButtonElement
    fireEvent.click(removeBtn)
    expect(list.getAttribute('data-marker-count')).toBe('3')
  })

  it('passes a clean payload to onSubmit (drops empty default rows)', async () => {
    const onSubmit = vi.fn()
    render(
      <BloodWorkForm
        onSubmit={onSubmit}
        initial={{ date: '2026-04-30' }}
      />,
    )
    const list = screen.getByTestId('blood-work-markers')
    const crpValueInput = within(list).getAllByPlaceholderText('Value')[0]
    fireEvent.change(crpValueInput, { target: { value: '12' } })
    await act(async () => {
      fireEvent.submit(screen.getByTestId('blood-work-form'))
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.date).toBe('2026-04-30')
    expect(payload.markers).toEqual([
      { name: 'CRP', value: 12, unit: 'mg/L' },
    ])
  })
})

describe('<MarkerInput /> abnormal hint', () => {
  it('flags abnormal inline when value falls outside the entered range', () => {
    const value: MarkerValue = {
      key: 'm1',
      name: 'CRP',
      value: '12',
      unit: 'mg/L',
      refRangeLow: '0',
      refRangeHigh: '5',
    }
    render(<MarkerInput marker={value} onChange={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByTestId('marker-abnormal-m1')).toHaveTextContent(
      /outside reference range/i,
    )
    expect(screen.getByTestId('marker-row-m1').getAttribute('data-abnormal')).toBe(
      'true',
    )
  })

  it('does not flag abnormal when value is inside range', () => {
    const value: MarkerValue = {
      key: 'm2',
      name: 'CRP',
      value: '3',
      unit: 'mg/L',
      refRangeLow: '0',
      refRangeHigh: '5',
    }
    render(<MarkerInput marker={value} onChange={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.queryByTestId('marker-abnormal-m2')).toBeNull()
  })

  it('does not flag abnormal when only one bound is present', () => {
    const value: MarkerValue = {
      key: 'm3',
      name: 'CRP',
      value: '99',
      unit: 'mg/L',
      refRangeLow: '0',
      refRangeHigh: '',
    }
    render(<MarkerInput marker={value} onChange={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.queryByTestId('marker-abnormal-m3')).toBeNull()
  })
})
