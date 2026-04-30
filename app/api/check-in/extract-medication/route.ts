/**
 * POST /api/check-in/extract-medication
 *
 * Server-only Next.js Route Handler. The client (`extractMedications()` in
 * `lib/checkin/medication-extract.ts`) posts a transcript here AFTER the
 * metric extractor has already run for the same check-in.
 *
 * Cost-guard invariant (ADR-020) — IMPORTANT:
 *   The metric extract route (`/api/check-in/extract`) increments the
 *   `extractAttempts` counter exactly ONCE per check-in. This route does
 *   NOT increment the counter — calling `incrementAndCheck` here would
 *   burn two attempts per check-in and halve the daily cap (5 → 2.5).
 *   The check-in flow enforces ordering: medication extraction is invoked
 *   only after metric extraction returns a non-429 response.
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
 * Tests: `tests/check-in/medication-extract.test.ts` mocks `ai` directly
 * (no network, no real Convex access).
 */
import { NextResponse } from 'next/server'
import { generateObject, gateway } from 'ai'
import {
  MedicationExtractionSchema,
  buildSystemPrompt,
  buildUserMessage,
  type RegimenMedication,
} from '@/lib/checkin/medication-extract'

export const runtime = 'nodejs'

const MAX_TRANSCRIPT_CHARS = 5400
const MAX_OUTPUT_TOKENS = 400 // larger than metric extract — arrays of objects
const DEFAULT_MODEL_ID = 'openai/gpt-4o-mini'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface RequestBody {
  transcript: string
  userId: string
  date: string
  regimen: RegimenMedication[]
}

function isRegimenRow(value: unknown): value is RegimenMedication {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v._id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.dose === 'string'
  )
}

function isRequestBody(value: unknown): value is RequestBody {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.transcript === 'string' &&
    typeof v.userId === 'string' &&
    v.userId.length > 0 &&
    typeof v.date === 'string' &&
    DATE_RE.test(v.date as string) &&
    Array.isArray(v.regimen) &&
    v.regimen.every(isRegimenRow)
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
          code: 'medication-extract.bad_request',
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
          code: 'medication-extract.bad_request',
          message:
            "Body must contain { transcript: string, userId: string, date: 'YYYY-MM-DD', regimen: { _id, name, dose }[] }",
        },
      },
      { status: 400 },
    )
  }

  const body = raw

  // Empty transcript or empty regimen: skip the LLM call. No cost, no risk.
  if (
    body.transcript.trim().length === 0 ||
    body.regimen.length === 0
  ) {
    return NextResponse.json({
      result: {
        simpleAdherence: null,
        skippedMedications: [],
        dosageChanges: [],
      },
    })
  }

  const transcript = truncateTranscript(body.transcript)

  try {
    const result = await generateObject({
      model: gateway(DEFAULT_MODEL_ID),
      schema: MedicationExtractionSchema,
      system: buildSystemPrompt(body.regimen),
      prompt: buildUserMessage(transcript),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    })
    return NextResponse.json({ result: result.object })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'medication-extract.failed',
          message: `LLM extraction failed: ${(err as Error).message}`,
        },
      },
      { status: 502 },
    )
  }
}
