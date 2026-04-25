/**
 * Locked variant catalog for Saha's continuity-aware opener and closer.
 *
 * Two parallel maps keyed by `OpenerVariantKey`:
 *   - `OPENER_VARIANTS` — the line Saha speaks first thing in the morning
 *   - `CLOSER_VARIANTS` — the line Saha signs off with on the same screen
 *
 * Both engines (`opener-engine.ts` / `closer-engine.ts`) use the SAME
 * `ContinuityState` snapshot to pick a key, then look up the matching line
 * from the right map. That way a flare-day opener is always paired with
 * the flare-day closer (ADR-009 — opener and closer are the same engine).
 *
 * Copy comes from `docs/scoping.md` § Example opener variants and
 * § Closer variants table. Keep them VERBATIM. The reviewer pass checks
 * for phrases ruled out by ADR-009 (see `RULED_OUT_PHRASES`).
 *
 * Streak-milestone copy is parameterised on the streak count — the
 * `streakMilestoneOpener` / `streakMilestoneCloser` builders return the
 * right line for days 7 / 30 / 90 / 180 / 365.
 */

import type { OpenerVariantKey } from "@/lib/checkin/types";

/** Phrases scoping § Closer variants and ADR-009 explicitly rule out. */
export const RULED_OUT_PHRASES: readonly string[] = [
  "one day at a time",
  "be kind to yourself",
  "stay strong",
  "you're doing amazing",
  "thank you for trusting this",
];

/**
 * Opener line for each variant. `streak-milestone` is a template — the
 * concrete line is built by `streakMilestoneOpener(days)`.
 */
export const OPENER_VARIANTS: Record<
  Exclude<OpenerVariantKey, "streak-milestone">,
  string
> = {
  "first-ever": "Hey Sonakshi — glad you're here. How are you feeling today?",
  "re-entry-same-day": "Back again, Sonakshi — anything else?",
  "doctor-visit-tomorrow":
    "Morning, Sonakshi. Dr. Mehta tomorrow — how are you feeling going in?",
  "blood-test-tomorrow":
    "Morning, Sonakshi. Blood work tomorrow — how's today feeling?",
  // After 5+ consecutive 'ongoing' flare days, scoping says stop referencing
  // the flare daily — fall back to neutral copy. Same line as
  // `neutral-default`; the distinct key is preserved so the rules engine,
  // analytics, and the paired closer can tell the two apart.
  "flare-fatigue-neutral": "Morning, Sonakshi. How's your day been?",
  "flare-ongoing":
    "Hey Sonakshi. Is the flare still with you today, or easing up?",
  "rough-yesterday":
    "Morning, Sonakshi. Yesterday was a rough one — how's today landing?",
  "multi-day-skip": "Hey Sonakshi — been a few days. How are things?",
  "good-yesterday":
    "Morning, Sonakshi. Yesterday felt like a steady one — how's today starting?",
  "neutral-default": "Morning, Sonakshi. How's your day been?",
};

/**
 * Closer line for each variant. `streak-milestone` is parameterised; see
 * `streakMilestoneCloser(days)`. Lines kept ≤8 words per scoping.
 */
export const CLOSER_VARIANTS: Record<
  Exclude<OpenerVariantKey, "streak-milestone">,
  string
> = {
  "first-ever": "Saved. That's the first one.",
  "re-entry-same-day": "Saved. Got the update.",
  "doctor-visit-tomorrow": "Saved. Ready for tomorrow.",
  "blood-test-tomorrow": "Saved. Ready for tomorrow.",
  // Same neutral copy as `neutral-default` (flare-fatigue collapses to
  // neutral on both sides per scoping § Safety rails).
  "flare-fatigue-neutral": "Saved. See you tomorrow.",
  "flare-ongoing": "Logged. I'm here.",
  "rough-yesterday": "Saved. Today's its own day.",
  "multi-day-skip": "Saved. Good to hear you.",
  // No bespoke "good yesterday" closer in scoping — pair with neutral.
  "good-yesterday": "Saved. See you tomorrow.",
  "neutral-default": "Saved. See you tomorrow.",
};

/**
 * Streak milestone is the only number-aware variant. Scoping shows
 * "Five days in a row" as illustrative shape; the locked thresholds are
 * 7 / 30 / 90 / 180 / 365 (per opener-engine priority order). Each
 * threshold gets a concrete line, and the closer mirrors the format
 * "<N> days. That's real." per scoping § Closer variants.
 */
export function streakMilestoneOpener(days: number): string {
  return `${days} days in a row, Sonakshi. How's today?`;
}

export function streakMilestoneCloser(days: number): string {
  return `${days} days. That's real.`;
}
