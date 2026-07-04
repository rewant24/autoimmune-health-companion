/**
 * Interim extract-failure policy (2026-07-04 assessment fix).
 *
 * Two problems this closes:
 *  1. The daily-cap 429 (`ExtractDailyCapError`) used to collapse into the
 *     same silent `EXTRACTION_FAILED` as any network blip — the user got a
 *     cold tap form with no explanation.
 *  2. In the per-metric answer loop, an extract *failure* fell through the
 *     same path as "answer didn't parse", so two consecutive failures
 *     silently saved the metric as **declined** — even though the user
 *     answered. A cap 429 fails every subsequent call, so one cap trip
 *     could auto-decline every remaining metric.
 *
 * Full graceful-failure narration (voice Pattern B) waits for the A2 e2e
 * harness; this module is the shippable slice: classify the error, decide
 * when the answer loop must bail to taps, and give the Stage-2 form honest
 * copy about what happened.
 */
import { ExtractDailyCapError } from "./extract-metrics";

export type ExtractFailureKind = "daily-cap" | "transient";

export function classifyExtractError(err: unknown): ExtractFailureKind {
  return err instanceof ExtractDailyCapError ? "daily-cap" : "transient";
}

/**
 * Answer-loop bail policy. A daily-cap failure is terminal — every retry
 * burns a request and fails identically — so bail on the first one.
 * Transient failures (network, 5xx) get one silent re-ask before bailing.
 *
 * Bailing means BAIL_TO_TAPS: captured metrics are carried into Stage 2
 * and the unanswered ones stay *missing* — never auto-declined.
 */
export function shouldBailAnswerLoop(
  kind: ExtractFailureKind,
  consecutiveFailures: number,
): boolean {
  if (kind === "daily-cap") return true;
  return consecutiveFailures >= 2;
}

/**
 * Honest Stage-2 copy for each failure class. Shown above the tap form
 * after an extraction failure dropped the user out of voice mode.
 */
export function extractFailureNotice(kind: ExtractFailureKind): string {
  if (kind === "daily-cap") {
    return (
      "Saha has hit today's limit for understanding answers with AI, " +
      "so voice capture is paused until tomorrow. Nothing you said is " +
      "lost — finish today's check-in with the taps below."
    );
  }
  return (
    "Saha is having trouble understanding answers right now — a " +
    "technical hiccup on our side, not you. Finish today's check-in " +
    "with the taps below; anything already captured is filled in."
  );
}
