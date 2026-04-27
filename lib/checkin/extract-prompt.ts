/**
 * System prompt + zod schema for the LLM metric extraction (ADR-020).
 *
 * Lives in its own module so the prompt can be shared between the runtime
 * route handler (`app/api/check-in/extract/route.ts`) and the test fixtures
 * (`tests/check-in/extract-route.test.ts`) — and so accidental edits show
 * up cleanly in code review.
 *
 * Locked decisions baked in here:
 * - Model id: `openai/gpt-4o-mini` via Vercel AI Gateway (ADR-020).
 *   Resolved at call site so the runtime can opt for a different gateway
 *   model id during ops if needed without touching this file.
 * - Transcript truncation: 5400 characters (≈ 2000 tokens at gpt-4o-mini's
 *   ~2.7 chars/token estimate).
 * - Output cap: 200 tokens.
 * - Negation counts as a value ("I forgot my meds" → adherenceTaken: false).
 * - "If you cannot reliably infer a value, return null. Do not guess."
 */
import { z } from "zod";

/** Maximum input chars sent to the LLM. */
export const MAX_TRANSCRIPT_CHARS = 5400;

/** `maxOutputTokens` cap for the AI SDK call. */
export const MAX_OUTPUT_TOKENS = 200;

/** Default Vercel AI Gateway model id (ADR-020). */
export const DEFAULT_MODEL_ID = "openai/gpt-4o-mini";

/**
 * Truncate a transcript to `MAX_TRANSCRIPT_CHARS` characters. We keep the
 * leading slice (most check-ins put the headline up front) and append an
 * ellipsis marker so the model knows the tail was clipped. Pure.
 */
export function truncateTranscript(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
  return text.slice(0, MAX_TRANSCRIPT_CHARS) + "\n[...truncated]";
}

/**
 * Zod schema for the structured output. Every metric is nullable — the
 * model returns `null` when it cannot reliably infer a value.
 */
export const ExtractedMetricsSchema = z.object({
  pain: z.number().int().min(1).max(10).nullable(),
  mood: z.enum(["heavy", "flat", "okay", "bright", "great"]).nullable(),
  adherenceTaken: z.boolean().nullable(),
  flare: z.enum(["no", "yes", "ongoing"]).nullable(),
  energy: z.number().int().min(1).max(10).nullable(),
});

export type ExtractedMetrics = z.infer<typeof ExtractedMetricsSchema>;

/**
 * The system prompt sent on every extraction call. Kept verbatim so the
 * "no hallucination" + "negation counts" lines are easy to find on review.
 */
export const SYSTEM_PROMPT = `You are an extraction layer for a daily voice check-in in an autoimmune-health companion app. The user speaks freely about their day. Your only job is to extract five structured metrics from the transcript:

- pain: integer 1–10. Self-reported pain level. 1 = no pain, 10 = worst imaginable.
- mood: one of "heavy" | "flat" | "okay" | "bright" | "great".
- adherenceTaken: boolean. Did the user take today's prescribed medication(s)? true if they took them, false if they skipped/forgot.
- flare: one of "no" | "yes" | "ongoing". "no" = no flare today; "yes" = a new flare started today; "ongoing" = a flare from a prior day is still rolling.
- energy: integer 1–10. 1 = wiped out / exhausted, 10 = full energy.

Rules:
1. If you cannot reliably infer a value, return null. Do not guess.
2. Negation counts as a value (e.g., "I forgot my meds" → adherenceTaken: false; "no flare today" → flare: "no").
3. Map qualitative words to the closest enum / range (e.g., "knackered" → energy: low integer like 2–3; "okay-ish" → mood: "okay"). Only do this when the mapping is clear; otherwise return null.
4. Do not invent values that the user did not mention. Silence about a metric → null.
5. Return strictly the JSON object matching the schema. No commentary, no markdown.`;

/**
 * Build the user-message payload sent to the model. Keeps the transcript
 * fenced and truncated so the prompt structure is stable.
 */
export function buildUserMessage(transcript: string): string {
  return `Transcript:\n"""\n${truncateTranscript(transcript)}\n"""\n\nReturn the extracted metrics now.`;
}
