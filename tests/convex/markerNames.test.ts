/**
 * Unit tests for `convex/markerNames.ts` — the shared canonicalization
 * used by both the bloodWorkMarkers dual-write and the backfill migration
 * (ADR-037). Trend-query correctness depends on "CRP" / "crp" /
 * " C-reactive protein " all landing on one canonical name.
 */

import { describe, it, expect } from "vitest";
import { canonicalMarkerName } from "@/convex/markerNames";

describe("canonicalMarkerName", () => {
  it("trims surrounding whitespace", () => {
    expect(canonicalMarkerName("  CRP  ")).toBe("CRP");
  });

  it("collapses internal whitespace runs", () => {
    expect(canonicalMarkerName("C-reactive   protein")).toBe("CRP");
  });

  it("alias lookup is case-insensitive", () => {
    expect(canonicalMarkerName("crp")).toBe("CRP");
    expect(canonicalMarkerName("Crp")).toBe("CRP");
    expect(canonicalMarkerName("C-REACTIVE PROTEIN")).toBe("CRP");
  });

  it("maps the MVP-default marker aliases", () => {
    expect(canonicalMarkerName("erythrocyte sedimentation rate")).toBe("ESR");
    expect(canonicalMarkerName("sed rate")).toBe("ESR");
    expect(canonicalMarkerName("white blood cell count")).toBe("WBC");
    expect(canonicalMarkerName("white blood cells")).toBe("WBC");
    expect(canonicalMarkerName("hgb")).toBe("Hb");
    expect(canonicalMarkerName("HGB")).toBe("Hb");
    expect(canonicalMarkerName("hemoglobin")).toBe("Hb");
    expect(canonicalMarkerName("haemoglobin")).toBe("Hb");
  });

  it("passes unknown names through with whitespace normalized, casing preserved", () => {
    expect(canonicalMarkerName("Vitamin D")).toBe("Vitamin D");
    expect(canonicalMarkerName("  Vitamin   D  ")).toBe("Vitamin D");
    expect(canonicalMarkerName("anti-CCP")).toBe("anti-CCP");
  });

  it("already-canonical names are fixed points", () => {
    for (const name of ["CRP", "ESR", "WBC", "Hb"]) {
      expect(canonicalMarkerName(name)).toBe(name);
      expect(canonicalMarkerName(canonicalMarkerName(name))).toBe(name);
    }
  });
});
