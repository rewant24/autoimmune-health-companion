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
 * - 429 with code `extract.rate_limited` (provider throttling) →
 *   `ExtractRateLimitedError`, carrying Retry-After when the provider
 *   sent one (feedback_server_429_ux).
 * - All other failures → `ExtractFailedError` (page falls back to all-missing).
 */
import { voiceLog } from "@/lib/voice/log";
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

/**
 * Thrown when the model provider (not our cost guard) is rate limiting.
 * Recoverable: retry after the window, or finish with taps. Distinct from
 * the daily cap — that's terminal until tomorrow; this passes in minutes.
 */
export class ExtractRateLimitedError extends Error {
  readonly code = "extract.rate_limited" as const;
  readonly retryAfterSeconds: number | null;
  constructor(retryAfterSeconds: number | null = null) {
    super(
      retryAfterSeconds !== null
        ? `Extraction rate limited; retry after ${retryAfterSeconds}s`
        : "Extraction rate limited",
    );
    this.name = "ExtractRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
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
    // Voice-telemetry completion (2026-07-12): the failure paths below
    // used to be observable only as their downstream UX (Stage 2 bail /
    // honest notice) — the assessment's "telemetry instruments only STT
    // arming" gap. Each throw now emits a `voice_extract_*` event first.
    // Codes + counts only; the transcript never rides along (no PII).
    voiceLog("error", {
      event: "extract_request_failed",
      source: "extractMetrics",
      reason: "network",
    });
    throw new ExtractFailedError(
      `Network error calling extraction route: ${(err as Error).message}`,
    );
  }

  if (response.status === 429) {
    // Two distinct 429s: our daily cap (terminal until tomorrow) vs the
    // provider throttling (passes in minutes). Discriminate on the body
    // code; header Retry-After wins over the body echo when both exist.
    let code: string | undefined;
    let retryAfterSeconds: number | null = null;
    const headerRaw = response.headers.get("Retry-After");
    // Note: Number("") is 0 — only parse when the header actually exists.
    const headerRetry = headerRaw !== null ? Number(headerRaw) : Number.NaN;
    if (Number.isFinite(headerRetry) && headerRetry >= 0) {
      retryAfterSeconds = Math.ceil(headerRetry);
    }
    try {
      const errBody = (await response.json()) as {
        error?: { code?: string; retryAfterSeconds?: number | null };
      };
      code = errBody.error?.code;
      if (
        retryAfterSeconds === null &&
        typeof errBody.error?.retryAfterSeconds === "number"
      ) {
        retryAfterSeconds = errBody.error.retryAfterSeconds;
      }
    } catch {
      // Body unreadable — fall through to code === undefined below.
    }
    if (code === "extract.rate_limited") {
      voiceLog("error", {
        event: "extract_rate_limited",
        source: "extractMetrics",
        ...(retryAfterSeconds !== null ? { retryAfterSeconds } : {}),
      });
      throw new ExtractRateLimitedError(retryAfterSeconds);
    }
    // Default to the cap for the known cap code AND unknown 429 bodies —
    // preserves the pre-W2-2 behavior for old responses. Category is
    // `guard`: the cap is our own ADR-020 cost guard doing its job, not
    // an external failure.
    voiceLog("guard", {
      event: "extract_daily_cap",
      source: "extractMetrics",
    });
    throw new ExtractDailyCapError();
  }

  if (!response.ok) {
    voiceLog("error", {
      event: "extract_request_failed",
      source: "extractMetrics",
      reason: "http",
      status: response.status,
    });
    throw new ExtractFailedError(
      `Extraction route returned ${response.status}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    voiceLog("error", {
      event: "extract_request_failed",
      source: "extractMetrics",
      reason: "malformed",
    });
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
    voiceLog("error", {
      event: "extract_request_failed",
      source: "extractMetrics",
      reason: "malformed",
    });
    throw new ExtractFailedError("Extraction route returned malformed body");
  }

  return compact(
    (body as { metrics: Record<string, unknown> }).metrics,
  );
}
