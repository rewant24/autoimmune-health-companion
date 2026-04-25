/**
 * Tests for `lib/saumya/closer-engine.ts`.
 *
 * Per ADR-009 the closer is the SAME rules engine as the opener — paired
 * from the same `ContinuityState` snapshot. These tests verify:
 *  - one closer per variant key (copy verbatim from scoping § Closer variants)
 *  - the closer's `key` always matches the opener's `key` for the same state
 *  - every closer is ≤ 8 words
 *  - none of the ruled-out phrases appear in any variant
 */

import { describe, it, expect } from "vitest";
import { selectOpener } from "@/lib/saumya/opener-engine";
import { selectCloser } from "@/lib/saumya/closer-engine";
import { RULED_OUT_PHRASES } from "@/lib/saumya/variants";
import type { ContinuityState } from "@/lib/checkin/types";

const baseState = (overrides: Partial<ContinuityState> = {}): ContinuityState => ({
  yesterday: null,
  streakDays: 0,
  lastCheckinDaysAgo: 0,
  upcomingEvent: null,
  flareOngoingDays: 0,
  isFirstEverCheckin: false,
  ...overrides,
});

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

describe("selectCloser — per-variant copy (scoping § Closer variants)", () => {
  it("first-ever closer", () => {
    const result = selectCloser(baseState({ isFirstEverCheckin: true }));
    expect(result.key).toBe("first-ever");
    expect(result.text).toBe("Saved. That's the first one.");
  });

  it("re-entry-same-day closer", () => {
    const result = selectCloser(
      baseState({
        lastCheckinDaysAgo: 0,
        streakDays: 3,
        yesterday: {
          date: "2026-04-25",
          pain: 4,
          mood: "okay",
          flare: "no",
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("re-entry-same-day");
    expect(result.text).toBe("Saved. Got the update.");
  });

  it("doctor-visit-tomorrow closer", () => {
    const result = selectCloser(
      baseState({
        upcomingEvent: {
          kind: "doctor-visit",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        lastCheckinDaysAgo: 1,
      }),
    );
    expect(result.key).toBe("doctor-visit-tomorrow");
    expect(result.text).toBe("Saved. Ready for tomorrow.");
  });

  it("blood-test-tomorrow closer mirrors doctor-visit", () => {
    const result = selectCloser(
      baseState({
        upcomingEvent: {
          kind: "blood-test",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        lastCheckinDaysAgo: 1,
      }),
    );
    expect(result.key).toBe("blood-test-tomorrow");
    expect(result.text).toBe("Saved. Ready for tomorrow.");
  });

  it("flare-fatigue-neutral closer collapses to neutral", () => {
    const result = selectCloser(
      baseState({ flareOngoingDays: 5, lastCheckinDaysAgo: 1 }),
    );
    expect(result.key).toBe("flare-fatigue-neutral");
    expect(result.text).toBe("Saved. See you tomorrow.");
  });

  it("flare-ongoing closer is the companionship line", () => {
    const result = selectCloser(
      baseState({ flareOngoingDays: 2, lastCheckinDaysAgo: 1 }),
    );
    expect(result.key).toBe("flare-ongoing");
    expect(result.text).toBe("Logged. I'm here.");
  });

  it.each([
    [7, "7 days. That's real."],
    [30, "30 days. That's real."],
    [90, "90 days. That's real."],
    [180, "180 days. That's real."],
    [365, "365 days. That's real."],
  ])("streak-milestone closer at day %i", (days, expected) => {
    const result = selectCloser(
      baseState({
        streakDays: days,
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 4,
          mood: "okay",
          flare: "no",
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("streak-milestone");
    expect(result.text).toBe(expected);
  });

  it("rough-yesterday closer acknowledges without prescribing", () => {
    const result = selectCloser(
      baseState({
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 9,
          mood: "heavy",
          flare: "no",
          isRoughDay: true,
        },
      }),
    );
    expect(result.key).toBe("rough-yesterday");
    expect(result.text).toBe("Saved. Today's its own day.");
  });

  it("multi-day-skip closer is the welcome-back line", () => {
    const result = selectCloser(baseState({ lastCheckinDaysAgo: 4 }));
    expect(result.key).toBe("multi-day-skip");
    expect(result.text).toBe("Saved. Good to hear you.");
  });

  it("good-yesterday closer collapses to neutral (no bespoke variant in scoping)", () => {
    const result = selectCloser(
      baseState({
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 3,
          mood: "bright",
          flare: "no",
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("good-yesterday");
    expect(result.text).toBe("Saved. See you tomorrow.");
  });

  it("neutral-default closer", () => {
    const result = selectCloser(
      baseState({
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: null,
          mood: null,
          flare: null,
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("neutral-default");
    expect(result.text).toBe("Saved. See you tomorrow.");
  });
});

describe("selectCloser — pairing with selectOpener", () => {
  it("returns the same key as selectOpener for the same state (ADR-009 pairing)", () => {
    const states: Array<Partial<ContinuityState>> = [
      { isFirstEverCheckin: true },
      { lastCheckinDaysAgo: 0, streakDays: 3 },
      {
        upcomingEvent: {
          kind: "doctor-visit",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        lastCheckinDaysAgo: 1,
      },
      { flareOngoingDays: 5, lastCheckinDaysAgo: 1 },
      { flareOngoingDays: 2, lastCheckinDaysAgo: 1 },
      { streakDays: 7, lastCheckinDaysAgo: 1 },
      {
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 9,
          mood: "heavy",
          flare: "no",
          isRoughDay: true,
        },
      },
      { lastCheckinDaysAgo: 4 },
      {
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 3,
          mood: "bright",
          flare: "no",
          isRoughDay: false,
        },
      },
      { lastCheckinDaysAgo: 1 },
    ];
    for (const partial of states) {
      const state = baseState(partial);
      expect(selectCloser(state).key).toBe(selectOpener(state).key);
    }
  });
});

describe("selectCloser — constraints", () => {
  it("every closer is ≤ 8 words", () => {
    const states: Array<Partial<ContinuityState>> = [
      { isFirstEverCheckin: true },
      { lastCheckinDaysAgo: 0, streakDays: 3 },
      {
        upcomingEvent: {
          kind: "doctor-visit",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        lastCheckinDaysAgo: 1,
      },
      {
        upcomingEvent: {
          kind: "blood-test",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        lastCheckinDaysAgo: 1,
      },
      { flareOngoingDays: 5, lastCheckinDaysAgo: 1 },
      { flareOngoingDays: 2, lastCheckinDaysAgo: 1 },
      { streakDays: 7, lastCheckinDaysAgo: 1 },
      { streakDays: 365, lastCheckinDaysAgo: 1 },
      {
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 9,
          mood: "heavy",
          flare: "no",
          isRoughDay: true,
        },
      },
      { lastCheckinDaysAgo: 4 },
      {
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 3,
          mood: "bright",
          flare: "no",
          isRoughDay: false,
        },
      },
      { lastCheckinDaysAgo: 1 },
    ];
    for (const partial of states) {
      const text = selectCloser(baseState(partial)).text;
      const wc = wordCount(text);
      expect(
        wc,
        `Closer "${text}" is ${wc} words; must be ≤ 8`,
      ).toBeLessThanOrEqual(8);
    }
  });

  it("no closer contains a phrase ruled out by ADR-009", () => {
    const states: Array<Partial<ContinuityState>> = [
      { isFirstEverCheckin: true },
      { lastCheckinDaysAgo: 0, streakDays: 3 },
      {
        upcomingEvent: {
          kind: "doctor-visit",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        lastCheckinDaysAgo: 1,
      },
      { flareOngoingDays: 5, lastCheckinDaysAgo: 1 },
      { flareOngoingDays: 2, lastCheckinDaysAgo: 1 },
      { streakDays: 7, lastCheckinDaysAgo: 1 },
      {
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 9,
          mood: "heavy",
          flare: "no",
          isRoughDay: true,
        },
      },
      { lastCheckinDaysAgo: 4 },
      {
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 3,
          mood: "bright",
          flare: "no",
          isRoughDay: false,
        },
      },
      { lastCheckinDaysAgo: 1 },
    ];
    for (const partial of states) {
      const text = selectCloser(baseState(partial)).text.toLowerCase();
      for (const phrase of RULED_OUT_PHRASES) {
        expect(text).not.toContain(phrase);
      }
    }
  });

  it("rough-yesterday closer with pain=10 does NOT use 'terrible' or 'awful'", () => {
    const result = selectCloser(
      baseState({
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 10,
          mood: "heavy",
          flare: "no",
          isRoughDay: true,
        },
      }),
    );
    const lower = result.text.toLowerCase();
    expect(lower).not.toContain("terrible");
    expect(lower).not.toContain("awful");
  });
});
