# Live smoke guide — 2026-08-02

**Why this exists.** Last completed live smoke was before session 24 (2026-07-04). Since then, three shipped trains have accumulated *unsmoked live surface*: the voice quick wins Q1–Q6 (session 24 — S1 tripped the daily cap and the pass never resumed), the W2 confirm-card ship #36+#38 (session 29 — merged and Convex-deployed, smoke owed since), and today's Convex prod deploy of #41 (bloodWorkMarkers). Vitest green ≠ live smoke (`feedback_ship_day_manual_smoke.md`).

**Where:** `https://www.meetsaha.com` on your phone (voice needs a real mic; the confirm cards need real tap targets).
**Time:** ~30–40 min. Do it in order — the voice section consumes extract-cap budget (30/day), so the scripted scenarios come before free play.

**Not live yet — do NOT test, don't false-flag:**
- **Known bug you WILL see:** in voice *follow-up* turns, "Switch to taps" sits on top of "Tap when done" — no visible stop button. That's housekeeping #17; the fix is PR #44, not merged. Stop by tapping the orb instead.
- Voice recovery narration / "let me try again" retry button (Pattern B+D) — PR #45, not merged.

Check off with ✅/❌ + a one-line note. Anything ❌ → screenshot + what you said/tapped.

---

## A. Voice loop — quick wins Q1–Q6 (shipped session 24, smoke never completed)

- [ ] **A1 — Happy path, 5 metrics.** Start a voice check-in, answer all metrics normally (pain, energy, mood, sleep, flare).
  - **Hear:** a short receipt line ("Got it — pain at four.") bundled into the *start* of each next question — one continuous utterance, **no doubled or cut-off audio**.
  - **See:** Stage 2 (tap form) prefilled with everything you said. This was the unconfirmed checkpoint from the S1 cap-trip.
  - **See:** the check-in saves and shows on Home/Journey.
- [ ] **A2 — Boundary value.** In a fresh or continued flow, answer "pain is ten" (or one).
  - **Hear:** the next question with **NO receipt line** — high/low pain and energy deliberately get no ack (policy: never sound approving about a 10).
- [ ] **A3 — Decline.** Answer one metric with "skip that."
  - **Hear:** "That's fine — skipping [metric] today." (new copy; old copy was a curt "OK, skipping X.")
- [ ] **A4 — Give-up path.** Answer one metric with garbage twice (hum, cough, gibberish).
  - **Hear:** attempt 2 is the apologetic re-ask ("Sorry, I missed that…"), then a spoken give-up line: "Couldn't quite get that — I'll leave [metric] for the form at the end."
  - **See:** in Stage 2 that metric is **empty/missing — NOT auto-filled as declined**. (The old bug silently saved it as declined.)
- [ ] **A5 — Mic denied.** Load the check-in with mic permission blocked (or deny the prompt).
  - **See:** a plain-language error card that owns the failure and points at taps; the debug slug is a small detail line, not the headline. "Switch to taps" works.

## B. Confirm cards — W2 ship #38 (merged + Convex-deployed session 29, never smoked)

Trigger cards by *mentioning events in the freeform part* of a check-in (voice or type).

- [ ] **B1 — Dose change, the prod-bug proof.** Say/type something like "the doctor increased my methotrexate to 15 mg."
  - **See:** dose-change card → **Save** → card collapses to a status row with an **Undo** chip → tap **Undo** → card returns → **Save** again → sticks.
  - This end-to-end proves the #38 fix — before it, every voice dose-change Save threw `checkin_id_required` and could never succeed.
- [ ] **B2 — Visit card.** Mention "I saw Dr. Sharma on Tuesday."
  - **See:** visit card → Save → Undo works. Then dismiss one with **Not now** → an Undo chip appears (dismiss is now recoverable — old behavior was gone-forever).
- [ ] **B3 — Blood-work card.** Mention "got blood work done, CRP was 12."
  - **See:** blood-work card, Save lands; entry appears on `/blood-work`.
- [ ] **B4 — Grouped stack (N≥4).** In one check-in mention 4+ events (e.g. a dose change + 2 visits + blood work).
  - **See:** cards collapse into **grouped rows with a "Save all"** action instead of a 4-deep stack; expanding one keeps your edits.
- [ ] **B5 — Palette eyeball.** Walk the whole check-in flow: sage/cream token palette everywhere, no stray zinc-gray/teal remnants — **except the orb, which is intentionally still teal** (hero element, your call).

## C. Today's deploy — #41 bloodWorkMarkers (schema + backfill)

- [ ] **C1 — New entry dual-writes.** After B3 (or log one at `/blood-work`), tell Claude — verification is CLI-side: the entry's markers should appear as rows in the new `bloodWorkMarkers` prod table with canonical names.
- [ ] **C2 — Nothing user-visible changed.** `/blood-work` and Journey render exactly as before (the embedded array is still the read source). Any visual difference here is a ❌.

*(Backfill of pre-existing prod rows is run by Claude right after the deploy — `migrations:backfillBloodWorkMarkers --prod` — and verified from the CLI; nothing for you to do in-app.)*

## D. Continuity — upcomingEvent (W2-2, deployed session 29, never smoked)

- [ ] **D1 (optional).** Log a doctor visit dated **tomorrow**, then reload the check-in.
  - **Hear/see:** the greeting references "Your doctor tomorrow" — generic wording, **never a doctor name**. Visits dated any other day: no mention.

## E. Telemetry spot-check — #46 (merged session 32, live via auto-promote)

- [ ] **E1 (Claude verifies, you just smoke).** After your voice session, the new `voice_*` events (`session_outcome`, TTS-failure events, re-ask/give-up counters) should show in PostHog with your distinct_id. Flag to Claude when you're done smoking and it gets checked from the dashboard/API side.

---

**When done:** report the checklist. ❌ items get triaged before the PR review pass (#44 → #45 → #37, then #39/#43 OQs, then auth D/F/G).
