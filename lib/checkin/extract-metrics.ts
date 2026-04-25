/**
 * Client-side helper for invoking the metric-extraction route
 * (`POST /api/check-in/extract`).
 *
 * Lives on the client because the page (`app/check-in/page.tsx`) calls
 * `extractMetrics(transcript)` once the user finishes speaking. The
 * route handler (server-only) is what actually talks to the Vercel AI
 * Gateway — keeping the API key off the client per ADR-020.
 *
 * Returns a `Partial<CheckinMetrics>`: each of the five metrics is either
 * a confident value or omitted (when null came back from the model). The
 * page then runs `coverage()` on the result to decide ADR-005 skip-Stage-2
 * vs hybrid Stage-2 path.
 *
 * Errors:
 * - 429 with code `extract.daily_cap_reached` → `ExtractDailyCapError`.
 * - All other failures → `ExtractFailedError` (page falls back to all-missing).
 */
import type { CheckinMetrics, Metric } from "./types";

export interface ExtractMetricsArgs {
  /** Voice transcript to send to the model. May be empty. */
  transcript: string;
  /** Client-trusted user id (per ADR-019). */
  userId: string;
  /** YYYY-MM-DD in the device's local timezone — used by the cost guard. */
  date: string;
  /** Optional override for tests / SSR (defaults to global `fetch`). */
  fetchImpl?: typeof fetch;
  /** Optional override for the route URL (defaults to `/api/check-in/extract`). */
  routeUrl?: string;
}

/** Thrown when the daily extraction cap (ADR-020 cost guard) has been hit. */
export class ExtractDailyCapError extends Error {
  readonly code = "extract.daily_cap_reached" as const;
  constructor(message = "Daily extraction cap reached") {
    super(message);
    this.name = "ExtractDailyCapError";
  }
}

/** Thrown for any other extraction failure (network, malformed JSON, 5xx). */
export class ExtractFailedError extends Error {
  readonly code = "extract.failed" as const;
  constructor(message: string) {
    super(message);
    this.name = "ExtractFailedError";
  }
}

const KNOWN_METRICS: readonly Metric[] = [
  "pain",
  "mood",
  "adherenceTaken",
  "flare",
  "energy",
] as const;

/**
 * Convert the route's full-shape `{pain, mood, ...}` (each value or null)
 * into a `Partial<CheckinMetrics>` where null/undefined keys are omitted.
 * The coverage helper accepts both shapes, but `Partial` keeps downstream
 * call sites cleaner (e.g. spreading into a Convex mutation arg).
 */
function compact(
  full: Record<string, unknown>,
): Partial<CheckinMetrics> {
  const out: Partial<CheckinMetrics> = {};
  for (const metric of KNOWN_METRICS) {
    const v = full[metric];
    if (v === null || v === undefined) continue;
    (out as Record<string, unknown>)[metric] = v;
  }
  return out;
}

export async function extractMetrics(
  args: ExtractMetricsArgs,
): Promise<Partial<CheckinMetrics>> {
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  const url = args.routeUrl ?? "/api/check-in/extract";

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: args.transcript,
        userId: args.userId,
        date: args.date,
      }),
    });
  } catch (err) {
    throw new ExtractFailedError(
      `Network error calling extraction route: ${(err as Error).message}`,
    );
  }

  if (response.status === 429) {
    // Route returns { error: { code: 'extract.daily_cap_reached' } } on cap.
    throw new ExtractDailyCapError();
  }

  if (!response.ok) {
    throw new ExtractFailedError(
      `Extraction route returned ${response.status}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    throw new ExtractFailedError(
      `Extraction route returned non-JSON: ${(err as Error).message}`,
    );
  }

  if (
    body === null ||
    typeof body !== "object" ||
    !("metrics" in body) ||
    typeof (body as { metrics: unknown }).metrics !== "object" ||
    (body as { metrics: unknown }).metrics === null
  ) {
    throw new ExtractFailedError("Extraction route returned malformed body");
  }

  return compact(
    (body as { metrics: Record<string, unknown> }).metrics,
  );
}
