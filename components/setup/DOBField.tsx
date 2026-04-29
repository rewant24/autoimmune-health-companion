'use client'

/**
 * DOBField — two dropdowns (Month / Year) for Setup B.2.
 *
 * 2026-04-29 tweak: field is now OPTIONAL and month/year only (day removed).
 *
 * Validation rules:
 *   - Both null → unassigned, persists as (null, null).
 *   - Year only → valid, persists as (null, year).
 *   - Month + year → valid, persists as (month, year).
 *   - Month without year ("orphan-month") → INVALID. The page surfaces an
 *     inline hint and persists (null, null) on Next; we deliberately keep the
 *     orphan month visible in the dropdown so the user can correct it.
 *
 * Year range: 1925..currentYear inclusive. Both dropdowns start unselected
 * (placeholder hint text).
 */

import { useId, useMemo } from 'react'

export interface DOBValue {
  /** 1..12, null until set. */
  month: number | null
  /** 4-digit year, null until set. */
  year: number | null
}

export const DOB_MIN_YEAR = 1925

export interface DOBFieldProps {
  value: DOBValue
  onChange: (next: DOBValue) => void
}

/** True when month is set but year is not — the only invalid pair. */
export function isOrphanMonth(value: DOBValue): boolean {
  return value.month !== null && value.year === null
}

/**
 * Coerces the in-memory dropdown state into the persistable
 * `{ dobMonth, dobYear }` shape. Orphan-month is silently coerced to
 * (null, null); year-only and full pairs pass through.
 */
export function composeDobMonthYear(value: DOBValue): {
  dobMonth: number | null
  dobYear: number | null
} {
  if (isOrphanMonth(value)) return { dobMonth: null, dobYear: null }
  // Range guard: defensive — UI dropdowns should already be valid.
  const year = value.year
  if (year !== null) {
    const currentYear = new Date().getFullYear()
    if (year < DOB_MIN_YEAR || year > currentYear) {
      return { dobMonth: null, dobYear: null }
    }
  }
  const month = value.month
  if (month !== null && (month < 1 || month > 12)) {
    return { dobMonth: null, dobYear: value.year }
  }
  return { dobMonth: value.month, dobYear: value.year }
}

export function DOBField({
  value,
  onChange,
}: DOBFieldProps): React.JSX.Element {
  const monthId = useId()
  const yearId = useId()
  const hintId = useId()

  const monthNames = useMemo(() => buildMonthNames(), [])
  const yearOptions = useMemo(() => buildYearOptions(), [])
  const showOrphanHint = isOrphanMonth(value)

  return (
    <fieldset
      className="flex flex-col gap-2"
      data-testid="dob-field"
      aria-describedby={showOrphanHint ? hintId : undefined}
    >
      <legend className="type-label text-[var(--ink-muted)]">
        Date of birth{' '}
        <span className="text-[var(--ink-muted)] font-normal">(Optional)</span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={monthId} className="sr-only">
            Month
          </label>
          <select
            id={monthId}
            value={value.month ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                month: e.target.value ? Number(e.target.value) : null,
              })
            }
            data-testid="dob-month"
            className={selectClass}
          >
            <option value="">Month</option>
            {monthNames.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={yearId} className="sr-only">
            Year
          </label>
          <select
            id={yearId}
            value={value.year ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                year: e.target.value ? Number(e.target.value) : null,
              })
            }
            data-testid="dob-year"
            className={selectClass}
          >
            <option value="">Year</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {showOrphanHint ? (
        <p
          id={hintId}
          data-testid="dob-orphan-month-hint"
          className="type-label text-[var(--ink-muted)]"
        >
          Please also select a year, or clear the month.
        </p>
      ) : null}
    </fieldset>
  )
}

const selectClass =
  'h-12 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
  'px-3 text-base text-[var(--ink)] focus:border-[var(--sage-deep)] ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--sage-soft)]'

function buildMonthNames(): string[] {
  // Use `Intl.DateTimeFormat` per scoping. Fallback to English if Intl is
  // missing (vanishingly rare; jsdom supports it).
  try {
    const fmt = new Intl.DateTimeFormat('en', { month: 'long' })
    return Array.from({ length: 12 }, (_, i) =>
      fmt.format(new Date(2000, i, 1)),
    )
  } catch {
    return [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
  }
}

function buildYearOptions(): number[] {
  const currentYear = new Date().getFullYear()
  const out: number[] = []
  // Year dropdown reads top-down, present → past, common pattern.
  for (let y = currentYear; y >= DOB_MIN_YEAR; y--) {
    out.push(y)
  }
  return out
}
