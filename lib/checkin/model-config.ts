/**
 * Extraction-LLM model configuration (ADR-020; vendor-strategy spike
 * 2026-07-05, Track 3).
 *
 * Single owner of the Vercel AI Gateway model id used by all three
 * extraction routes (`extract`, `extract-event`, `extract-medication`).
 * Previously the id was hardcoded in three places; consolidating it here
 * and reading `EXTRACT_MODEL_ID` from the environment makes a model swap
 * a Vercel env edit + redeploy instead of a code cycle.
 *
 * Gateway model ids are provider-prefixed (`openai/gpt-4o-mini`,
 * `google/gemini-2.5-flash`, `anthropic/claude-haiku-4.5`, …) — the
 * gateway owns keys, billing, and routing, so no other code changes on a
 * swap. The guardrails that DO need re-verifying against a new model
 * live in the spike (§5.4): nullable-not-optional zod schemas, the
 * `rate_limited` error code, and one-cap-increment-per-logical-unit.
 *
 * Resolved per-call (not at module load) so ops can flip the env var
 * without worrying about import-time capture, and so tests can exercise
 * the override without module-cache gymnastics.
 */

/** Fallback Vercel AI Gateway model id (ADR-020 locked default). */
export const DEFAULT_MODEL_ID = "openai/gpt-4o-mini";

/**
 * The gateway model id for extraction calls: `EXTRACT_MODEL_ID` when set
 * to a non-empty value, otherwise `DEFAULT_MODEL_ID`.
 */
export function getExtractModelId(): string {
  const configured = process.env.EXTRACT_MODEL_ID;
  if (typeof configured !== "string") return DEFAULT_MODEL_ID;
  const trimmed = configured.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_MODEL_ID;
}
