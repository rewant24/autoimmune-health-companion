/**
 * Locked variant catalog for Saha's graceful-failure narration (voice
 * Pattern B) and the per-metric redo acknowledgement (voice Pattern D).
 * 2026-07-12 voice cycle — see `docs/spikes/voice-ux-research/
 * 04-target-patterns.md` §Pattern B / §Pattern D and the 2026-07-04
 * voice-humanness assessment M1/M2.
 *
 * Companion to `FOLLOW_UP_VARIANTS` / `ACK_VARIANTS` — same shape: a
 * verbatim record consumed by a pure rules engine (`recovery-engine.ts`).
 * No LLM-dynamic phrasing — every spoken line ships from this file.
 *
 * Register rules (same discipline as the other catalogs):
 *   - Saha speaks as "I" (never third-person "Saha is…").
 *   - Failure narration owns the failure as Saha's ("on my side, not
 *     you") — the Wysa blame-absorption lesson (T3).
 *   - No `RULED_OUT_PHRASES` (see `variants.ts`).
 *   - Brevity is warmth on day 40 — no chattier lines to compensate.
 *
 * The choice-vs-bail policy (transient failures get the "one at a time
 * or taps?" choice; a daily cap / provider throttle cannot honestly
 * offer voice continuation, so those narrate and carry to taps) lives
 * in `recovery-engine.ts`, not here — this file is copy only.
 */

/** Stable key for the recovery narration variant the engine returned. */
export type RecoveryVariantKey =
  | "recovery.transient.choice"
  | "recovery.daily-cap.bail"
  | "recovery.rate-limited.bail";

/**
 * Recovery narration copy keyed by `RecoveryVariantKey`. Spoken via TTS
 * the moment an extract failure knocks the user out of the voice loop
 * (Pattern B: honest fallback in the SAME channel the conversation was
 * happening in, not just visual Stage-2 copy).
 */
export const RECOVERY_VARIANTS: Record<RecoveryVariantKey, string> = {
  // Transient failure (network / 5xx / parse) — recovery is plausible,
  // so Saha offers the explicit choice. Rendered alongside the two
  // choice buttons ("Ask me one at a time" / "Switch to taps").
  "recovery.transient.choice":
    "I'm having trouble understanding right now — that's on my side, not you. Want me to ask one at a time, or switch to taps?",

  // Daily AI cap — terminal until tomorrow; every voice turn would burn
  // a failing request, so no voice-continue choice is offered. Spoken
  // over the carry-to-taps; the Stage-2 notice repeats it visually.
  "recovery.daily-cap.bail":
    "I've hit today's limit for understanding answers — that's back tomorrow. Nothing you said is lost; let's finish with taps.",

  // Provider throttle (per-minute window) — the loop's next call lands
  // inside the same window, so voice-continue would fail identically.
  "recovery.rate-limited.bail":
    "I'm having trouble keeping up right now — not you. Nothing you said is lost; let's finish with taps.",
};

/**
 * Pattern D redo acknowledgement — spoken (bundled into the re-asked
 * question's TTS, zero extra POSTs) when the user taps "Ask that again"
 * during an answer turn: "Sure — one more time. How's the pain today on
 * a 1 to 10?"
 */
export const REDO_ACK = "Sure — one more time.";
