/**
 * Deterministic opener-selection rules engine (ADR-006).
 *
 * `selectOpener` takes a `ContinuityState` snapshot and returns the variant
 * key + the line Saha should speak. Pure function — same input always
 * produces the same output. No LLM, no I/O.
 *
 * Why a rules engine: predictability, instant render, audit-ability, i18n
 * (per scoping § How the variant is selected).
 *
 * Priority order (top wins):
 *   1. first-ever
 *   2. re-entry-same-day            (lastCheckinDaysAgo === 0 — already checked in today)
 *   3. doctor-visit-tomorrow        (upcomingEvent.kind === 'doctor-visit')
 *   4. blood-test-tomorrow          (upcomingEvent.kind === 'blood-test')
 *   5. flare-fatigue-neutral        (flareOngoingDays >= 5 — scoping § Safety rails)
 *   6. flare-ongoing                (flareOngoingDays in 1..4)
 *   7. streak-milestone             (streakDays in {7,30,90,180,365})
 *   8. rough-yesterday              (yesterday.isRoughDay && lastCheckinDaysAgo <= 2)
 *   9. multi-day-skip               (lastCheckinDaysAgo >= 2)
 *  10. good-yesterday               (yesterday with pain<8 and mood in 'bright'|'great')
 *  11. neutral-default              (catch-all)
 *
 * Note on `lastCheckinDaysAgo`: 0 means yesterday's row already exists for
 * "today" (i.e. user checked in earlier today and is back) — that's the
 * re-entry path. 1 means yesterday. >=2 means multi-day skip.
 */

import type {
  ContinuityState,
  OpenerVariantKey,
} from "@/lib/checkin/types";
import {
  OPENER_VARIANTS,
  streakMilestoneOpener,
} from "@/lib/saha/variants";

export interface OpenerSelection {
  key: OpenerVariantKey;
  text: string;
}

/** Streak days that fire the `streak-milestone` variant. */
const STREAK_THRESHOLDS: ReadonlySet<number> = new Set([7, 30, 90, 180, 365]);

/**
 * Pick the right opener variant for the given continuity snapshot.
 * See file header for priority order.
 */
export function selectOpener(state: ContinuityState): OpenerSelection {
  const key = pickKey(state);
  const text = textForKey(key, state);
  return { key, text };
}

function pickKey(state: ContinuityState): OpenerVariantKey {
  if (state.isFirstEverCheckin) {
    return "first-ever";
  }

  // Re-entry: today's row already exists. Engine catches this BEFORE the
  // upcoming-visit branch so the second-of-the-day opener doesn't repeat
  // the visit framing — once already given to her, twice is nagging.
  if (state.lastCheckinDaysAgo === 0 && !state.isFirstEverCheckin) {
    return "re-entry-same-day";
  }

  if (state.upcomingEvent !== null) {
    if (state.upcomingEvent.kind === "doctor-visit") {
      return "doctor-visit-tomorrow";
    }
    if (state.upcomingEvent.kind === "blood-test") {
      return "blood-test-tomorrow";
    }
  }

  // Flare fatigue: scoping § Safety rails — after 5+ ongoing days, drop
  // the flare reference and go neutral. Distinct key so the closer can
  // mirror the call.
  if (state.flareOngoingDays >= 5) {
    return "flare-fatigue-neutral";
  }

  if (state.flareOngoingDays >= 1) {
    return "flare-ongoing";
  }

  if (STREAK_THRESHOLDS.has(state.streakDays)) {
    return "streak-milestone";
  }

  // "Rough yesterday" only references state when prior data is fresh (per
  // scoping § Safety rails — fall back to multi-day-skip when stale).
  if (
    state.yesterday !== null &&
    state.yesterday.isRoughDay &&
    state.lastCheckinDaysAgo <= 2
  ) {
    return "rough-yesterday";
  }

  if (state.lastCheckinDaysAgo >= 2) {
    return "multi-day-skip";
  }

  // "Good yesterday" requires a positive read on either mood or low pain;
  // a row with all nulls falls through to neutral so we don't claim
  // "yesterday felt steady" without evidence.
  if (
    state.yesterday !== null &&
    !state.yesterday.isRoughDay &&
    isPositiveRead(state.yesterday)
  ) {
    return "good-yesterday";
  }

  return "neutral-default";
}

function isPositiveRead(yesterday: NonNullable<ContinuityState["yesterday"]>): boolean {
  // Either a low pain reading, or a positive mood, qualifies as "good".
  if (yesterday.pain !== null && yesterday.pain <= 4) return true;
  if (yesterday.mood === "bright" || yesterday.mood === "great") return true;
  return false;
}

function textForKey(key: OpenerVariantKey, state: ContinuityState): string {
  if (key === "streak-milestone") {
    return streakMilestoneOpener(state.streakDays);
  }
  return OPENER_VARIANTS[key];
}
