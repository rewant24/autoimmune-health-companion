/**
 * Voice Pattern B narration engine + Pattern D redo ack (2026-07-12).
 *
 * Two jobs, mirroring `follow-up-engine.test.ts` / `ack-engine.test.ts`:
 *   1. Catalog lock — the spoken lines are verbatim-locked; any copy
 *      change must be deliberate (reviewer pass per catalog discipline).
 *   2. Policy — transient failures offer the voice-continue choice;
 *      terminal failures (daily-cap, rate-limited) never do, because
 *      every voice turn would burn a failing extract call.
 */
import { describe, expect, it } from "vitest";
import {
  selectRecoveryNarration,
  selectRedoAcknowledgement,
} from "@/lib/saha/recovery-engine";
import {
  RECOVERY_VARIANTS,
  REDO_ACK,
} from "@/lib/saha/recovery-variants";

describe("recovery catalog — locked copy", () => {
  it("transient choice line matches the locked catalog verbatim", () => {
    expect(RECOVERY_VARIANTS["recovery.transient.choice"]).toBe(
      "I'm having trouble understanding right now — that's on my side, not you. Want me to ask one at a time, or switch to taps?",
    );
  });

  it("daily-cap bail line matches the locked catalog verbatim", () => {
    expect(RECOVERY_VARIANTS["recovery.daily-cap.bail"]).toBe(
      "I've hit today's limit for understanding answers — that's back tomorrow. Nothing you said is lost; let's finish with taps.",
    );
  });

  it("rate-limited bail line matches the locked catalog verbatim", () => {
    expect(RECOVERY_VARIANTS["recovery.rate-limited.bail"]).toBe(
      "I'm having trouble keeping up right now — not you. Nothing you said is lost; let's finish with taps.",
    );
  });

  it("redo ack matches the locked catalog verbatim", () => {
    expect(REDO_ACK).toBe("Sure — one more time.");
  });

  it("no line uses third-person self-reference (register rule)", () => {
    for (const line of Object.values(RECOVERY_VARIANTS)) {
      expect(line).not.toMatch(/\bSaha\b/);
    }
  });

  it("no line leaks the mechanism ('with AI') at the trust-fragile moment", () => {
    for (const line of Object.values(RECOVERY_VARIANTS)) {
      expect(line).not.toMatch(/\bAI\b/i);
    }
  });
});

describe("selectRecoveryNarration — choice-vs-bail policy", () => {
  it("transient → choice narration, offersContinue true", () => {
    const sel = selectRecoveryNarration("transient");
    expect(sel.variantKey).toBe("recovery.transient.choice");
    expect(sel.text).toBe(RECOVERY_VARIANTS["recovery.transient.choice"]);
    expect(sel.offersContinue).toBe(true);
  });

  it("daily-cap → bail narration, offersContinue false", () => {
    const sel = selectRecoveryNarration("daily-cap");
    expect(sel.variantKey).toBe("recovery.daily-cap.bail");
    expect(sel.text).toBe(RECOVERY_VARIANTS["recovery.daily-cap.bail"]);
    expect(sel.offersContinue).toBe(false);
  });

  it("rate-limited → bail narration, offersContinue false", () => {
    const sel = selectRecoveryNarration("rate-limited");
    expect(sel.variantKey).toBe("recovery.rate-limited.bail");
    expect(sel.text).toBe(RECOVERY_VARIANTS["recovery.rate-limited.bail"]);
    expect(sel.offersContinue).toBe(false);
  });

  it("is deterministic — same input, same output", () => {
    expect(selectRecoveryNarration("transient")).toEqual(
      selectRecoveryNarration("transient"),
    );
  });
});

describe("selectRedoAcknowledgement", () => {
  it("returns the locked redo ack", () => {
    expect(selectRedoAcknowledgement()).toEqual({
      text: "Sure — one more time.",
    });
  });
});
