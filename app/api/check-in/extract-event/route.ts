/**
 * POST /api/check-in/extract-event
 *
 * Server-only Next.js Route Handler. The client (`extractEvents()` in
 * `lib/checkin/event-extract.ts`) posts a transcript here AFTER the metric
 * extractor has already run for the same check-in.
 *
 * Cost-guard invariant (ADR-020) — IMPORTANT:
 *   The metric extract route (`/api/check-in/extract`) increments the
 *   `extractAttempts` counter exactly ONCE per check-in. This route does
 *   NOT increment the counter — calling `incrementAndCheck` here would
 *   burn additional attempts per check-in (one per extractor that runs)
 *   and shrink the daily cap proportionally. The check-in flow enforces
 *   ordering: event extraction is invoked only after metric extraction
 *   returns a non-429 response.
 *
 *   If a future caller invokes this route in isolation (without first
 *   hitting `/api/check-in/extract`), they get a "free" LLM call. That's
 *   acceptable for the MVP because the only caller is the check-in
 *   summary flow; a stricter cap can be layered in a Cycle 2 follow-up
 *   if the surface broadens.
 *
 * Why server-only: `AI_GATEWAY_API_KEY` is server-only per ADR-020. The
 * key never reaches the browser.
 *
 * Tests: `tests/check-in/event-extract.test.ts` mocks `ai` directly (no
 * network, no real Convex access).
 */
import { NextResponse } from 'next/server'
import { generateObject, gateway } from 'ai'
import {
  EventExtractionSchema,
  buildSystemPrompt,
  buildUserMessage,
} from '@/lib/checkin/event-extract'
import { getExtractModelId } from '@/lib/checkin/model-config'

export const runtime = 'nodejs'

const MAX_TRANSCRIPT_CHARS = 5400
const MAX_OUTPUT_TOKENS = 500 // arrays of objects with arrays of objects
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface RequestBody {
  transcript: string
  userId: string
  checkInDate: string
}

function isRequestBody(value: unknown): value is RequestBody {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.transcript === 'string' &&
    typeof v.userId === 'string' &&
    v.userId.length > 0 &&
    typeof v.checkInDate === 'string' &&
    DATE_RE.test(v.checkInDate as string)
  )
}

function truncateTranscript(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text
  return text.slice(0, MAX_TRANSCRIPT_CHARS) + '\n[...truncated]'
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'event-extract.bad_request',
          message: 'Invalid JSON body',
        },
      },
      { status: 400 },
    )
  }

  if (!isRequestBody(raw)) {
    return NextResponse.json(
      {
        error: {
          code: 'event-extract.bad_request',
          message:
            "Body must contain { transcript: string, userId: string, checkInDate: 'YYYY-MM-DD' }",
        },
      },
      { status: 400 },
    )
  }

  const body = raw

  // Empty transcript: skip the LLM call entirely. No cost, no risk.
  if (body.transcript.trim().length === 0) {
    return NextResponse.json({
      result: { visits: [], bloodWork: [] },
    })
  }

  const transcript = truncateTranscript(body.transcript)

  try {
    const result = await generateObject({
      model: gateway(getExtractModelId()),
      schema: EventExtractionSchema,
      system: buildSystemPrompt(body.checkInDate),
      prompt: buildUserMessage(transcript),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    })
    return NextResponse.json({ result: result.object })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'event-extract.failed',
          message: `LLM extraction failed: ${(err as Error).message}`,
        },
      },
      { status: 502 },
    )
  }
}
