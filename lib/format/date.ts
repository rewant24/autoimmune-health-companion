/**
 * IST date/time formatters (W2-3, Lane 1D). Single home for the
 * Asia/Kolkata formatting that was previously copy-pasted across 13 sites
 * (5 local `todayIST()` copies, 3 card date formatters, 2 detail-page long
 * formatters, the DayView header, the memory time formatter).
 *
 * All product dates are IST by product decision — the app's day boundary
 * follows the user's care routine in India. Pure functions, no React.
 */

/** YYYY-MM-DD of *IST today* (not UTC now — during 18:30–23:59 UTC, IST is
 *  already tomorrow; en-CA gives ISO ordering). */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export type ISTDateStyle =
  /** "Tue, 21 Apr 2026" — list/confirm cards. */
  | 'short'
  /** "Tuesday, 21 April 2026" — detail pages. */
  | 'long'
  /** "Tue, 21 Apr" — day headers where the year is context. */
  | 'compact'

/**
 * Format a YYYY-MM-DD date string for display. Returns the input unchanged
 * when it doesn't parse — callers render the raw string rather than crash.
 * en-GB orders day before month per the scoping spec.
 */
export function formatISTDate(date: string, style: ISTDateStyle = 'short'): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const dt = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'compact' ? {} : { year: 'numeric' }),
  }).format(dt)
}

/**
 * Format a UTC ms timestamp as HH:MM in IST. IST is UTC+5:30 with no DST —
 * a fixed offset is correct year-round and avoids Intl.DateTimeFormat
 * surprises across runtimes.
 */
export function formatISTTime(createdAt: number): string {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
  const d = new Date(createdAt + IST_OFFSET_MS)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
