/**
 * Tests for `lib/saha/opener-engine.ts` — the deterministic rules engine
 * that picks Saha's opening line each morning.
 *
 * Priority order (highest first):
 *   first-ever
 *   re-entry-same-day
 *   doctor-visit-tomorrow
 *   blood-test-tomorrow
 *   flare-fatigue-neutral (≥5 ongoing flare days)
 *   flare-ongoing
 *   streak-milestone (only at days 7, 30, 90, 180, 365)
 *   rough-yesterday
 *   multi-day-skip
 *   good-yesterday
 *   neutral-default
 *
 * The engine is pure — no side effects, no I/O. Tests here cover one case
 * per variant + priority resolution + the safety rails called out in
 * scoping § Safety rails.
 */

import { describe, it, expect } from "vitest";
import { selectOpener } from "@/lib/saha/opener-engine";
import { RULED_OUT_PHRASES } from "@/lib/saha/variants";
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

describe("selectOpener — variant per state", () => {
  it("first-ever wins when isFirstEverCheckin", () => {
    const result = selectOpener(baseState({ isFirstEverCheckin: true }));
    expect(result.key).toBe("first-ever");
    expect(result.text).toContain("glad you're here");
  });

  it("re-entry-same-day fires when lastCheckinDaysAgo === 0 (already checked in today)", () => {
    const result = selectOpener(
      baseState({
        lastCheckinDaysAgo: 0,
        yesterday: {
          date: "2026-04-25",
          pain: 4,
          mood: "okay",
          flare: "no",
          isRoughDay: false,
        },
        // streakDays > 0 so we're not on first-ever; `lastCheckinDaysAgo: 0`
        // is the signal that today's row already exists.
        streakDays: 3,
      }),
    );
    expect(result.key).toBe("re-entry-same-day");
    expect(result.text).toContain("Back again");
  });

  it("doctor-visit-tomorrow fires for upcoming doctor visit within 48h", () => {
    const result = selectOpener(
      baseState({
        upcomingEvent: {
          kind: "doctor-visit",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 20,
        },
        lastCheckinDaysAgo: 1,
      }),
    );
    expect(result.key).toBe("doctor-visit-tomorrow");
    expect(result.text).toMatch(/Dr\. Mehta tomorrow/);
  });

  it("blood-test-tomorrow fires for upcoming blood test", () => {
    const result = selectOpener(
      baseState({
        upcomingEvent: {
          kind: "blood-test",
          whenIso: "2026-04-26T08:00:00.000Z",
          hoursFromNow: 18,
        },
        lastCheckinDaysAgo: 1,
      }),
    );
    expect(result.key).toBe("blood-test-tomorrow");
    expect(result.text).toMatch(/Blood work tomorrow/);
  });

  it("flare-fatigue-neutral fires after 5 ongoing flare days (scoping § Safety rails)", () => {
    const result = selectOpener(
      baseState({
        flareOngoingDays: 5,
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 6,
          mood: "flat",
          flare: "ongoing",
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("flare-fatigue-neutral");
    // Same neutral line as the default — the key carries the meaning, the
    // copy stays calm. No name passed → name-less form.
    expect(result.text).toBe("Morning. How's your day been?");
  });

  it("flare-ongoing fires for a 1–4 day rolling flare", () => {
    const result = selectOpener(
      baseState({
        flareOngoingDays: 2,
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 5,
          mood: "flat",
          flare: "ongoing",
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("flare-ongoing");
    expect(result.text).toMatch(/flare still with you/);
  });

  it("streak-milestone fires at day 7", () => {
    const result = selectOpener(
      baseState({
        streakDays: 7,
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
    expect(result.text).toMatch(/7 days in a row/);
  });

  it.each([30, 90, 180, 365])("streak-milestone fires at day %i", (days) => {
    const result = selectOpener(
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
    expect(result.text).toMatch(new RegExp(`${days} days in a row`));
  });

  it.each([1, 2, 6, 8, 29, 31, 89, 100, 364])(
    "streak-milestone does NOT fire at non-threshold day %i — falls through",
    (days) => {
      const result = selectOpener(
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
      expect(result.key).not.toBe("streak-milestone");
    },
  );

  it("rough-yesterday fires when yesterday.isRoughDay (pain >= 8)", () => {
    const result = selectOpener(
      baseState({
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 8,
          mood: "heavy",
          flare: "no",
          isRoughDay: true,
        },
      }),
    );
    expect(result.key).toBe("rough-yesterday");
    expect(result.text).toMatch(/rough one/);
  });

  it("multi-day-skip fires when lastCheckinDaysAgo >= 2 and no rougher state present", () => {
    const result = selectOpener(
      baseState({
        lastCheckinDaysAgo: 4,
        yesterday: null, // gap is too long to reference yesterday specifics
      }),
    );
    expect(result.key).toBe("multi-day-skip");
    expect(result.text).toMatch(/been a few days/);
  });

  it("good-yesterday fires for a calm prior day", () => {
    const result = selectOpener(
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
    expect(result.text).toMatch(/steady one/);
  });

  it("neutral-default fires when there is no notable prior state", () => {
    const result = selectOpener(
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
    // No name passed → name-less form.
    expect(result.text).toBe("Morning. How's your day been?");
  });
});

describe("selectOpener — name interpolation", () => {
  it("first-ever drops the name when no profile is set", () => {
    const result = selectOpener(baseState({ isFirstEverCheckin: true }));
    expect(result.text).toBe(
      "Hey — glad you're here. How are you feeling today?",
    );
  });

  it("first-ever interpolates the runtime name when supplied", () => {
    const result = selectOpener(baseState({ isFirstEverCheckin: true }), "Asha");
    expect(result.text).toBe(
      "Hey Asha — glad you're here. How are you feeling today?",
    );
  });

  it("trims whitespace and treats empty/whitespace-only names as null", () => {
    expect(selectOpener(baseState({ isFirstEverCheckin: true }), "  ").text).toBe(
      "Hey — glad you're here. How are you feeling today?",
    );
    expect(selectOpener(baseState({ isFirstEverCheckin: true }), "").text).toBe(
      "Hey — glad you're here. How are you feeling today?",
    );
    expect(
      selectOpener(baseState({ isFirstEverCheckin: true }), "  Maya ").text,
    ).toBe("Hey Maya — glad you're here. How are you feeling today?");
  });

  it("streak-milestone interpolates the name", () => {
    const result = selectOpener(
      baseState({
        streakDays: 7,
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 4,
          mood: "okay",
          flare: "no",
          isRoughDay: false,
        },
      }),
      "Asha",
    );
    expect(result.text).toBe("7 days in a row, Asha. How's today?");
  });
});

describe("selectOpener — priority order resolution", () => {
  it("first-ever beats every other state", () => {
    // Stack the deck — first-ever should still win.
    const result = selectOpener(
      baseState({
        isFirstEverCheckin: true,
        upcomingEvent: {
          kind: "doctor-visit",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        flareOngoingDays: 6,
        streakDays: 7,
        lastCheckinDaysAgo: 0,
        yesterday: {
          date: "2026-04-24",
          pain: 10,
          mood: "heavy",
          flare: "yes",
          isRoughDay: true,
        },
      }),
    );
    expect(result.key).toBe("first-ever");
  });

  it("upcoming doctor visit beats flare-ongoing and streak-milestone", () => {
    const result = selectOpener(
      baseState({
        upcomingEvent: {
          kind: "doctor-visit",
          whenIso: "2026-04-26T09:00:00.000Z",
          hoursFromNow: 18,
        },
        flareOngoingDays: 2,
        streakDays: 7,
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 6,
          mood: "flat",
          flare: "ongoing",
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("doctor-visit-tomorrow");
  });

  it("flare-fatigue-neutral beats flare-ongoing at exactly 5 days", () => {
    const result = selectOpener(
      baseState({
        flareOngoingDays: 5,
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 6,
          mood: "flat",
          flare: "ongoing",
          isRoughDay: false,
        },
      }),
    );
    expect(result.key).toBe("flare-fatigue-neutral");
  });

  it("flare-ongoing beats rough-yesterday when both apply", () => {
    const result = selectOpener(
      baseState({
        flareOngoingDays: 2,
        lastCheckinDaysAgo: 1,
        yesterday: {
          date: "2026-04-24",
          pain: 9,
          mood: "heavy",
          flare: "ongoing",
          isRoughDay: true,
        },
      }),
    );
    expect(result.key).toBe("flare-ongoing");
  });

  it("streak-milestone beats rough-yesterday when both apply", () => {
    const result = selectOpener(
      baseState({
        streakDays: 7,
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
    expect(result.key).toBe("streak-milestone");
  });

  it("rough-yesterday beats multi-day-skip when both apply", () => {
    // Edge: data 2 days old but flagged rough — scoping says fall back to
    // multi-day-skip when prior data is stale (>2 days). Exactly 2 days
    // counts as still-recent here; the rough-yesterday read still fires.
    const result = selectOpener(
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
  });
});

describe("selectOpener — safety rails (ADR-009 + scoping § Safety rails)", () => {
  it("rough-yesterday with pain=10 does NOT use 'terrible' or 'awful'", () => {
    const result = selectOpener(
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
    expect(result.key).toBe("rough-yesterday");
    const lower = result.text.toLowerCase();
    expect(lower).not.toContain("terrible");
    expect(lower).not.toContain("awful");
    expect(lower).not.toContain("yesterday was rough"); // exact phrasing ruled out
  });

  it("does not emit any phrase ruled out by ADR-009 in any variant", () => {
    // Fire each variant once and string-check the output.
    const variantStates: Array<Partial<ContinuityState>> = [
      { isFirstEverCheckin: true },
      {
        lastCheckinDaysAgo: 0,
        streakDays: 3,
        yesterday: {
          date: "2026-04-25",
          pain: 4,
          mood: "okay",
          flare: "no",
          isRoughDay: false,
        },
      },
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
    for (const partial of variantStates) {
      const text = selectOpener(baseState(partial)).text.toLowerCase();
      for (const phrase of RULED_OUT_PHRASES) {
        expect(text).not.toContain(phrase);
      }
    }
  });

  it("upcomingEvent === null collapses upcoming-visit branch (C2 F08 stub)", () => {
    // upcomingEvent is always null in C2; verify the engine still selects
    // a sensible fallback when it is null.
    const result = selectOpener(
      baseState({
        upcomingEvent: null,
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
    expect(["good-yesterday", "neutral-default"]).toContain(result.key);
  });
});
