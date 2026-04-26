/**
 * Deterministic follow-up question rules engine (Voice C1, Build-D).
 *
 * Same pattern as `opener-engine.ts` / `closer-engine.ts`: pure function,
 * locked catalog lookup, no LLM, no I/O. Same input always produces the
 * same output.
 *
 * `selectFollowUpQuestion` returns the variant key + the line Saha should
 * speak when re-asking for a missing metric.
 *
 * Continuity tone: only `flare` has a tone variant. When
 * `continuityState.flareOngoingDays > 0` the engine returns the
 * "still ongoing, or different?" phrasing. All other metrics ignore
 * continuity entirely.
 */

import type { ContinuityState, Metric } from "@/lib/checkin/types";
import {
  DECLINE_ACK_VARIANTS,
  FOLLOW_UP_VARIANTS,
  type FollowUpVariantKey,
  declineAckKeyForMetric,
} from "@/lib/saha/follow-up-variants";

export interface FollowUpQuestionSelection {
  variantKey: FollowUpVariantKey;
  text: string;
}

export interface DeclineAckSelection {
  text: string;
}

/**
 * Pick the right follow-up line for a missing metric on attempt 1 or 2.
 *
 * Attempt 1 returns the default per-metric question, except `flare` with
 * `flareOngoingDays > 0` which returns the continuity-tone variant.
 * Attempt 2 always returns the re-ask copy regardless of continuity.
 */
export function selectFollowUpQuestion(
  metric: Metric,
  attempt: 1 | 2,
  continuityState: ContinuityState,
): FollowUpQuestionSelection {
  const variantKey = pickVariantKey(metric, attempt, continuityState);
  return { variantKey, text: FOLLOW_UP_VARIANTS[variantKey] };
}

function pickVariantKey(
  metric: Metric,
  attempt: 1 | 2,
  continuityState: ContinuityState,
): FollowUpVariantKey {
  if (attempt === 2) {
    return `${metric}.attempt2` as FollowUpVariantKey;
  }

  // attempt === 1
  if (metric === "flare" && continuityState.flareOngoingDays > 0) {
    return "flare.attempt1.flareOngoing";
  }
  return `${metric}.attempt1.default` as FollowUpVariantKey;
}

/**
 * Resolve the 1-second TTS line played when the user declines a metric.
 * One variant per metric — no continuity influence.
 */
export function selectDeclineAcknowledgement(
  metric: Metric,
): DeclineAckSelection {
  const key = declineAckKeyForMetric(metric);
  return { text: DECLINE_ACK_VARIANTS[key] };
}
