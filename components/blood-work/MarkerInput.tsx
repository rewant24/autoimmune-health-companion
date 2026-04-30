'use client'

/**
 * MarkerInput — single marker row for the BloodWorkForm repeater.
 *
 * Feature 05 Cycle 1, Chunk 5.B, US-5.B.2.
 *
 * Fields: name, value (number), unit, optional refRangeLow + refRangeHigh.
 * When both range bounds are filled and `value` falls outside, `abnormal`
 * is auto-derived and surfaced (the page reads the same `markerAbnormal`
 * helper on submit so the persisted row carries the same flag).
 */

import { useId } from 'react'

export interface MarkerValue {
  /** Stable key for React reconciliation; carried only in the form state. */
  key: string
  name: string
  /** Raw string from the input — coerced to number on submit. */
  value: string
  unit: string
  refRangeLow: string
  refRangeHigh: string
}

export interface MarkerInputProps {
  marker: MarkerValue
  onChange: (next: MarkerValue) => void
  onRemove: () => void
  /** Whether this row is removable (default true). */
  removable?: boolean
}

/**
 * Pure helper — returns true when a finite value falls outside both
 * finite bounds. Used both inline (for the visual hint) and on submit
 * (so the persisted `abnormal` matches what the user saw). Returns
 * `undefined` when bounds aren't both present, mirroring schema posture.
 */
export function markerAbnormal(
  value: number,
  refRangeLow: number | undefined,
  refRangeHigh: number | undefined,
): boolean | undefined {
  if (refRangeLow === undefined || refRangeHigh === undefined) return undefined
  if (!Number.isFinite(refRangeLow) || !Number.isFinite(refRangeHigh)) {
    return undefined
  }
  if (!Number.isFinite(value)) return undefined
  return value < refRangeLow || value > refRangeHigh
}

/**
 * Coerce a raw input string to a finite number, or undefined if not parseable.
 * Empty / whitespace → undefined (so the form treats "blank" as no value).
 */
export function parseFinite(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return undefined
  return n
}

export function MarkerInput({
  marker,
  onChange,
  onRemove,
  removable = true,
}: MarkerInputProps): React.JSX.Element {
  const nameId = useId()
  const valueId = useId()
  const unitId = useId()
  const lowId = useId()
  const highId = useId()

  const valueNum = parseFinite(marker.value)
  const lowNum = parseFinite(marker.refRangeLow)
  const highNum = parseFinite(marker.refRangeHigh)
  const abnormal =
    valueNum === undefined ? undefined : markerAbnormal(valueNum, lowNum, highNum)

  const set = (patch: Partial<MarkerValue>) => onChange({ ...marker, ...patch })

  const inputClasses =
    'h-10 w-full rounded-md border border-[var(--rule)] bg-[var(--bg-card)] ' +
    'px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-subtle)] ' +
    'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-1 ' +
    'focus:ring-[var(--sage-soft)]'

  return (
    <div
      data-testid={`marker-row-${marker.key}`}
      data-abnormal={abnormal === true ? 'true' : 'false'}
      className="rounded-xl border p-3"
      style={{
        borderColor:
          abnormal === true ? 'rgba(220, 38, 38, 0.45)' : 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <div className="flex items-center gap-2">
        <label htmlFor={nameId} className="sr-only">
          Marker name
        </label>
        <input
          id={nameId}
          type="text"
          value={marker.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Marker (e.g. CRP)"
          data-testid={`marker-name-${marker.key}`}
          className={inputClasses + ' flex-1'}
        />
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${marker.name || 'marker'}`}
            data-testid={`marker-remove-${marker.key}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
          >
            <span aria-hidden="true" className="text-base leading-none">
              ×
            </span>
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={valueId} className="sr-only">
            Value
          </label>
          <input
            id={valueId}
            type="number"
            inputMode="decimal"
            step="any"
            value={marker.value}
            onChange={(e) => set({ value: e.target.value })}
            placeholder="Value"
            data-testid={`marker-value-${marker.key}`}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={unitId} className="sr-only">
            Unit
          </label>
          <input
            id={unitId}
            type="text"
            value={marker.unit}
            onChange={(e) => set({ unit: e.target.value })}
            placeholder="Unit"
            data-testid={`marker-unit-${marker.key}`}
            className={inputClasses}
          />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={lowId}
            className="text-[11px] uppercase tracking-wide text-[var(--ink-subtle)]"
          >
            Ref range low
          </label>
          <input
            id={lowId}
            type="number"
            inputMode="decimal"
            step="any"
            value={marker.refRangeLow}
            onChange={(e) => set({ refRangeLow: e.target.value })}
            placeholder="Optional"
            data-testid={`marker-low-${marker.key}`}
            className={inputClasses}
          />
        </div>
        <div>
          <label
            htmlFor={highId}
            className="text-[11px] uppercase tracking-wide text-[var(--ink-subtle)]"
          >
            Ref range high
          </label>
          <input
            id={highId}
            type="number"
            inputMode="decimal"
            step="any"
            value={marker.refRangeHigh}
            onChange={(e) => set({ refRangeHigh: e.target.value })}
            placeholder="Optional"
            data-testid={`marker-high-${marker.key}`}
            className={inputClasses}
          />
        </div>
      </div>
      {abnormal === true && (
        <p
          role="status"
          data-testid={`marker-abnormal-${marker.key}`}
          className="mt-2 text-xs"
          style={{ color: 'rgb(153, 27, 27)' }}
        >
          Outside reference range.
        </p>
      )}
    </div>
  )
}
