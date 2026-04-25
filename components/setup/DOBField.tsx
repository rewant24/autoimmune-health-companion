'use client'

/**
 * DOBField — three dropdowns (Month / Day / Year) for Setup B.2.
 *
 * Onboarding Shell cycle, Build-B (Chunk B).
 *
 * - Year defaults to 1990 (sensible decade per cycle plan Q3); range
 *   1925..currentYear inclusive.
 * - Month names rendered via `Intl.DateTimeFormat`.
 * - Validation: requires all three; future date → invalid; pre-1925 →
 *   invalid; Feb 29 in non-leap year → invalid (calendar overflow check).
 */

import { useId, useMemo } from 'react'

export interface DOBValue {
  /** 1..12, null until set. */
  month: number | null
  /** 1..31, null until set. */
  day: number | null
  /** 4-digit year, null until set. */
  year: number | null
}

export const DOB_DEFAULT_YEAR = 1990
export const DOB_MIN_YEAR = 1925

export interface DOBFieldProps {
  value: DOBValue
  onChange: (next: DOBValue) => void
}

export function DOBField({
  value,
  onChange,
}: DOBFieldProps): React.JSX.Element {
  const monthId = useId()
  const dayId = useId()
  const yearId = useId()

  const monthNames = useMemo(() => buildMonthNames(), [])
  const yearOptions = useMemo(() => buildYearOptions(), [])

  return (
    <fieldset
      className="flex flex-col gap-2"
      data-testid="dob-field"
    >
      <legend className="type-label text-[var(--ink-muted)]">
        Date of birth
      </legend>
      <div className="grid grid-cols-3 gap-2">
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
          <label htmlFor={dayId} className="sr-only">
            Day
          </label>
          <select
            id={dayId}
            value={value.day ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                day: e.target.value ? Number(e.target.value) : null,
              })
            }
            data-testid="dob-day"
            className={selectClass}
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
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

/**
 * Composes a YYYY-MM-DD ISO date string from the three dropdown values, or
 * returns null when the date is invalid or incomplete.
 *
 * Rules:
 *   - All three values must be present.
 *   - Year ∈ [DOB_MIN_YEAR, currentYear].
 *   - The composed Date must round-trip (rejects Feb 30, Feb 29 in
 *     non-leap year, etc.).
 *   - The composed date must NOT be in the future
 *     (date-only comparison; today counts as valid).
 */
export function composeDobIso(value: DOBValue): string | null {
  const { month, day, year } = value
  if (month === null || day === null || year === null) return null
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null
  }
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const currentYear = new Date().getFullYear()
  if (year < DOB_MIN_YEAR || year > currentYear) return null

  const candidate = new Date(year, month - 1, day)
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null
  }

  // Future-date check — compare YMD only so "today" stays valid even if the
  // user's local clock is past midnight UTC.
  const today = new Date()
  const todayYmd = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const candYmd = year * 10000 + month * 100 + day
  if (candYmd > todayYmd) return null

  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function isValidDob(value: DOBValue): boolean {
  return composeDobIso(value) !== null
}
