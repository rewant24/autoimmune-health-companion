/**
 * Feature 05 Cycle 1 — Doctor-visit + blood-work event extractor (chunk 5.C).
 *
 * Detects opportunistic mentions of doctor visits and blood-work in a voice
 * check-in transcript:
 *   - "I saw Dr. Mehta yesterday"
 *   - "follow-up with rheum next Tuesday"
 *   - "got my CRP back, it was 12 mg/L"
 *   - "ESR was 30 last week"
 *
 * Pipeline:
 *   1. Client calls `extractEvents(transcript, checkInDate)`.
 *   2. Helper POSTs to `/api/check-in/extract-event` (sibling to the metric
 *      extractor — they share the same Vercel AI Gateway model and ADR-020
 *      cost ceiling, but a single check-in burns ONE counter increment
 *      total. The metrics route owns the increment; this route does NOT
 *      re-increment. Documented in `app/api/check-in/extract-event/route.ts`.)
 *   3. Helper resolves any relative date phrases ("yesterday", "next
 *      Tuesday", "last week") that the model emitted in `relativeDate`
 *      against `checkInDate` so the final shape carries strict ISO
 *      `YYYY-MM-DD` strings. Date arithmetic stays deterministic — we
 *      don't trust the LLM to do calendar math.
 *   4. Returns `{ visits, bloodWork }` shaped per the route schema with
 *      ISO dates filled in.
 *
 * Decision: the model emits `relativeDate: string | null` AND `date:
 * string | null` per item. We prefer the literal `date` if present and
 * ISO-shaped; otherwise we run the deterministic resolver on
 * `relativeDate` against `checkInDate`; otherwise we fall back to
 * `checkInDate` itself (mention without date defaults to today's check-in).
 */
import { z } from "zod";
import type { VisitType } from "@/lib/memory/event-types";

/**
 * Phrases the deterministic resolver understands. Anything not on this list
 * (or not a clean ISO `YYYY-MM-DD`) falls back to `checkInDate`. This keeps
 * the behaviour predictable + tested — we never hit a mystery date because
 * the model invented `"the day after tomorrow but only sort of"`.
 */
const RELATIVE_DAY_OFFSET: Record<string, number> = {
  today: 0,
  yesterday: -1,
  tomorrow: 1,
  "day before yesterday": -2,
  "day after tomorrow": 2,
  "last week": -7,
  "next week": 7,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- Schemas ---------------------------------------------------------------

/**
 * Visit candidate as emitted by the LLM. The model returns either a clean
 * ISO `date` or a `relativeDate` phrase (anchored against the check-in's
 * date in the system prompt). The client resolves `relativeDate` here so
 * the resolver stays deterministic across runtimes.
 */
export const ExtractedVisitSchema = z.object({
  doctorName: z.string().min(1),
  specialty: z.string().nullable().optional(),
  visitType: z
    .enum(["consultation", "follow-up", "urgent", "other"])
    .default("consultation"),
  date: z.string().nullable().optional(),
  relativeDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const ExtractedBloodWorkMarkerSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  unit: z.string().nullable().optional(),
});

export const ExtractedBloodWorkSchema = z.object({
  markers: z.array(ExtractedBloodWorkMarkerSchema).min(1),
  date: z.string().nullable().optional(),
  relativeDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Top-level shape returned by the route. */
export const EventExtractionSchema = z.object({
  visits: z.array(ExtractedVisitSchema).default([]),
  bloodWork: z.array(ExtractedBloodWorkSchema).default([]),
});

export type ExtractedVisitRaw = z.infer<typeof ExtractedVisitSchema>;
export type ExtractedBloodWorkRaw = z.infer<typeof ExtractedBloodWorkSchema>;
export type EventExtractionRaw = z.infer<typeof EventExtractionSchema>;

/** Resolved (post-date-coercion) visit candidate exposed to the UI. */
export interface ExtractedVisit {
  doctorName: string;
  date: string; // ISO YYYY-MM-DD (always set after resolution)
  specialty?: string;
  visitType: VisitType;
  notes?: string;
}

export interface ExtractedBloodWorkMarker {
  name: string;
  value: number;
  unit: string | null;
}

export interface ExtractedBloodWork {
  date: string; // ISO YYYY-MM-DD
  markers: ExtractedBloodWorkMarker[];
  notes?: string;
}

export interface EventExtractionResult {
  visits: ExtractedVisit[];
  bloodWork: ExtractedBloodWork[];
}

// ---- Errors ---------------------------------------------------------------

/** Thrown when the daily extraction cap (ADR-020 cost guard) has been hit. */
export class EventExtractDailyCapError extends Error {
  readonly code = "extract.daily_cap_reached" as const;
  constructor(message = "Daily extraction cap reached") {
    super(message);
    this.name = "EventExtractDailyCapError";
  }
}

/** Thrown for any other extraction failure. */
export class EventExtractFailedError extends Error {
  readonly code = "extract.failed" as const;
  constructor(message: string) {
    super(message);
    this.name = "EventExtractFailedError";
  }
}

// ---- Date resolver -------------------------------------------------------

/**
 * Add `days` to a YYYY-MM-DD anchor and return YYYY-MM-DD. Pure UTC
 * arithmetic — the anchor date carries no time, so timezone offsets are
 * irrelevant. Exposed for tests.
 */
export function addDaysToIsoDate(anchor: string, days: number): string {
  if (!ISO_DATE_RE.test(anchor)) {
    throw new Error(`addDaysToIsoDate: anchor must be YYYY-MM-DD, got ${anchor}`);
  }
  const [y, m, d] = anchor.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Resolve a relative date phrase against a YYYY-MM-DD anchor. Returns
 * `null` if the phrase is not recognised. Recognised forms:
 *   - "today", "yesterday", "tomorrow"
 *   - "day before yesterday", "day after tomorrow"
 *   - "last week", "next week"
 *   - "next <weekday>", "last <weekday>", "this <weekday>"
 *   - "<weekday>" alone — interpreted as the *next* occurrence (>= anchor + 1)
 *
 * Anything else returns `null`. The caller falls back to `checkInDate`
 * when this happens.
 */
export function resolveRelativeDate(
  phrase: string,
  anchor: string,
): string | null {
  const norm = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm.length === 0) return null;

  // Direct keyword match.
  if (norm in RELATIVE_DAY_OFFSET) {
    return addDaysToIsoDate(anchor, RELATIVE_DAY_OFFSET[norm]);
  }

  // "next <weekday>" → first occurrence strictly after anchor.
  // "last <weekday>" → most recent occurrence strictly before anchor.
  // "this <weekday>" → upcoming occurrence including today.
  const directionMatch = norm.match(/^(next|last|this)\s+(\w+)$/);
  if (directionMatch) {
    const direction = directionMatch[1];
    const weekday = directionMatch[2];
    if (!(weekday in WEEKDAYS)) return null;
    const target = WEEKDAYS[weekday];
    const [y, m, d] = anchor.split("-").map(Number);
    const anchorDt = new Date(Date.UTC(y, m - 1, d));
    const anchorDay = anchorDt.getUTCDay();
    let offset: number;
    if (direction === "next") {
      offset = (target - anchorDay + 7) % 7;
      if (offset === 0) offset = 7;
    } else if (direction === "last") {
      offset = -((anchorDay - target + 7) % 7);
      if (offset === 0) offset = -7;
    } else {
      // "this <weekday>"
      offset = (target - anchorDay + 7) % 7;
    }
    return addDaysToIsoDate(anchor, offset);
  }

  // Bare weekday → treat as "next <weekday>".
  if (norm in WEEKDAYS) {
    return resolveRelativeDate(`next ${norm}`, anchor);
  }

  return null;
}

/**
 * Resolve the date for a single extracted item. Preference order:
 *   1. `date` field if it's a valid ISO YYYY-MM-DD.
 *   2. `relativeDate` phrase resolved against `checkInDate`.
 *   3. `checkInDate` (mention without date defaults to today).
 */
export function resolveItemDate(
  item: { date?: string | null; relativeDate?: string | null },
  checkInDate: string,
): string {
  if (item.date && ISO_DATE_RE.test(item.date)) {
    return item.date;
  }
  if (item.relativeDate) {
    const resolved = resolveRelativeDate(item.relativeDate, checkInDate);
    if (resolved) return resolved;
  }
  return checkInDate;
}

/**
 * Coerce the raw LLM output into the resolved shape used by the UI. Pure.
 * Exposed for tests so we can drive resolution without a network round trip.
 */
export function resolveExtraction(
  raw: EventExtractionRaw,
  checkInDate: string,
): EventExtractionResult {
  const visits: ExtractedVisit[] = raw.visits.map((v) => {
    const out: ExtractedVisit = {
      doctorName: v.doctorName.trim(),
      date: resolveItemDate(v, checkInDate),
      visitType: v.visitType ?? "consultation",
    };
    if (v.specialty && v.specialty.trim().length > 0) {
      out.specialty = v.specialty.trim();
    }
    if (v.notes && v.notes.trim().length > 0) {
      out.notes = v.notes.trim();
    }
    return out;
  });

  const bloodWork: ExtractedBloodWork[] = raw.bloodWork.map((bw) => {
    const out: ExtractedBloodWork = {
      date: resolveItemDate(bw, checkInDate),
      markers: bw.markers.map((m) => ({
        name: m.name.trim(),
        value: m.value,
        unit:
          m.unit && m.unit.trim().length > 0 ? m.unit.trim() : null,
      })),
    };
    if (bw.notes && bw.notes.trim().length > 0) {
      out.notes = bw.notes.trim();
    }
    return out;
  });

  return { visits, bloodWork };
}

// ---- System prompt --------------------------------------------------------

/** Vercel AI Gateway model id (ADR-020). Kept in sync with metrics route. */
export const EVENT_EXTRACT_MODEL_ID = "openai/gpt-4o-mini";

/** `maxOutputTokens` cap. Visit + blood-work payloads are bounded. */
export const EVENT_MAX_OUTPUT_TOKENS = 400;

/** Maximum input chars sent to the LLM (matches metrics route). */
export const EVENT_MAX_TRANSCRIPT_CHARS = 5400;

export function truncateEventTranscript(text: string): string {
  if (text.length <= EVENT_MAX_TRANSCRIPT_CHARS) return text;
  return text.slice(0, EVENT_MAX_TRANSCRIPT_CHARS) + "\n[...truncated]";
}

/**
 * System prompt for the event extractor. Locked verbatim — review-friendly.
 */
export const EVENT_SYSTEM_PROMPT = `You are an extraction layer for a daily voice check-in in an autoimmune-health companion app. Your only job is to detect mentions of two event types from the user's transcript: doctor visits and blood-work results. The user often blends these mentions into a free-form day recap.

Output schema (JSON only — no markdown, no commentary):
{
  "visits": [
    {
      "doctorName": string,
      "specialty": string | null,
      "visitType": "consultation" | "follow-up" | "urgent" | "other",
      "date": string | null,        // strict ISO YYYY-MM-DD, only if the user gave a literal calendar date
      "relativeDate": string | null,// e.g. "yesterday", "next Tuesday", "last week"
      "notes": string | null
    }
  ],
  "bloodWork": [
    {
      "markers": [{ "name": string, "value": number, "unit": string | null }],
      "date": string | null,
      "relativeDate": string | null,
      "notes": string | null
    }
  ]
}

Rules:
1. ONLY emit items the user actually mentioned. If no visits, return "visits": []. If no blood work, return "bloodWork": [].
2. For dates, prefer "relativeDate" with a phrase ("yesterday", "next Tuesday", "last week"). Set "date" only when the user said a literal calendar date. Do not invent dates.
3. visitType inference: "follow-up" / "follow up" / "review" → "follow-up". "urgent" / "emergency" / "ER" → "urgent". Otherwise default to "consultation".
4. Specialty: include if explicit ("rheumatologist", "rheum", "GP", "dermatologist"); else null.
5. For markers, use the user's words ("CRP", "ESR", "WBC", "haemoglobin"). Common units: CRP → mg/L, ESR → mm/hr, WBC → ×10⁹/L, Hb → g/dL. If the user did not name a unit AND you are not confident, return unit: null.
6. Group multiple markers from the same blood-work mention into ONE item under "markers".
7. Strict JSON only. No prose.`;

export function buildEventUserMessage(
  transcript: string,
  checkInDate: string,
): string {
  return `Today's check-in date: ${checkInDate}\n\nTranscript:\n"""\n${truncateEventTranscript(transcript)}\n"""\n\nReturn the extracted events now.`;
}

// ---- Client helper --------------------------------------------------------

export interface ExtractEventsArgs {
  /** Voice transcript to send to the model. */
  transcript: string;
  /** YYYY-MM-DD anchor for relative-date resolution AND the date arg the
   *  route forwards to the cost guard (the metrics route owns the
   *  per-check-in counter increment, so this is just a passthrough — the
   *  route does NOT increment again). */
  checkInDate: string;
  /** Client-trusted user id (per ADR-019). */
  userId: string;
  /** Optional override for tests / SSR (defaults to global `fetch`). */
  fetchImpl?: typeof fetch;
  /** Optional override for the route URL. */
  routeUrl?: string;
}

/**
 * Client-side helper. Returns a fully-resolved `{ visits, bloodWork }`
 * shape with ISO dates. Throws `EventExtractDailyCapError` on 429 and
 * `EventExtractFailedError` on any other failure.
 */
export async function extractEvents(
  args: ExtractEventsArgs,
): Promise<EventExtractionResult> {
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  const url = args.routeUrl ?? "/api/check-in/extract-event";

  // Empty transcript: skip the round trip entirely.
  if (args.transcript.trim().length === 0) {
    return { visits: [], bloodWork: [] };
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: args.transcript,
        userId: args.userId,
        checkInDate: args.checkInDate,
      }),
    });
  } catch (err) {
    throw new EventExtractFailedError(
      `Network error calling event extraction route: ${(err as Error).message}`,
    );
  }

  if (response.status === 429) {
    throw new EventExtractDailyCapError();
  }

  if (!response.ok) {
    throw new EventExtractFailedError(
      `Event extraction route returned ${response.status}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    throw new EventExtractFailedError(
      `Event extraction route returned non-JSON: ${(err as Error).message}`,
    );
  }

  if (
    body === null ||
    typeof body !== "object" ||
    !("events" in body) ||
    typeof (body as { events: unknown }).events !== "object" ||
    (body as { events: unknown }).events === null
  ) {
    throw new EventExtractFailedError(
      "Event extraction route returned malformed body",
    );
  }

  const parsed = EventExtractionSchema.safeParse(
    (body as { events: unknown }).events,
  );
  if (!parsed.success) {
    throw new EventExtractFailedError(
      `Event extraction route returned malformed events: ${parsed.error.message}`,
    );
  }

  return resolveExtraction(parsed.data, args.checkInDate);
}
