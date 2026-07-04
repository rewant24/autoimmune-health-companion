/**
 * Locked variant catalog for Saha's mid-loop capture acknowledgments
 * (voice Pattern A — 2026-07-04 voice-humanness assessment, quick win Q1).
 *
 * Companion to `FOLLOW_UP_VARIANTS` / `DECLINE_ACK_VARIANTS` — same shape:
 * a verbatim record consumed by a pure rules engine (`ack-engine.ts`).
 *
 * An ack is a neutral-warm *receipt* of the value the user just spoke
 * ("Got it — pain at 7."). It is bundled into the NEXT question's TTS
 * call by the page, so it costs zero extra POSTs and zero extra latency.
 *
 * Register rules (per the assessment §5):
 *   - Never approving of the value itself — "Great, pain at 3!" makes
 *     "…pain at 9" unspeakable in the same voice. Receipts only.
 *   - Brevity is warmth on day 40 — same ≤8-word discipline as closers.
 *   - No `RULED_OUT_PHRASES` (see `variants.ts`).
 *
 * The boundary-skip policy (no ack at pain/energy 1 or 9–10) lives in
 * `ack-engine.ts`, not here — this file is copy only.
 */

import type { FlareState, Mood } from "@/lib/checkin/types";

/** Stable key for the ack variant the engine returned. */
export type AckVariantKey =
  | "pain.ack"
  | "mood.ack"
  | "adherenceTaken.ack.taken"
  | "adherenceTaken.ack.notTaken"
  | "flare.ack.yes"
  | "flare.ack.no"
  | "flare.ack.ongoing"
  | "energy.ack";

/**
 * Ack line builders keyed by `AckVariantKey`. Value-parameterised where
 * the metric carries a number or enum; pure, deterministic.
 *
 * Receipt words are varied across adjacent metrics (loop order is
 * pain → mood → adherence → flare → energy) so consecutive acks don't
 * all open with "Got it".
 */
export const ACK_VARIANTS = {
  "pain.ack": (value: number): string => `Got it — pain at ${value}.`,
  "mood.ack": (value: Mood): string => `Feeling ${value} — noted.`,
  "adherenceTaken.ack.taken": (): string => "Okay, meds taken.",
  "adherenceTaken.ack.notTaken": (): string => "Okay, no meds today.",
  "flare.ack.yes": (): string => "A flare today — got it.",
  "flare.ack.no": (): string => "No flare — got it.",
  "flare.ack.ongoing": (): string => "Still ongoing — got it.",
  "energy.ack": (value: number): string => `Energy at ${value} — got it.`,
} as const;

/** Widened value type an ack builder can receive. */
export type AckValue = number | Mood | FlareState | boolean;
