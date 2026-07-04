# Voice UX target patterns (2026-05-24)

Synthesis of [01-loop-audit.md](./01-loop-audit.md), [02-friction-inventory.md](./02-friction-inventory.md), and [03-competitive-scan.md](./03-competitive-scan.md). Four candidate patterns are surfaced below; the canonical spike doc (`docs/spikes/voice-conversational-ux.md`) will pick one to ship next.

## Cross-cutting insights (where the three reports converge)

1. **The loop is structurally mechanical, not buggy.** T1 audit shows 19 states + 3 locked TTS catalogs + no LLM in the conversation path. T3 shows Wysa hits 4.9★ "feels heard" with no voice at all. The lever is *acknowledgment shape*, not prosody quality.
2. **Honest fallback beats silent recovery.** T2 lists F-01 (extract-429 silent cliff) as the only P0. T3 shows Wysa's "not sure how to help" is its most cited warmth signal. Saha's current behavior on F-01 is the antithesis: silence → cold tap form.
3. **Forward-only flow is a known design call, not an oversight.** T1 §user-input-branches: no "go back to previous metric". T3 Pi/Replika don't have this either — but those are companion products. For a clinical-style check-in, recoverability matters more.
4. **Tap-stop affordance is already strong, voice "stop" affordance is weak.** T1 shows `StopButton` + silence-VAD + `SwitchToTapsButton` all working. T3 calls restoring push-to-talk a `worth-stealing` pattern — Saha already has it. The gap is *re-entering* listening, not exiting.

## Pattern A — "Heard X, doing Y" mid-loop acknowledgment

**The change.** Before each follow-up question, Saha speaks a one-line reflection of what was just captured. Today the loop is `[user speaks pain] → [silence] → "And your energy today, 1 to 10?"`. With the pattern: `[user speaks pain] → "Got it, pain at 7." → "And your energy today, 1 to 10?"`.

**Why it fits.** Directly translates Wysa's reflective-restatement (T3) into Saha's existing TTS catalog architecture. Adds ~1s per turn (5 turns × 1s = 5s for a full check-in — acceptable). Implements the "every turn is responsive without slowing down" insight from T3.

**What it touches.** A new `ACKNOWLEDGE_CAPTURE` TTS catalog with N variants per metric. `extracting-answer` effect at `app/check-in/page.tsx:1019-1093` would `tts.speak(ack)` before dispatching `ASK_QUESTION` for the next metric. New state `acknowledging` between `extracting-answer` and `speaking-question`? Or inline-speak without a reducer state change — TBD in spike.

**Risk.** Wrong-extraction acknowledgment is worse than no acknowledgment ("Got it, pain at 7" when the user said 1 is alarming). Confidence threshold needed. Mitigation: only speak the ack when the extractor's confidence ≥ X, or skip when the value is at a boundary (pain 9-10, fatigue 1).

**Effort.** Small. ~1 day. Pure additive surface, no state-machine restructure.

**Dependency on other patterns.** None. Can ship standalone.

---

## Pattern B — Graceful failure narration (Saha-spec spec for backlog #25)

**The change.** When `/api/check-in/extract` fails (429, 502, network, parse), instead of dispatching `EXTRACTION_FAILED` → silent Stage 2, Saha speaks an honest acknowledgment and then offers explicit choice: continue with the question loop or switch to taps. `"I'm having trouble parsing that — want me to ask one at a time, or switch to taps?"`

**Why it fits.** Directly retires F-01 (the only P0 in T2). Implements Wysa's honest fallback (T3). PR #21 attempted exactly this — its closed-context is documented in `docs/post-mvp-backlog.md` §25. The architectural seam was already designed; what failed was provider-lifecycle on the re-entry (T1 §provider-lifecycle, T2 F-02).

**What it touches.** `app/check-in/page.tsx:901-909` (the catch branch that today collapses all error classes to `EXTRACTION_FAILED`). New reducer state `recovering` between `extracting` and either `speaking-question` or `stage-2`. Salvaged helper `lib/checkin/extract-failure-fallback.ts` from PR #21 (must be re-extracted from the closed `fix/voice-loop-survives-extract-failure` branch on origin — retained per backlog #25).

**Critical dependency.** The provider-lifecycle integration harness (F-02 in T2). PR #21 closed because vitest unit tests passed but the live re-arm path was unverifiable. Means **Pattern B should not be attempted before Pattern E (out-of-scope here — the e2e voice harness we're separately building as A2)** is in place. The harness is the gate.

**Risk.** Same trap as PR #21: pass vitest, fail live. Mitigation: integration test must walk the full mic-→-extract-fail-→-fallback-tts-→-mic-rearm path against a stubbed Sarvam, not just exercise the reducer.

**Effort.** Medium. ~2-3 days assuming A2 harness is ready. Otherwise blocked.

**Dependency on other patterns.** Hard blocker: A2 voice telemetry harness (separate workstream). Soft synergy with Pattern A (acknowledgment vocabulary already in place).

---

## Pattern C — Pre-flight tone & pace adaptation

**The change.** Heuristic: if the *previous day's* fatigue or pain was ≥7 (or "yesterday was bad" inferred from continuity), select a slower / softer TTS voice variant for today's opener and questions. One-line heuristic at `selectOpener()` and `selectFollowUpQuestion()` call sites.

**Why it fits.** Translates Hume's tone-matching (T3) into Saha's stack without needing Hume. T3's Saha-specific note: "tired users should not be greeted by a chipper bot." Continuity engine already exists (`lib/saha/continuity-engine.ts` per T1 citations), so the input data is free.

**What it touches.** Sarvam TTS voice picker (currently a single voice per locale). Need to confirm Sarvam supports a slower-pace voice option, or simulate with `<speak rate="slow">` SSML. `selectOpener()` and `selectFollowUpQuestion()` engines gain a `mood` param. Two new catalog variants per metric ("low-energy delivery" copies of existing strings).

**Risk.** Over-engineered if the heuristic is noisy. If yesterday was bad ≠ today is bad, the slow voice may feel patronising. Mitigation: only apply on cold mount; once the user has spoken a value, drop back to default voice for the rest of the session.

**Effort.** Medium. ~1.5-2 days. Bulk is catalog authoring + Sarvam voice-config research; logic is trivial.

**Dependency on other patterns.** None. Can ship independently. Most exploratory of the four — easiest to defer.

---

## Pattern D — "Wait, let me try again" per-metric re-do

**The change.** During `listening-answer`, add a third bail affordance alongside `StopButton` (commit current capture) and `SwitchToTapsButton` (bail entire loop): a `RedoMetricButton` that re-asks the current metric without losing prior captures. Voice: user can say `"wait, can you ask that again"` → matched by an intent detector → re-arm same metric.

**Why it fits.** T1 explicitly flags "loop is forward-only — no way to go back". T3 says ChatGPT pre-Advanced losing push-to-talk was a mistake — restoring user-pacing affordances is a `worth-stealing` pattern. Currently the only escape from a mis-captured metric is `SwitchToTapsButton` (loses everything spoken so far).

**What it touches.** New event `REDO_METRIC` in `lib/checkin/state-machine.ts`. Reducer transition `extracting-answer + REDO_METRIC → speaking-question` (re-asks same metric, increments `reaskCountRef`). New component `RedoMetricButton` mirroring `SwitchToTapsButton`. Optional intent detector for `"wait"|"sorry"|"try again"|"go back"` phrases in `lib/checkin/decline-detector.ts` neighborhood.

**Risk.** Intent collision with `detectDecline` (already maps "skip"/"no" to decline). The phrases for re-do must be distinct enough not to false-positive on decline. Mitigation: start tap-only; add voice intent later if it lands well.

**Effort.** Small-to-medium. ~1.5 days for tap-only version; ~2.5 days with voice intent.

**Dependency on other patterns.** None. Can ship independently. Strong synergy with Pattern A (the ack lets the user *know* what was heard, enabling them to redo with confidence).

---

## Sequencing recommendation (to feed T5 decision)

**If we can ship only one this cycle:** Pattern A. Lowest risk, no harness dependency, addresses the structural "feels mechanical" theme that came out of all three reports. Sets up Pattern D vocabulary.

**If we want to retire the live P0:** Pattern B — but only after the A2 harness lands. Otherwise we repeat PR #21.

**If we want a UX differentiator:** Pattern C. Most user-research-driven (T3's Hume insight, T1's continuity engine availability). Highest design risk.

**Worth bundling:** A + D in one cycle. They share the acknowledgment vocabulary and reinforce each other ("Got it, pain at 7" → "wait, that was 1, not 7" → re-do works).

**Sequence proposal:**
1. **Cycle 1**: Pattern A standalone. Ship + measure with the Layer 2 PostHog telemetry already wired.
2. **Cycle 2**: A2 voice harness completes; then Pattern B + Pattern D together (B needs the harness; D pairs with B's recovery semantics).
3. **Cycle 3 (or defer to post-pricing)**: Pattern C if Cycle 1 + 2 telemetry shows the "tired user friction" hypothesis holds.

## Open questions for T5

1. Is the 1s acknowledgment latency acceptable, or does that push the 2-3 min check-in target?
2. Should Pattern A acknowledgments use the LLM (extracted-value + dynamic phrasing) or stay in the locked-catalog tradition? T1 shows the catch-block extract is the only LLM call in the conversation path today.
3. Pattern B's "switch to taps or continue?" choice — does that need its own state, or is it a UI overlay on `extracting`?
4. Pattern C's voice-variant: does Sarvam expose slow-rate voices, or are we authoring SSML? Affects feasibility.
5. Confidence-threshold values for Pattern A acknowledgment — needs a calibration pass on the existing extract corpus.

## Sources
- `docs/spikes/voice-ux-research/01-loop-audit.md`
- `docs/spikes/voice-ux-research/02-friction-inventory.md`
- `docs/spikes/voice-ux-research/03-competitive-scan.md`
- `docs/post-mvp-backlog.md` §25 (PR #21 closed-context)
