/**
 * Deterministic capture-acknowledgment rules engine (voice Pattern A —
 * 2026-07-04 voice-humanness assessment, quick win Q1).
 *
 * Same pattern as `follow-up-engine.ts`: pure function, locked catalog
 * lookup, no LLM, no I/O. Same input always produces the same output.
 *
 * `selectAcknowledgement` returns the receipt line Saha speaks for a
 * just-captured metric value, or `null` when policy says stay quiet:
 *
 *   - **Boundary skip (T4 confidence caveat):** no ack when pain/energy
 *     is 1 or 9–10. A mis-extraction acknowledged at an extreme value
 *     ("Got it — pain at 10.") is alarming in a way a mid-range miss is
 *     not, and the extractor exposes no confidence signal to gate on.
 *   - **Malformed values** (non-integer, out of 1–10, unknown enum)
 *     return `null` rather than throwing — the ack is garnish; the loop
 *     must never die over it.
 *
 * `selectFreeformAcknowledgement` is the seed-extraction flavor: after
 * the opener's freeform utterance is extracted, ack only when *exactly
 * one* metric was captured. With several captured there is no single
 * value to reflect, and chaining receipts ("Got it — pain at 7. Feeling
 * flat — noted. …") would break the ≤8-word discipline in one breath.
 */

import type { CheckinMetrics, FlareState, Metric, Mood } from "@/lib/checkin/types";
import { ACK_VARIANTS, type AckValue, type AckVariantKey } from "@/lib/saha/ack-variants";

export interface AckSelection {
  variantKey: AckVariantKey;
  text: string;
}

const MOODS: readonly Mood[] = ["heavy", "flat", "okay", "bright", "great"];
const FLARE_STATES: readonly FlareState[] = ["no", "yes", "ongoing"];

/** Boundary values where a 1–10 metric ack is skipped. */
function isBoundaryScale(value: number): boolean {
  return value <= 1 || value >= 9;
}

function isValidScale(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

/**
 * Pick the receipt line for a captured metric value, or `null` when the
 * boundary-skip policy (or a malformed value) says stay quiet.
 */
export function selectAcknowledgement(
  metric: Metric,
  value: AckValue,
): AckSelection | null {
  switch (metric) {
    case "pain": {
      if (typeof value !== "number" || !isValidScale(value)) return null;
      if (isBoundaryScale(value)) return null;
      return { variantKey: "pain.ack", text: ACK_VARIANTS["pain.ack"](value) };
    }
    case "energy": {
      if (typeof value !== "number" || !isValidScale(value)) return null;
      if (isBoundaryScale(value)) return null;
      return {
        variantKey: "energy.ack",
        text: ACK_VARIANTS["energy.ack"](value),
      };
    }
    case "mood": {
      if (typeof value !== "string" || !MOODS.includes(value as Mood)) {
        return null;
      }
      return {
        variantKey: "mood.ack",
        text: ACK_VARIANTS["mood.ack"](value as Mood),
      };
    }
    case "adherenceTaken": {
      if (typeof value !== "boolean") return null;
      return value
        ? {
            variantKey: "adherenceTaken.ack.taken",
            text: ACK_VARIANTS["adherenceTaken.ack.taken"](),
          }
        : {
            variantKey: "adherenceTaken.ack.notTaken",
            text: ACK_VARIANTS["adherenceTaken.ack.notTaken"](),
          };
    }
    case "flare": {
      if (
        typeof value !== "string" ||
        !FLARE_STATES.includes(value as FlareState)
      ) {
        return null;
      }
      const key = `flare.ack.${value as FlareState}` as const;
      return { variantKey: key, text: ACK_VARIANTS[key]() };
    }
    default:
      return null;
  }
}

/**
 * Seed-extraction ack: after the freeform opener answer is extracted,
 * return a receipt only when exactly one metric was captured (and that
 * one passes `selectAcknowledgement` policy). Multiple captures or zero
 * captures return `null`.
 */
export function selectFreeformAcknowledgement(
  metrics: Partial<CheckinMetrics>,
): AckSelection | null {
  const captured: Array<{ metric: Metric; value: AckValue }> = [];
  for (const metric of [
    "pain",
    "mood",
    "adherenceTaken",
    "flare",
    "energy",
  ] as const) {
    const value = metrics[metric];
    if (value !== null && value !== undefined) {
      captured.push({ metric, value });
    }
  }
  if (captured.length !== 1) return null;
  const only = captured[0];
  if (only === undefined) return null;
  return selectAcknowledgement(only.metric, only.value);
}
