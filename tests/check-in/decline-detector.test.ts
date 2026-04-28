/**
 * Tests for `lib/saha/decline-detector.ts` (Voice C1, Build-D).
 *
 * Allowlist per cycle plan §V.D.3:
 *   skip | next | don't want | don't know | not sure | move on | pass |
 *   none | nothing
 *
 * Conservative bias — false positives are OK, false negatives are worse
 * (the orchestrator would loop on re-asks the user already declined).
 */

import { describe, it, expect } from "vitest";
import { detectDecline } from "@/lib/saha/decline-detector";

describe("detectDecline — positive matches", () => {
  const positives: string[] = [
    "skip",
    "next please",
    "I'll skip that",
    "I don't know",
    "I dont know",
    "not sure",
    "let's pass",
    "move on",
    "nothing today",
  ];

  it.each(positives)("matches: %s", (phrase) => {
    expect(detectDecline(phrase)).toBe(true);
  });

  it("matches 'don't want' (apostrophe form)", () => {
    expect(detectDecline("I don't want to answer")).toBe(true);
  });

  it("matches 'dont want' (no apostrophe)", () => {
    expect(detectDecline("dont want to")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(detectDecline("SKIP")).toBe(true);
    expect(detectDecline("Pass")).toBe(true);
    expect(detectDecline("None")).toBe(true);
  });
});

describe("detectDecline — negative matches", () => {
  const negatives: string[] = [
    "I'm fine",
    "I'm good",
    "okay",
    "great today",
    "yes",
    "seven",
  ];

  it.each(negatives)("does NOT match: %s", (phrase) => {
    expect(detectDecline(phrase)).toBe(false);
  });

  it("does not match 'passenger' (word-boundary guard)", () => {
    expect(detectDecline("I felt like a passenger today")).toBe(false);
  });

  it("does not match 'nothings' (word-boundary guard)", () => {
    // Bare "nothings" wouldn't match \b...\b; sanity-check the boundary.
    expect(detectDecline("nothings")).toBe(false);
  });

  it("does not match 'that's all' (out-of-allowlist phrasing)", () => {
    // "that's all" is a natural English close-out but not in the decline
    // allowlist (skip|next|don't want|don't know|not sure|move on|pass|
    // none|nothing). Must NOT trigger decline — if a user says "pain was
    // a 7, that's all", the loop should still capture the 7 and advance
    // by extraction, not by decline. Regression-locks the allowlist
    // boundary against future "be helpful" expansions.
    expect(detectDecline("that's all")).toBe(false);
    expect(detectDecline("pain was a 7, that's all")).toBe(false);
  });

  it("does not match 'don't want to' inside a real answer (false-positive guard)", () => {
    // Plan §V.D.3 conservative bias: false positives ARE preferable to
    // false negatives, so this case explicitly DOES match (the regex
    // sees "don't want" anywhere). Pinning the current behaviour so a
    // future tightening is a deliberate choice — flip this expectation
    // alongside any negative-lookbehind change in the detector.
    expect(detectDecline("I don't want to say but it was a 7")).toBe(true);
  });
});

describe("detectDecline — empty / whitespace input", () => {
  it("returns false for empty string", () => {
    expect(detectDecline("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(detectDecline("   \n\t ")).toBe(false);
  });
});
