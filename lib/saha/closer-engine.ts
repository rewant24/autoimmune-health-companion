/**
 * Deterministic closer-selection rules engine (ADR-009).
 *
 * Symmetric counterpart to `selectOpener`. Same `ContinuityState` snapshot,
 * same priority order — guarantees the closer pairs with the opener that
 * was already shown. Without that pairing, the app feels like it suddenly
 * stops tracking her at the end of the conversation (per scoping § The
 * closer — continuity-aware).
 *
 * Design constraints (scoping § The closer):
 *  - Witness, don't prescribe.
 *  - ≤ 8 words.
 *  - No ruled-out phrases (see `RULED_OUT_PHRASES`).
 *
 * The implementation deliberately delegates the *selection* to
 * `selectOpener` so the two engines never drift. Only the lookup map
 * differs — that's the entire seam.
 */

import type {
  ContinuityState,
  OpenerVariantKey,
} from "@/lib/checkin/types";
import { selectOpener } from "@/lib/saha/opener-engine";
import {
  CLOSER_VARIANTS,
  streakMilestoneCloser,
} from "@/lib/saha/variants";

export interface CloserSelection {
  key: OpenerVariantKey;
  text: string;
}

export function selectCloser(state: ContinuityState): CloserSelection {
  const { key } = selectOpener(state);
  const text =
    key === "streak-milestone"
      ? streakMilestoneCloser(state.streakDays)
      : CLOSER_VARIANTS[key];
  return { key, text };
}
