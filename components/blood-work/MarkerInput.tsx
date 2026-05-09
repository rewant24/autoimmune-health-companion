'use client'

/**
 * MarkerInput — single row in the BloodWorkForm marker repeater.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.2.
 *
 * Pure controlled. Renders five inputs (name, value, unit, refRangeLow,
 * refRangeHigh) plus a remove button. The parent owns the array; this
 * component bubbles every keystroke up via `onChange`.
 *
 * Numeric parsing rules (matching 5.A backend):
 *   - `value`, `refRangeLow`, `refRangeHigh` use `Number()`. Empty string =>
 *     null. NaN strings parse as NaN here (UI surfaces inline error); the
 *     parent's submit-disabled guard ignores rows with NaN value/unit.
 *   - refRange validation: when both bounds are present and refRangeLow >
 *     refRangeHigh, surface a row-level inline error.
 */

import { useId } from 'react'

export interface MarkerInputValue {
  name: string
  value: string
  unit: string
  refRangeLow: string
  refRangeHigh: string
}

export const EMPTY_MARKER: MarkerInputValue = {
  name: '',
  value: '',
  unit: '',
  refRangeLow: '',
  refRangeHigh: '',
}

export interface MarkerInputProps {
  marker: MarkerInputValue
  index: number
  onChange: (next: MarkerInputValue) => void
  onRemove: () => void
}

/** Returns null when valid, or a human error string. Exported for tests. */
export function validateMarker(m: MarkerInputValue): string | null {
  if (m.value.trim().length > 0 && Number.isNaN(Number(m.value))) {
    return 'Value must be a number'
  }
  if (m.refRangeLow.trim().length > 0 && Number.isNaN(Number(m.refRangeLow))) {
    return 'Low range must be a number'
  }
  if (m.refRangeHigh.trim().length > 0 && Number.isNaN(Number(m.refRangeHigh))) {
    return 'High range must be a number'
  }
  if (m.refRangeLow.trim().length > 0 && m.refRangeHigh.trim().length > 0) {
    const lo = Number(m.refRangeLow)
    const hi = Number(m.refRangeHigh)
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) {
      return 'Low range must be ≤ high range'
    }
  }
  return null
}

/** True iff name + value + unit are all non-empty AND value is a number. */
export function isMarkerComplete(m: MarkerInputValue): boolean {
  if (m.name.trim().length === 0) return false
  if (m.value.trim().length === 0) return false
  if (m.unit.trim().length === 0) return false
  if (Number.isNaN(Number(m.value))) return false
  return true
}

export function MarkerInput({
  marker,
  index,
  onChange,
  onRemove,
}: MarkerInputProps): React.JSX.Element {
  const formId = useId()
  const error = validateMarker(marker)

  function patch(partial: Partial<MarkerInputValue>): void {
    onChange({ ...marker, ...partial })
  }

  return (
    <div
      data-testid={`marker-row-${index}`}
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        color: 'var(--ink)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 grid gap-3 sm:grid-cols-2">
          <label htmlFor={`${formId}-name`} className="block">
            <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
              Marker
            </span>
            <input
              id={`${formId}-name`}
              type="text"
              value={marker.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. CRP"
              className="mt-1 block w-full rounded-xl border px-3 py-2 text-[15px]"
              style={{
                borderColor: 'var(--rule)',
                background: 'var(--bg-elevated)',
                color: 'var(--ink)',
              }}
            />
          </label>
          <label htmlFor={`${formId}-value`} className="block">
            <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
              Value
            </span>
            <input
              id={`${formId}-value`}
              type="text"
              inputMode="decimal"
              value={marker.value}
              onChange={(e) => patch({ value: e.target.value })}
              placeholder="e.g. 12"
              className="mt-1 block w-full rounded-xl border px-3 py-2 text-[15px]"
              style={{
                borderColor: 'var(--rule)',
                background: 'var(--bg-elevated)',
                color: 'var(--ink)',
              }}
            />
          </label>
          <label htmlFor={`${formId}-unit`} className="block">
            <span className="type-label" style={{ color: 'var(--ink-muted)' }}>
              Unit
            </span>
            <input
              id={`${formId}-unit`}
              type="text"
              value={marker.unit}
              onChange={(e) => patch({ unit: e.target.value })}
              placeholder="e.g. mg/L"
              className="mt-1 block w-full rounded-xl border px-3 py-2 text-[15px]"
              style={{
                borderColor: 'var(--rule)',
                background: 'var(--bg-elevated)',
                color: 'var(--ink)',
              }}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor={`${formId}-low`} className="block">
              <span
                className="type-label"
                style={{ color: 'var(--ink-muted)' }}
              >
                Ref low
              </span>
              <input
                id={`${formId}-low`}
                type="text"
                inputMode="decimal"
                value={marker.refRangeLow}
                onChange={(e) => patch({ refRangeLow: e.target.value })}
                placeholder="optional"
                className="mt-1 block w-full rounded-xl border px-3 py-2 text-[15px]"
                style={{
                  borderColor: 'var(--rule)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--ink)',
                }}
              />
            </label>
            <label htmlFor={`${formId}-high`} className="block">
              <span
                className="type-label"
                style={{ color: 'var(--ink-muted)' }}
              >
                Ref high
              </span>
              <input
                id={`${formId}-high`}
                type="text"
                inputMode="decimal"
                value={marker.refRangeHigh}
                onChange={(e) => patch({ refRangeHigh: e.target.value })}
                placeholder="optional"
                className="mt-1 block w-full rounded-xl border px-3 py-2 text-[15px]"
                style={{
                  borderColor: 'var(--rule)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--ink)',
                }}
              />
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove marker ${marker.name || index + 1}`}
          data-testid={`marker-remove-${index}`}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: 'transparent',
            color: 'var(--ink-muted)',
            border: '1px solid var(--rule)',
          }}
        >
          ×
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          data-testid={`marker-error-${index}`}
          className="mt-2 type-body"
          style={{ color: 'var(--terracotta)' }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
