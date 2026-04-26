/**
 * Decline-phrase detector (Voice C1, Build-D).
 *
 * Conservative regex match over an answer transcript. False positives
 * become "user declined", which is OK — the engine still gives the user
 * a chance to come back to a skipped metric on the next check-in. False
 * negatives are worse (we'd loop on a re-ask the user already declined),
 * so the patterns lean inclusive.
 *
 * Pattern allowlist (per cycle plan §V.D.3):
 *   skip | next | don't want | don't know | dont want | dont know
 *   not sure | move on | pass | none | nothing
 *
 * Word boundaries (`\b`) keep "passenger" / "skipper" / "nothings" from
 * matching, but the multi-word phrases like "don't know" need the
 * literal-space form (no `\b` between the two words).
 */

const DECLINE_PATTERN =
  /\b(?:skip|next|don'?t (?:want|know)|not sure|move on|pass|none|nothing)\b/i;

/**
 * Returns true if the transcript looks like a decline. Empty or
 * whitespace-only input returns false (the orchestrator handles
 * "no speech captured" separately).
 */
export function detectDecline(answerTranscript: string): boolean {
  if (!answerTranscript || !answerTranscript.trim()) {
    return false;
  }
  return DECLINE_PATTERN.test(answerTranscript);
}
