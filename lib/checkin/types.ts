/**
 * Shared types for the daily check-in (Feature 01) — single source of truth
 * across Cycle 2's parallel build agents.
 *
 * Keep this file pure types. Runtime constants (variant catalogs, opener
 * strings, etc.) belong in dedicated modules so Convex's typecheck doesn't
 * pull view-layer code into the server bundle.
 *
 * Authoring lane: orchestrator (pre-flight Task 0). After pre-flight is
 * tagged `f01-c2/pre-flight-done`, subagents read these types as a stable
 * contract — they should not extend this file unless the chunk plan says so.
 */

// ---- Metric vocabulary ----

/** The five tracked metrics. Order in scoping: pain → mood → adherence → flare → energy. */
export type Metric =
  | "pain"
  | "mood"
  | "adherenceTaken"
  | "flare"
  | "energy";

/** Mood enum (scoping-verbatim). */
export type Mood = "heavy" | "flat" | "okay" | "bright" | "great";

/** Tri-state flare per scoping (Cycle 2 — replaces the C1 boolean). */
export type FlareState = "no" | "yes" | "ongoing";

/** Stage classification per ADR-021. */
export type StageEnum = "open" | "scripted" | "hybrid";

/**
 * Extracted check-in metrics. `null` = declined or not captured. The pair
 * `(metrics, declined[])` together encodes whether absence is a deliberate
 * skip ("declined today") or a missing capture ("not extracted").
 */
export interface CheckinMetrics {
  pain: number | null;
  mood: Mood | null;
  adherenceTaken: boolean | null;
  flare: FlareState | null;
  energy: number | null;
}

// ---- Continuity (used by opener/closer engines) ----

/**
 * Snapshot of Sonakshi's recent state used by the opener + closer rules
 * engines to pick a variant. Computed by the Convex `getContinuityState`
 * query (chunk 2.A) from the last 30 days of check-ins.
 *
 * `upcomingEvent` is a F08 stub — returns null in C2.
 */
export interface ContinuityState {
  yesterday: {
    date: string;
    pain: number | null;
    mood: Mood | null;
    flare: FlareState | null;
    /** Heuristic: pain >= 8 OR flare === 'yes'. */
    isRoughDay: boolean;
  } | null;
  /** Consecutive days with a check-in, including today's preceding day. */
  streakDays: number;
  /** 0 = yesterday, 1 = day before, ≥ 2 = multi-day skip. */
  lastCheckinDaysAgo: number;
  /** F08 stub — always null in C2. */
  upcomingEvent: {
    kind: "doctor-visit" | "blood-test";
    whenIso: string;
    hoursFromNow: number;
  } | null;
  /** Days the current 'ongoing' flare has been rolling. 0 unless yesterday.flare === 'ongoing'. */
  flareOngoingDays: number;
  /** True iff this is the user's first-ever check-in. */
  isFirstEverCheckin: boolean;
}

// ---- Opener / closer variants ----

/**
 * Catalog of opener (and paired closer) variants. Priority order is
 * defined in `lib/saumya/opener-engine.ts` — highest first:
 *   first-ever > re-entry-same-day > doctor-visit-tomorrow >
 *   blood-test-tomorrow > flare-fatigue-neutral (≥5 ongoing) >
 *   flare-ongoing > streak-milestone (days 7/30/90/180/365 only) >
 *   rough-yesterday > multi-day-skip > good-yesterday > neutral-default.
 */
export type OpenerVariantKey =
  | "first-ever"
  | "multi-day-skip"
  | "doctor-visit-tomorrow"
  | "blood-test-tomorrow"
  | "streak-milestone"
  | "flare-ongoing"
  | "rough-yesterday"
  | "good-yesterday"
  | "neutral-default"
  | "flare-fatigue-neutral"
  | "re-entry-same-day";

// ---- Milestone / celebration ----

/** Milestone kinds celebrated in chunk 2.F. */
export type MilestoneKind =
  | "day-1"
  | "day-7"
  | "day-30"
  | "day-90"
  | "day-180"
  | "day-365";
