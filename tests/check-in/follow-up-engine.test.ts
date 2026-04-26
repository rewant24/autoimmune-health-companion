/**
 * Tests for `lib/saha/follow-up-engine.ts` (Voice C1, Build-D).
 *
 * Verifies:
 *  - every metric × every attempt → expected variantKey + verbatim text
 *  - flare with `flareOngoingDays > 0` returns the continuity-tone variant
 *  - flare with `flareOngoingDays === 0` returns the default
 *  - non-flare metrics ignore continuity entirely
 *  - all catalog strings match the locked plan verbatim
 */

import { describe, it, expect } from "vitest";
import {
  selectDeclineAcknowledgement,
  selectFollowUpQuestion,
} from "@/lib/saha/follow-up-engine";
import {
  DECLINE_ACK_VARIANTS,
  FOLLOW_UP_VARIANTS,
} from "@/lib/saha/follow-up-variants";
import type { ContinuityState, Metric } from "@/lib/checkin/types";

const baseState = (
  overrides: Partial<ContinuityState> = {},
): ContinuityState => ({
  yesterday: null,
  streakDays: 0,
  lastCheckinDaysAgo: 0,
  upcomingEvent: null,
  flareOngoingDays: 0,
  isFirstEverCheckin: false,
  ...overrides,
});

describe("selectFollowUpQuestion — attempt 1 default per metric", () => {
  it("pain attempt 1 default", () => {
    const result = selectFollowUpQuestion("pain", 1, baseState());
    expect(result.variantKey).toBe("pain.attempt1.default");
    expect(result.text).toBe("How's the pain today on a 1 to 10?");
  });

  it("mood attempt 1 default", () => {
    const result = selectFollowUpQuestion("mood", 1, baseState());
    expect(result.variantKey).toBe("mood.attempt1.default");
    expect(result.text).toBe(
      "And how are you feeling — heavy, flat, okay, bright, or great?",
    );
  });

  it("adherenceTaken attempt 1 default", () => {
    const result = selectFollowUpQuestion("adherenceTaken", 1, baseState());
    expect(result.variantKey).toBe("adherenceTaken.attempt1.default");
    expect(result.text).toBe("Did you take your medication today?");
  });

  it("flare attempt 1 default (flareOngoingDays === 0)", () => {
    const result = selectFollowUpQuestion(
      "flare",
      1,
      baseState({ flareOngoingDays: 0 }),
    );
    expect(result.variantKey).toBe("flare.attempt1.default");
    expect(result.text).toBe("Any flare today — yes, no, or still ongoing?");
  });

  it("energy attempt 1 default", () => {
    const result = selectFollowUpQuestion("energy", 1, baseState());
    expect(result.variantKey).toBe("energy.attempt1.default");
    expect(result.text).toBe("And your energy today, 1 to 10?");
  });
});

describe("selectFollowUpQuestion — flare continuity-tone variant", () => {
  it("flare attempt 1 with flareOngoingDays === 1 returns continuity-tone variant", () => {
    const result = selectFollowUpQuestion(
      "flare",
      1,
      baseState({ flareOngoingDays: 1 }),
    );
    expect(result.variantKey).toBe("flare.attempt1.flareOngoing");
    expect(result.text).toBe(
      "And the flare today — still ongoing, or different?",
    );
  });

  it("flare attempt 1 with flareOngoingDays === 7 still returns continuity-tone variant", () => {
    const result = selectFollowUpQuestion(
      "flare",
      1,
      baseState({ flareOngoingDays: 7 }),
    );
    expect(result.variantKey).toBe("flare.attempt1.flareOngoing");
  });

  it("non-flare metrics ignore flareOngoingDays > 0", () => {
    const state = baseState({ flareOngoingDays: 5 });
    const pain = selectFollowUpQuestion("pain", 1, state);
    const mood = selectFollowUpQuestion("mood", 1, state);
    const energy = selectFollowUpQuestion("energy", 1, state);
    expect(pain.variantKey).toBe("pain.attempt1.default");
    expect(mood.variantKey).toBe("mood.attempt1.default");
    expect(energy.variantKey).toBe("energy.attempt1.default");
  });
});

describe("selectFollowUpQuestion — attempt 2 re-ask per metric", () => {
  it("pain attempt 2", () => {
    const result = selectFollowUpQuestion("pain", 2, baseState());
    expect(result.variantKey).toBe("pain.attempt2");
    expect(result.text).toBe("Sorry — missed that. The pain today, 1 to 10?");
  });

  it("mood attempt 2", () => {
    const result = selectFollowUpQuestion("mood", 2, baseState());
    expect(result.variantKey).toBe("mood.attempt2");
    expect(result.text).toBe(
      "Sorry — could you say how you're feeling? Heavy, flat, okay, bright, or great?",
    );
  });

  it("adherenceTaken attempt 2", () => {
    const result = selectFollowUpQuestion("adherenceTaken", 2, baseState());
    expect(result.variantKey).toBe("adherenceTaken.attempt2");
    expect(result.text).toBe("Sorry — meds today, yes or no?");
  });

  it("flare attempt 2 ignores continuity tone", () => {
    const withOngoing = selectFollowUpQuestion(
      "flare",
      2,
      baseState({ flareOngoingDays: 4 }),
    );
    const withoutOngoing = selectFollowUpQuestion(
      "flare",
      2,
      baseState({ flareOngoingDays: 0 }),
    );
    expect(withOngoing.variantKey).toBe("flare.attempt2");
    expect(withoutOngoing.variantKey).toBe("flare.attempt2");
    expect(withOngoing.text).toBe("Sorry — flare today: yes, no, or ongoing?");
    expect(withoutOngoing.text).toBe(
      "Sorry — flare today: yes, no, or ongoing?",
    );
  });

  it("energy attempt 2", () => {
    const result = selectFollowUpQuestion("energy", 2, baseState());
    expect(result.variantKey).toBe("energy.attempt2");
    expect(result.text).toBe("Sorry — energy today, 1 to 10?");
  });
});

describe("selectDeclineAcknowledgement — one variant per metric", () => {
  const cases: Array<[Metric, string]> = [
    ["pain", "OK, skipping pain."],
    ["mood", "OK, skipping mood."],
    ["adherenceTaken", "OK, skipping medication."],
    ["flare", "OK, skipping flare."],
    ["energy", "OK, skipping energy."],
  ];

  it.each(cases)("%s decline ack copy", (metric, expectedText) => {
    expect(selectDeclineAcknowledgement(metric).text).toBe(expectedText);
  });
});

describe("Locked catalog integrity", () => {
  it("FOLLOW_UP_VARIANTS has exactly 11 entries (5 defaults + 1 continuity tone + 5 re-asks)", () => {
    expect(Object.keys(FOLLOW_UP_VARIANTS).length).toBe(11);
  });

  it("DECLINE_ACK_VARIANTS has exactly 5 entries", () => {
    expect(Object.keys(DECLINE_ACK_VARIANTS).length).toBe(5);
  });

  it("every follow-up string is non-empty", () => {
    for (const text of Object.values(FOLLOW_UP_VARIANTS)) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("every decline ack starts with 'OK, skipping'", () => {
    for (const text of Object.values(DECLINE_ACK_VARIANTS)) {
      expect(text.startsWith("OK, skipping")).toBe(true);
    }
  });

  it("function output text always matches catalog text exactly", () => {
    const metrics: Metric[] = [
      "pain",
      "mood",
      "adherenceTaken",
      "flare",
      "energy",
    ];
    for (const metric of metrics) {
      const r1 = selectFollowUpQuestion(metric, 1, baseState());
      const r2 = selectFollowUpQuestion(metric, 2, baseState());
      expect(FOLLOW_UP_VARIANTS[r1.variantKey]).toBe(r1.text);
      expect(FOLLOW_UP_VARIANTS[r2.variantKey]).toBe(r2.text);
    }
  });
});
