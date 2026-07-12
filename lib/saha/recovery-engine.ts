/**
 * Deterministic graceful-failure narration rules engine (voice Pattern B)
 * plus the Pattern D redo acknowledgement. 2026-07-12 voice cycle.
 *
 * Same pattern as `follow-up-engine.ts` / `ack-engine.ts`: pure function,
 * locked catalog lookup, no LLM, no I/O. Same input always produces the
 * same output.
 *
 * Policy (mirrors `shouldBailAnswerLoop` in `lib/checkin/extract-failure`):
 *   - `transient`  → narration + explicit CHOICE ("ask one at a time, or
 *     switch to taps?"). Recovery through the per-metric voice loop is
 *     plausible for a network blip / 5xx, so the choice is honest.
 *   - `daily-cap`  → narration + carry to taps, NO voice-continue choice.
 *     The cap is terminal until tomorrow; offering "one at a time" would
 *     burn a failing extract call per turn and re-narrate every time.
 *   - `rate-limited` → same as daily-cap within the throttle window: the
 *     loop's next call lands seconds later, inside the same window.
 */

import type { ExtractFailureKind } from "@/lib/checkin/extract-failure";
import {
  RECOVERY_VARIANTS,
  REDO_ACK,
  type RecoveryVariantKey,
} from "@/lib/saha/recovery-variants";

export interface RecoveryNarrationSelection {
  variantKey: RecoveryVariantKey;
  text: string;
  /**
   * Whether the narration is paired with the voice-continue choice
   * (`recovering` state with both buttons). When false the page speaks
   * the line and carries straight to Stage 2 taps.
   */
  offersContinue: boolean;
}

/** Pick the Pattern B narration for an extract-failure class. */
export function selectRecoveryNarration(
  kind: ExtractFailureKind,
): RecoveryNarrationSelection {
  if (kind === "daily-cap") {
    return {
      variantKey: "recovery.daily-cap.bail",
      text: RECOVERY_VARIANTS["recovery.daily-cap.bail"],
      offersContinue: false,
    };
  }
  if (kind === "rate-limited") {
    return {
      variantKey: "recovery.rate-limited.bail",
      text: RECOVERY_VARIANTS["recovery.rate-limited.bail"],
      offersContinue: false,
    };
  }
  return {
    variantKey: "recovery.transient.choice",
    text: RECOVERY_VARIANTS["recovery.transient.choice"],
    offersContinue: true,
  };
}

export interface RedoAckSelection {
  text: string;
}

/**
 * Resolve the Pattern D redo acknowledgement — prepended to the re-asked
 * question's TTS text by the page. One variant, no continuity influence.
 */
export function selectRedoAcknowledgement(): RedoAckSelection {
  return { text: REDO_ACK };
}
