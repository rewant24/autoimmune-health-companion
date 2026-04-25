/**
 * POST /api/check-in/extract
 *
 * Server-only Next.js Route Handler. The client (`extractMetrics()` in
 * `lib/checkin/extract-metrics.ts`) posts a transcript here. We:
 *
 *   1. Validate the request body shape.
 *   2. Hit the Convex `extractAttempts:incrementAndCheck` mutation —
 *      this both increments the per-user-per-day counter and tells us
 *      whether the daily cap (5/user/day, ADR-020) has been reached.
 *   3. If capped, return 429 with code `extract.daily_cap_reached`.
 *   4. Otherwise call the Vercel AI SDK `generateObject` with a zod
 *      schema, the system prompt, and a truncated transcript.
 *   5. Return `{ metrics: { pain, mood, adherenceTaken, flare, energy } }`.
 *
 * Why server-only: `AI_GATEWAY_API_KEY` is server-only per ADR-020. The
 * key never reaches the browser.
 *
 * Tests: `tests/check-in/extract-route.test.ts` mocks both `ai` and
 * `convex/browser` (so no network and no real Convex access).
 */
import { NextResponse } from "next/server";
import { generateObject, gateway } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import {
  ExtractedMetricsSchema,
  SYSTEM_PROMPT,
  buildUserMessage,
  truncateTranscript,
  MAX_OUTPUT_TOKENS,
  MAX_TRANSCRIPT_CHARS,
  DEFAULT_MODEL_ID,
  type ExtractedMetrics,
} from "@/lib/checkin/extract-prompt";

export const runtime = "nodejs";

interface RequestBody {
  transcript: string;
  userId: string;
  date: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRequestBody(value: unknown): value is RequestBody {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.transcript === "string" &&
    typeof v.userId === "string" &&
    v.userId.length > 0 &&
    typeof v.date === "string" &&
    DATE_RE.test(v.date as string)
  );
}

/**
 * Build a Convex HTTP client. Pulled out as a module-level helper so the
 * route test can replace it via `vi.mock('convex/browser')`.
 */
function buildConvex(): ConvexHttpClient {
  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
  return new ConvexHttpClient(url);
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "extract.bad_request", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  if (!isRequestBody(raw)) {
    return NextResponse.json(
      {
        error: {
          code: "extract.bad_request",
          message:
            "Body must contain { transcript: string, userId: string, date: 'YYYY-MM-DD' }",
        },
      },
      { status: 400 },
    );
  }

  const body = raw;

  // ---- Cost guard (ADR-020) ----
  let capResult: { count: number; capReached: boolean };
  try {
    const convex = buildConvex();
    capResult = await convex.mutation(anyApi.extractAttempts.incrementAndCheck, {
      userId: body.userId,
      date: body.date,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "extract.cost_guard_failed",
          message: `Cost guard mutation failed: ${(err as Error).message}`,
        },
      },
      { status: 500 },
    );
  }

  if (capResult.capReached) {
    return NextResponse.json(
      {
        error: {
          code: "extract.daily_cap_reached",
          message:
            "Daily extraction attempt cap reached. Tap-controls remain available.",
        },
      },
      { status: 429 },
    );
  }

  // ---- LLM extraction (ADR-020) ----
  // Empty transcript: skip the call entirely and return all-null. Saves a
  // gateway request + token quota for the silent path.
  if (body.transcript.trim().length === 0) {
    const empty: ExtractedMetrics = {
      pain: null,
      mood: null,
      adherenceTaken: null,
      flare: null,
      energy: null,
    };
    return NextResponse.json({ metrics: empty });
  }

  const transcript = truncateTranscript(body.transcript);
  // Sanity: truncation guarantees ≤ MAX_TRANSCRIPT_CHARS + the marker tail.
  if (transcript.length > MAX_TRANSCRIPT_CHARS + 32) {
    return NextResponse.json(
      {
        error: {
          code: "extract.failed",
          message: "Transcript truncation invariant violated",
        },
      },
      { status: 500 },
    );
  }

  let metrics: ExtractedMetrics;
  try {
    const result = await generateObject({
      model: gateway(DEFAULT_MODEL_ID),
      schema: ExtractedMetricsSchema,
      system: SYSTEM_PROMPT,
      prompt: buildUserMessage(body.transcript),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    });
    metrics = result.object as ExtractedMetrics;
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "extract.failed",
          message: `LLM extraction failed: ${(err as Error).message}`,
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ metrics });
}
