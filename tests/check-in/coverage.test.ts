/**
 * Tests for the coverage helper (US-1.D.3).
 *
 * The helper is pure — no AI SDK, no Convex — so these are plain unit tests.
 * We exercise: empty input, full-coverage input, single-metric coverage,
 * range boundaries (1 / 10 are in, 0 / 11 / 1.5 / NaN are out), and unknown
 * enum strings (treated as not-covered, never trusted).
 */
import { describe, it, expect } from "vitest";
import type { CheckinMetrics, Metric } from "@/lib/checkin/types";
import {
  coverage,
  isMetricCovered,
  METRIC_ORDER,
} from "@/lib/checkin/coverage";

const ALL_METRICS: Metric[] = [
  "pain",
  "mood",
  "adherenceTaken",
  "flare",
  "energy",
];

describe("coverage()", () => {
  it("returns all-missing for an empty input", () => {
    const result = coverage({});
    expect(result.covered).toEqual([]);
    expect(result.missing).toEqual(ALL_METRICS);
  });

  it("returns all-missing when every metric is null", () => {
    const metrics: Partial<CheckinMetrics> = {
      pain: null,
      mood: null,
      adherenceTaken: null,
      flare: null,
      energy: null,
    };
    expect(coverage(metrics).missing).toEqual(ALL_METRICS);
    expect(coverage(metrics).covered).toEqual([]);
  });

  it("returns all-covered when every metric has a valid value", () => {
    const metrics: CheckinMetrics = {
      pain: 5,
      mood: "okay",
      adherenceTaken: true,
      flare: "no",
      energy: 4,
    };
    expect(coverage(metrics).covered).toEqual(ALL_METRICS);
    expect(coverage(metrics).missing).toEqual([]);
  });

  it("counts pain-only as 1 covered + 4 missing", () => {
    const result = coverage({ pain: 7 });
    expect(result.covered).toEqual(["pain"]);
    expect(result.missing).toEqual([
      "mood",
      "adherenceTaken",
      "flare",
      "energy",
    ]);
  });

  it("preserves canonical metric order (pain → mood → adherence → flare → energy)", () => {
    expect(METRIC_ORDER).toEqual(ALL_METRICS);
    const result = coverage({ flare: "yes", pain: 3 });
    // Covered list follows canonical order regardless of input shape.
    expect(result.covered).toEqual(["pain", "flare"]);
  });

  it("treats adherenceTaken: false as covered (negation is a value)", () => {
    // Scoping: 'I forgot my meds' → adherenceTaken: false → still covered.
    const result = coverage({ adherenceTaken: false });
    expect(result.covered).toContain("adherenceTaken");
  });

  it("rejects pain = 0 (out of 1–10 range) as not covered", () => {
    const result = coverage({ pain: 0 });
    expect(result.covered).not.toContain("pain");
    expect(result.missing).toContain("pain");
  });

  it("rejects pain = 11 (out of 1–10 range) as not covered", () => {
    expect(coverage({ pain: 11 }).missing).toContain("pain");
  });

  it("rejects energy = 0 and energy = 11", () => {
    expect(coverage({ energy: 0 }).missing).toContain("energy");
    expect(coverage({ energy: 11 }).missing).toContain("energy");
  });

  it("accepts pain = 1 and pain = 10 (boundary values)", () => {
    expect(coverage({ pain: 1 }).covered).toContain("pain");
    expect(coverage({ pain: 10 }).covered).toContain("pain");
  });

  it("rejects non-integer pain (e.g. 5.5) as not covered", () => {
    expect(coverage({ pain: 5.5 as unknown as number }).missing).toContain(
      "pain",
    );
  });

  it("rejects NaN energy as not covered", () => {
    expect(coverage({ energy: NaN as unknown as number }).missing).toContain(
      "energy",
    );
  });

  it("rejects unknown mood strings as not covered", () => {
    expect(
      coverage({ mood: "ecstatic" as unknown as CheckinMetrics["mood"] })
        .missing,
    ).toContain("mood");
  });

  it("rejects unknown flare strings as not covered", () => {
    expect(
      coverage({ flare: "maybe" as unknown as CheckinMetrics["flare"] })
        .missing,
    ).toContain("flare");
  });

  it("rejects non-boolean adherenceTaken as not covered", () => {
    expect(
      coverage({
        adherenceTaken: "yes" as unknown as CheckinMetrics["adherenceTaken"],
      }).missing,
    ).toContain("adherenceTaken");
  });
});

describe("isMetricCovered()", () => {
  it("returns true for valid pain values 1–10", () => {
    for (const v of [1, 2, 5, 9, 10]) {
      expect(isMetricCovered("pain", { pain: v })).toBe(true);
    }
  });

  it("returns false for missing keys", () => {
    expect(isMetricCovered("pain", {})).toBe(false);
    expect(isMetricCovered("mood", {})).toBe(false);
  });

  it("recognizes every valid mood enum literal", () => {
    for (const m of ["heavy", "flat", "okay", "bright", "great"] as const) {
      expect(isMetricCovered("mood", { mood: m })).toBe(true);
    }
  });

  it("recognizes every valid flare enum literal", () => {
    for (const f of ["no", "yes", "ongoing"] as const) {
      expect(isMetricCovered("flare", { flare: f })).toBe(true);
    }
  });

  it("treats both adherenceTaken=true and adherenceTaken=false as covered", () => {
    expect(isMetricCovered("adherenceTaken", { adherenceTaken: true })).toBe(
      true,
    );
    expect(isMetricCovered("adherenceTaken", { adherenceTaken: false })).toBe(
      true,
    );
  });
});
