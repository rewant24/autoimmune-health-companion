/**
 * MarkerInput tests — F05 chunk 5.B, US-5.B.2.
 *
 * Coverage:
 *   - Numeric parse: NaN value surfaces an inline row error.
 *   - Ref-range validation: low > high surfaces an inline row error.
 *   - X removes via `onRemove`.
 *   - `validateMarker` + `isMarkerComplete` predicates behave per spec.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  EMPTY_MARKER,
  MarkerInput,
  isMarkerComplete,
  validateMarker,
  type MarkerInputValue,
} from '@/components/blood-work/MarkerInput'

function noop(): void {
  /* no-op */
}

function row(over: Partial<MarkerInputValue> = {}): MarkerInputValue {
  return { ...EMPTY_MARKER, ...over }
}

describe('validateMarker', () => {
  it('returns null for an empty row', () => {
    expect(validateMarker(EMPTY_MARKER)).toBeNull()
  })

  it('flags non-numeric value', () => {
    expect(validateMarker(row({ value: 'abc' }))).toMatch(/value/i)
  })

  it('flags non-numeric ref range', () => {
    expect(validateMarker(row({ refRangeLow: 'oops' }))).toMatch(/low/i)
    expect(validateMarker(row({ refRangeHigh: 'oops' }))).toMatch(/high/i)
  })

  it('flags low > high', () => {
    expect(
      validateMarker(row({ refRangeLow: '10', refRangeHigh: '5' })),
    ).toMatch(/≤|<=|less than/i)
  })

  it('passes when low ≤ high', () => {
    expect(
      validateMarker(row({ refRangeLow: '0', refRangeHigh: '10' })),
    ).toBeNull()
    expect(
      validateMarker(row({ refRangeLow: '5', refRangeHigh: '5' })),
    ).toBeNull()
  })
})

describe('isMarkerComplete', () => {
  it('requires name + value + unit', () => {
    expect(isMarkerComplete(EMPTY_MARKER)).toBe(false)
    expect(isMarkerComplete(row({ name: 'CRP' }))).toBe(false)
    expect(isMarkerComplete(row({ name: 'CRP', value: '12' }))).toBe(false)
    expect(
      isMarkerComplete(row({ name: 'CRP', value: '12', unit: 'mg/L' })),
    ).toBe(true)
  })

  it('rejects NaN value even when name + unit are present', () => {
    expect(
      isMarkerComplete(row({ name: 'CRP', value: 'abc', unit: 'mg/L' })),
    ).toBe(false)
  })
})

describe('MarkerInput component', () => {
  it('surfaces an inline error for non-numeric value', async () => {
    render(
      <MarkerInput
        marker={row({ name: 'CRP', value: 'abc' })}
        index={0}
        onChange={noop}
        onRemove={noop}
      />,
    )
    expect(screen.getByTestId('marker-error-0')).toHaveTextContent(/value/i)
  })

  it('surfaces an inline error when low > high', () => {
    render(
      <MarkerInput
        marker={row({ refRangeLow: '10', refRangeHigh: '5' })}
        index={1}
        onChange={noop}
        onRemove={noop}
      />,
    )
    expect(screen.getByTestId('marker-error-1')).toBeInTheDocument()
  })

  it('calls onRemove when the X button is tapped', async () => {
    const onRemove = vi.fn()
    render(
      <MarkerInput
        marker={row({ name: 'CRP' })}
        index={2}
        onChange={noop}
        onRemove={onRemove}
      />,
    )
    await userEvent.click(screen.getByTestId('marker-remove-2'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
