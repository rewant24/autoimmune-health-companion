/**
 * Capture-acknowledgment engine (voice Pattern A — 2026-07-04 quick win Q1).
 *
 * Load-bearing behaviors:
 *   - receipts reflect the captured value verbatim ("Got it — pain at 7.")
 *   - boundary skip: pain/energy at 1 or 9–10 returns null (T4 caveat —
 *     never casually confirm a possibly mis-heard extreme aloud)
 *   - malformed values return null instead of throwing (ack is garnish)
 *   - freeform seed ack fires only when exactly one metric was captured
 *   - register discipline: no ruled-out phrases, receipts stay short
 */
import { describe, expect, it } from "vitest";

import {
  selectAcknowledgement,
  selectFreeformAcknowledgement,
} from "@/lib/saha/ack-engine";
import { RULED_OUT_PHRASES } from "@/lib/saha/variants";
import type { FlareState, Mood } from "@/lib/checkin/types";

describe("selectAcknowledgement — scale metrics (pain/energy)", () => {
  it.each([2, 3, 4, 5, 6, 7, 8])("acks pain at %i", (n) => {
    const result = selectAcknowledgement("pain", n);
    expect(result).not.toBeNull();
    expect(result?.variantKey).toBe("pain.ack");
    expect(result?.text).toBe(`Got it — pain at ${n}.`);
  });

  it.each([2, 5, 8])("acks energy at %i", (n) => {
    const result = selectAcknowledgement("energy", n);
    expect(result?.variantKey).toBe("energy.ack");
    expect(result?.text).toBe(`Energy at ${n} — got it.`);
  });

  it.each([
    ["pain", 1],
    ["pain", 9],
    ["pain", 10],
    ["energy", 1],
    ["energy", 9],
    ["energy", 10],
  ] as const)("skips the ack at boundary — %s at %i", (metric, n) => {
    expect(selectAcknowledgement(metric, n)).toBeNull();
  });

  it.each([0, 11, 5.5, Number.NaN, -3])(
    "returns null for malformed scale value %d",
    (n) => {
      expect(selectAcknowledgement("pain", n)).toBeNull();
      expect(selectAcknowledgement("energy", n)).toBeNull();
    },
  );

  it("returns null when a scale metric gets a non-number", () => {
    expect(selectAcknowledgement("pain", "seven" as unknown as number)).toBeNull();
    expect(selectAcknowledgement("energy", true)).toBeNull();
  });
});

describe("selectAcknowledgement — mood", () => {
  it.each(["heavy", "flat", "okay", "bright", "great"] as const)(
    "reflects mood %s as a neutral receipt",
    (mood) => {
      const result = selectAcknowledgement("mood", mood);
      expect(result?.variantKey).toBe("mood.ack");
      expect(result?.text).toBe(`Feeling ${mood} — noted.`);
    },
  );

  it("returns null for an unknown mood string", () => {
    expect(selectAcknowledgement("mood", "ecstatic" as Mood)).toBeNull();
  });
});

describe("selectAcknowledgement — adherence", () => {
  it("acks meds taken", () => {
    const result = selectAcknowledgement("adherenceTaken", true);
    expect(result?.variantKey).toBe("adherenceTaken.ack.taken");
    expect(result?.text).toBe("Okay, meds taken.");
  });

  it("acks meds not taken without judgment", () => {
    const result = selectAcknowledgement("adherenceTaken", false);
    expect(result?.variantKey).toBe("adherenceTaken.ack.notTaken");
    expect(result?.text).toBe("Okay, no meds today.");
  });

  it("returns null for a non-boolean", () => {
    expect(selectAcknowledgement("adherenceTaken", "yes" as unknown as boolean)).toBeNull();
  });
});

describe("selectAcknowledgement — flare", () => {
  it.each([
    ["yes", "flare.ack.yes", "A flare today — got it."],
    ["no", "flare.ack.no", "No flare — got it."],
    ["ongoing", "flare.ack.ongoing", "Still ongoing — got it."],
  ] as const)("acks flare state %s", (value, key, text) => {
    const result = selectAcknowledgement("flare", value);
    expect(result?.variantKey).toBe(key);
    expect(result?.text).toBe(text);
  });

  it("returns null for an unknown flare state", () => {
    expect(selectAcknowledgement("flare", "maybe" as FlareState)).toBeNull();
  });
});

describe("selectFreeformAcknowledgement", () => {
  it("acks when exactly one metric was captured", () => {
    const result = selectFreeformAcknowledgement({ pain: 7 });
    expect(result?.text).toBe("Got it — pain at 7.");
  });

  it("stays quiet when the single captured value is at a boundary", () => {
    expect(selectFreeformAcknowledgement({ pain: 10 })).toBeNull();
    expect(selectFreeformAcknowledgement({ energy: 1 })).toBeNull();
  });

  it("stays quiet when multiple metrics were captured", () => {
    expect(selectFreeformAcknowledgement({ pain: 7, mood: "flat" })).toBeNull();
  });

  it("stays quiet when nothing was captured", () => {
    expect(selectFreeformAcknowledgement({})).toBeNull();
    expect(
      selectFreeformAcknowledgement({ pain: null, mood: null }),
    ).toBeNull();
  });

  it("treats explicit nulls as not-captured alongside one real value", () => {
    const result = selectFreeformAcknowledgement({
      pain: null,
      flare: "no",
      energy: null,
    });
    expect(result?.text).toBe("No flare — got it.");
  });
});

describe("register discipline", () => {
  const representative: string[] = [
    selectAcknowledgement("pain", 7)?.text ?? "",
    selectAcknowledgement("mood", "heavy")?.text ?? "",
    selectAcknowledgement("adherenceTaken", true)?.text ?? "",
    selectAcknowledgement("adherenceTaken", false)?.text ?? "",
    selectAcknowledgement("flare", "yes")?.text ?? "",
    selectAcknowledgement("flare", "no")?.text ?? "",
    selectAcknowledgement("flare", "ongoing")?.text ?? "",
    selectAcknowledgement("energy", 4)?.text ?? "",
  ];

  it("no ack contains a ruled-out phrase", () => {
    for (const text of representative) {
      for (const phrase of RULED_OUT_PHRASES) {
        expect(text.toLowerCase()).not.toContain(phrase);
      }
    }
  });

  it("acks keep the ≤8-word closer discipline (brevity is warmth)", () => {
    for (const text of representative) {
      expect(text.length).toBeGreaterThan(0);
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });

  it("acks are receipts, not approval — no exclamation marks", () => {
    for (const text of representative) {
      expect(text).not.toContain("!");
    }
  });
});
