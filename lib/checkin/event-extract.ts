/**
 * Feature 05 Cycle 1 — Doctor-visit + blood-work event extractor.
 *
 * Owned by chunk 5.C.
 *
 * Responsibilities:
 *   - Detect doctor-visit mentions ("I saw Dr. Mehta yesterday", "follow-up
 *     with rheum next Tuesday"). Extract: doctor name, date (resolved against
 *     the check-in's `date` for relative phrases), specialty (if stated),
 *     visitType (consultation / follow-up / urgent / other — inferred from
 *     cues like "follow-up" or "urgent appointment").
 *   - Detect blood-work mentions ("got my CRP back, it was 12 mg/L"). Extract
 *     marker name, value, unit (or null when uncertain), date if specified.
 *
 * Cost-guard invariant (ADR-020):
 *   The metric extractor (`/api/check-in/extract`) increments the daily cap
 *   ONCE per check-in. The event extractor must NOT double-increment. The
 *   route handler reflects this by skipping `incrementAndCheck` entirely;
 *   see `app/api/check-in/extract-event/route.ts`.
 *
 * All optional fields use `.nullable()` not `.optional()` — OpenAI structured
 * outputs require every property to appear in `required`. `.optional()` was
 * the F04 PR #19 root cause (502s in prod).
 */
import { z } from 'zod'

// ---- Visit-type enum --------------------------------------------------------

export const VISIT_TYPES = ['consultation', 'follow-up', 'urgent', 'other'] as const
export type VisitType = (typeof VISIT_TYPES)[number]

// ---- Zod schema -------------------------------------------------------------

/**
 * Each extracted visit. `date` is YYYY-MM-DD — the model is instructed to
 * resolve relative phrases against the supplied check-in date so the output
 * is deterministic.
 */
export const VisitCandidateSchema = z.object({
  doctorName: z.string(),
  date: z.string(),
  specialty: z.string().nullable(),
  visitType: z.enum(VISIT_TYPES),
  notes: z.string().nullable(),
})
export type VisitCandidate = z.infer<typeof VisitCandidateSchema>

/**
 * One marker inside a blood-work mention. `unit` may be `null` — if the
 * user didn't say a unit and one can't be inferred, the confirm card
 * surfaces a unit picker.
 */
export const BloodWorkMarkerSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string().nullable(),
})
export type BloodWorkMarker = z.infer<typeof BloodWorkMarkerSchema>

export const BloodWorkCandidateSchema = z.object({
  date: z.string(),
  markers: z.array(BloodWorkMarkerSchema),
  notes: z.string().nullable(),
})
export type BloodWorkCandidate = z.infer<typeof BloodWorkCandidateSchema>

export const EventExtractionSchema = z.object({
  visits: z.array(VisitCandidateSchema),
  bloodWork: z.array(BloodWorkCandidateSchema),
})
export type ExtractedEventResult = z.infer<typeof EventExtractionSchema>

export const EMPTY_EVENT_EXTRACTION: ExtractedEventResult = {
  visits: [],
  bloodWork: [],
}

// ---- Date-anchor resolver ---------------------------------------------------

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/**
 * Resolve a relative or literal date phrase against `checkInDate` (YYYY-MM-DD).
 * Returns YYYY-MM-DD. Pure — does NOT call `Date.now()`. Unknown phrases
 * fall back to `checkInDate` itself so the confirm card can still render.
 *
 * Recognised phrases (case-insensitive):
 *   - "today"                → checkInDate
 *   - "yesterday"            → checkInDate − 1d
 *   - "tomorrow"             → checkInDate + 1d
 *   - "<weekday>"            → next/this <weekday> (treated as the next
 *                              occurrence ON or AFTER checkInDate)
 *   - "next <weekday>"       → first <weekday> strictly AFTER checkInDate
 *   - "last <weekday>"       → first <weekday> strictly BEFORE checkInDate
 *   - "YYYY-MM-DD"           → returned as-is when valid
 */
export function resolveRelativeDate(phrase: string, checkInDate: string): string {
  const trimmed = phrase.trim().toLowerCase()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const anchor = parseIsoDateUTC(checkInDate)
  if (anchor === null) return checkInDate

  if (trimmed === 'today') return checkInDate
  if (trimmed === 'yesterday') return shiftDays(anchor, -1)
  if (trimmed === 'tomorrow') return shiftDays(anchor, 1)

  const nextMatch = trimmed.match(/^next\s+(\w+)$/)
  if (nextMatch !== null && nextMatch[1] !== undefined) {
    const targetDay = DAY_NAMES[nextMatch[1]]
    if (targetDay !== undefined) {
      return forwardToDay(anchor, targetDay, /* strictlyAfter */ true)
    }
  }

  const lastMatch = trimmed.match(/^last\s+(\w+)$/)
  if (lastMatch !== null && lastMatch[1] !== undefined) {
    const targetDay = DAY_NAMES[lastMatch[1]]
    if (targetDay !== undefined) {
      return backwardToDay(anchor, targetDay)
    }
  }

  const bareDay = DAY_NAMES[trimmed]
  if (bareDay !== undefined) {
    return forwardToDay(anchor, bareDay, /* strictlyAfter */ false)
  }

  // Unknown phrase — fall back to the check-in date itself.
  return checkInDate
}

function parseIsoDateUTC(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m === null) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return new Date(Date.UTC(y, mo - 1, d))
}

function formatIsoDateUTC(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function shiftDays(anchor: Date, offset: number): string {
  const d = new Date(anchor.getTime())
  d.setUTCDate(d.getUTCDate() + offset)
  return formatIsoDateUTC(d)
}

function forwardToDay(anchor: Date, targetDay: number, strictlyAfter: boolean): string {
  const cur = anchor.getUTCDay()
  let diff = (targetDay - cur + 7) % 7
  if (diff === 0 && strictlyAfter) diff = 7
  return shiftDays(anchor, diff)
}

function backwardToDay(anchor: Date, targetDay: number): string {
  const cur = anchor.getUTCDay()
  let diff = (cur - targetDay + 7) % 7
  if (diff === 0) diff = 7
  return shiftDays(anchor, -diff)
}

// ---- System prompt ----------------------------------------------------------

export function buildSystemPrompt(checkInDate: string): string {
  return `You are an extraction layer for a daily voice check-in in an autoimmune-health companion app. Your only job is to extract two kinds of events from the transcript: doctor visits and blood-work results.

The check-in was logged on ${checkInDate} (YYYY-MM-DD). Resolve relative phrases ("yesterday", "today", "next Tuesday", "last Friday") against this anchor and return YYYY-MM-DD strings only.

Output schema:
- visits: array of { doctorName, date, specialty, visitType, notes }.
  - doctorName: as the user said ("Dr. Mehta", "my rheumatologist"). Required.
  - date: YYYY-MM-DD, resolved against ${checkInDate}.
  - specialty: free-form ("rheumatologist", "GP") or null when not stated.
  - visitType: one of consultation | follow-up | urgent | other. Default to "consultation" when unclear; pick "follow-up" when the user says "follow-up" or "checkup", "urgent" for ER / urgent-care language.
  - notes: brief free-form recap if the user mentioned anything memorable, else null.
- bloodWork: array of { date, markers, notes }.
  - date: YYYY-MM-DD, resolved against ${checkInDate}. Default to ${checkInDate} when not stated.
  - markers: array of { name, value, unit }. ALL markers the user referenced for one blood-work event share a single entry. Multi-marker mentions group into ONE entry.
    - name: the marker as spoken ("CRP", "ESR", "WBC", "hemoglobin").
    - value: the numeric value the user said. Required.
    - unit: the unit if the user said one ("mg/L", "mm/hr", "g/dL"). When the user didn't say a unit, return null — the UI will surface a picker.
  - notes: brief free-form recap if the user mentioned context, else null.

Rules:
1. Both arrays default to []. Silence about visits / blood work → empty arrays.
2. Do not invent visits, doctors, markers, or values that the user did not say.
3. Multi-marker mentions ("CRP was 12, ESR was 30") group into ONE bloodWork entry with two markers.
4. Resolve relative phrases deterministically against ${checkInDate}. Do not use the current date.
5. Return strictly the JSON object matching the schema. No commentary, no markdown.`
}

export function buildUserMessage(transcript: string): string {
  return `Transcript:\n"""\n${transcript}\n"""\n\nReturn the extracted events now.`
}

// ---- Client helper ----------------------------------------------------------

export interface ExtractEventsArgs {
  transcript: string
  userId: string
  /** YYYY-MM-DD in the device's local timezone. Used as the date anchor. */
  checkInDate: string
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
  /** Test seam — defaults to `/api/check-in/extract-event`. */
  routeUrl?: string
}

export class EventExtractFailedError extends Error {
  readonly code = 'event-extract.failed' as const
  constructor(message: string) {
    super(message)
    this.name = 'EventExtractFailedError'
  }
}

/**
 * POST the transcript to the event extraction route. Returns the structured
 * `{ visits, bloodWork }` result. Empty transcript short-circuits without
 * calling fetch — there's nothing to extract from silence.
 *
 * The caller renders one confirm card per visit / blood-work entry; cards
 * that fail to extract collapse to `EMPTY_EVENT_EXTRACTION` upstream so the
 * check-in summary stays usable.
 */
export async function extractEvents(
  args: ExtractEventsArgs,
): Promise<ExtractedEventResult> {
  const fetchImpl = args.fetchImpl ?? globalThis.fetch
  const url = args.routeUrl ?? '/api/check-in/extract-event'

  if (args.transcript.trim().length === 0) return EMPTY_EVENT_EXTRACTION

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: args.transcript,
        userId: args.userId,
        checkInDate: args.checkInDate,
      }),
    })
  } catch (err) {
    throw new EventExtractFailedError(
      `Network error calling event-extract route: ${(err as Error).message}`,
    )
  }

  if (!response.ok) {
    throw new EventExtractFailedError(
      `Event-extract route returned ${response.status}`,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (err) {
    throw new EventExtractFailedError(
      `Event-extract route returned non-JSON: ${(err as Error).message}`,
    )
  }

  const parsed = EventExtractionSchema.safeParse(
    (body as { result?: unknown })?.result,
  )
  if (!parsed.success) {
    throw new EventExtractFailedError(
      `Event-extract route returned malformed body: ${parsed.error.message}`,
    )
  }
  return parsed.data
}
