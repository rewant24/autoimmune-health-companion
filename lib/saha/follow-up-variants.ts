/**
 * Locked variant catalog for Saha's per-metric follow-up questions and
 * decline-acknowledgement copy (Voice C1, Build-D).
 *
 * Companion to `OPENER_VARIANTS` / `CLOSER_VARIANTS` — same shape: a
 * verbatim record consumed by the rules engine in `follow-up-engine.ts`.
 * Reviewers verify exact match against the catalog at
 * `docs/features/voice-cycle-1-plan.md` line 462.
 *
 * Coverage: 5 metrics × 2 attempts × ≤2 continuity tones + 5 decline
 * acknowledgements = 22 strings total.
 *
 * Continuity-tone variant: only `flare` has one (used when
 * `continuityState.flareOngoingDays > 0`). All other metrics use the
 * default attempt-1 line regardless of continuity.
 */

import type { Metric } from "@/lib/checkin/types";

/** Stable key for the variant the engine returned. */
export type FollowUpVariantKey =
  // attempt 1 — default
  | "pain.attempt1.default"
  | "mood.attempt1.default"
  | "adherenceTaken.attempt1.default"
  | "flare.attempt1.default"
  | "energy.attempt1.default"
  // attempt 1 — continuity tone (flare only)
  | "flare.attempt1.flareOngoing"
  // attempt 2 — re-ask
  | "pain.attempt2"
  | "mood.attempt2"
  | "adherenceTaken.attempt2"
  | "flare.attempt2"
  | "energy.attempt2";

/**
 * Follow-up question copy keyed by `FollowUpVariantKey`. Lines copied
 * verbatim from the locked catalog — punctuation, em-dashes, and
 * apostrophes preserved exactly.
 */
export const FOLLOW_UP_VARIANTS: Record<FollowUpVariantKey, string> = {
  // attempt 1 — default
  "pain.attempt1.default": "How's the pain today on a 1 to 10?",
  "mood.attempt1.default":
    "And how are you feeling — heavy, flat, okay, bright, or great?",
  "adherenceTaken.attempt1.default": "Did you take your medication today?",
  "flare.attempt1.default": "Any flare today — yes, no, or still ongoing?",
  "energy.attempt1.default": "And your energy today, 1 to 10?",

  // attempt 1 — continuity tone (flare with ongoing days > 0)
  "flare.attempt1.flareOngoing":
    "And the flare today — still ongoing, or different?",

  // attempt 2 — re-ask
  "pain.attempt2": "Sorry — missed that. The pain today, 1 to 10?",
  "mood.attempt2":
    "Sorry — could you say how you're feeling? Heavy, flat, okay, bright, or great?",
  "adherenceTaken.attempt2": "Sorry — meds today, yes or no?",
  "flare.attempt2": "Sorry — flare today: yes, no, or ongoing?",
  "energy.attempt2": "Sorry — energy today, 1 to 10?",
};

/** Stable key for the per-metric decline acknowledgement. */
export type DeclineAckKey =
  | "pain.decline"
  | "mood.decline"
  | "adherenceTaken.decline"
  | "flare.decline"
  | "energy.decline";

/**
 * Decline-acknowledgement copy keyed by `DeclineAckKey`. Played as a short
 * TTS line confirming a metric was skipped before the engine moves on.
 */
export const DECLINE_ACK_VARIANTS: Record<DeclineAckKey, string> = {
  "pain.decline": "OK, skipping pain.",
  "mood.decline": "OK, skipping mood.",
  "adherenceTaken.decline": "OK, skipping medication.",
  "flare.decline": "OK, skipping flare.",
  "energy.decline": "OK, skipping energy.",
};

/** Resolve a metric to its decline-ack key. Pure mapping. */
export function declineAckKeyForMetric(metric: Metric): DeclineAckKey {
  return `${metric}.decline` as DeclineAckKey;
}
