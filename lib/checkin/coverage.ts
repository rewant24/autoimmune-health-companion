/**
 * Coverage helper for the daily check-in (Feature 01, Cycle 2).
 *
 * Given a `Partial<CheckinMetrics>` produced by `extractMetrics`, classify
 * each of the five tracked metrics as `covered` (the LLM confidently inferred
 * a value) or `missing` (the LLM returned `null`/`undefined`, or — for
 * range-bounded metrics — returned an out-of-bounds number that we refuse
 * to trust).
 *
 * `missing.length === 0` is the trigger for ADR-005 — Stage 2 is skipped
 * entirely when every metric came out of the open transcript.
 *
 * Pure function. No side effects, no I/O, no dependencies on the AI SDK
 * or Convex. The unit tests in `tests/check-in/coverage.test.ts` exercise
 * boundary conditions (1, 10, 0, 11, NaN, etc.).
 */
import type { CheckinMetrics, Metric, Mood, FlareState } from "./types";

/** Metric order is canonical scoping order (pain → mood → adherence → flare → energy). */
export const METRIC_ORDER: readonly Metric[] = [
  "pain",
  "mood",
  "adherenceTaken",
  "flare",
  "energy",
] as const;

const VALID_MOODS: ReadonlySet<Mood> = new Set([
  "heavy",
  "flat",
  "okay",
  "bright",
  "great",
]);

const VALID_FLARES: ReadonlySet<FlareState> = new Set(["no", "yes", "ongoing"]);

function isValidPainOrEnergy(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

/**
 * `true` iff the metric should be treated as captured for ADR-005's
 * skip-Stage-2 decision. Out-of-range numeric values, unknown enum
 * strings, and `null`/`undefined` all count as *not covered*.
 */
export function isMetricCovered(
  metric: Metric,
  metrics: Partial<CheckinMetrics>,
): boolean {
  const value = metrics[metric];
  if (value === null || value === undefined) return false;

  switch (metric) {
    case "pain":
    case "energy":
      return isValidPainOrEnergy(value);
    case "mood":
      return typeof value === "string" && VALID_MOODS.has(value as Mood);
    case "flare":
      return typeof value === "string" && VALID_FLARES.has(value as FlareState);
    case "adherenceTaken":
      return typeof value === "boolean";
  }
}

export interface CoverageResult {
  covered: Metric[];
  missing: Metric[];
}

export function coverage(metrics: Partial<CheckinMetrics>): CoverageResult {
  const covered: Metric[] = [];
  const missing: Metric[] = [];
  for (const metric of METRIC_ORDER) {
    if (isMetricCovered(metric, metrics)) {
      covered.push(metric);
    } else {
      missing.push(metric);
    }
  }
  return { covered, missing };
}
