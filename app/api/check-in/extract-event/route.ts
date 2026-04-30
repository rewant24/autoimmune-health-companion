/**
 * POST /api/check-in/extract-event
 *
 * Server-only Next.js Route Handler. Sibling of
 * `app/api/check-in/extract/route.ts`. The client (`extractEvents()` in
 * `lib/checkin/event-extract.ts`) posts a transcript here. We:
 *
 *   1. Validate the request body shape.
 *   2. Call the Vercel AI SDK `generateObject` with a zod schema, the
 *      system prompt, and a truncated transcript.
 *   3. Return `{ events: { visits, bloodWork } }`.
 *
 * Why no `incrementAndCheck` call here — CRITICAL invariant:
 *   ADR-020 caps the daily extraction COUNT per user, not the number of
 *   route hops. A single check-in fires three sibling extractor routes:
 *     - `app/api/check-in/extract/route.ts`  (metrics)         — increments.
 *     - `app/api/check-in/extract-medication/route.ts` (chunk 4.C) — does NOT increment.
 *     - `app/api/check-in/extract-event/route.ts` (this route)     — does NOT increment.
 *   Any one extraction attempt that triggers all three counts as ONE in
 *   the cost guard. The metrics route is canonical: it is fired first,
 *   handles the cap-reached case, and on 429 the page short-circuits both
 *   sibling routes too. This route simply trusts that the metrics route
 *   has already paid the toll. Tested explicitly in
 *   `tests/check-in/event-extract-route.test.ts`.
 *
 * Why server-only: `AI_GATEWAY_API_KEY` is server-only per ADR-020.
 */
import { NextResponse } from "next/server";
import { generateObject, gateway } from "ai";
import {
  EventExtractionSchema,
  EVENT_SYSTEM_PROMPT,
  buildEventUserMessage,
  truncateEventTranscript,
  EVENT_MAX_OUTPUT_TOKENS,
  EVENT_MAX_TRANSCRIPT_CHARS,
  EVENT_EXTRACT_MODEL_ID,
  type EventExtractionRaw,
} from "@/lib/checkin/event-extract";

export const runtime = "nodejs";

interface RequestBody {
  transcript: string;
  userId: string;
  checkInDate: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRequestBody(value: unknown): value is RequestBody {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.transcript === "string" &&
    typeof v.userId === "string" &&
    v.userId.length > 0 &&
    typeof v.checkInDate === "string" &&
    DATE_RE.test(v.checkInDate as string)
  );
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "extract.bad_request",
          message: "Invalid JSON body",
        },
      },
      { status: 400 },
    );
  }

  if (!isRequestBody(raw)) {
    return NextResponse.json(
      {
        error: {
          code: "extract.bad_request",
          message:
            "Body must contain { transcript: string, userId: string, checkInDate: 'YYYY-MM-DD' }",
        },
      },
      { status: 400 },
    );
  }

  const body = raw;

  // ---- NO COST GUARD HERE ----
  // See module docstring for the ADR-020 single-counter invariant. The
  // metrics route owns the increment for the whole check-in.

  // Empty transcript: skip the call entirely.
  if (body.transcript.trim().length === 0) {
    const empty: EventExtractionRaw = { visits: [], bloodWork: [] };
    return NextResponse.json({ events: empty });
  }

  const transcript = truncateEventTranscript(body.transcript);
  if (transcript.length > EVENT_MAX_TRANSCRIPT_CHARS + 32) {
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

  let events: EventExtractionRaw;
  try {
    const result = await generateObject({
      model: gateway(EVENT_EXTRACT_MODEL_ID),
      schema: EventExtractionSchema,
      system: EVENT_SYSTEM_PROMPT,
      prompt: buildEventUserMessage(body.transcript, body.checkInDate),
      maxOutputTokens: EVENT_MAX_OUTPUT_TOKENS,
      temperature: 0,
    });
    events = result.object as EventExtractionRaw;
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "extract.failed",
          message: `LLM event extraction failed: ${(err as Error).message}`,
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ events });
}
