# Voice humanness assessment — Saha daily check-in (2026-07-04)

Scope: how human the shipped voice check-in feels **today** on prod (Sarvam STT `saaras:v3` + Sarvam TTS `bulbul:v2`/`anushka`, 19-state conversational loop), and what moves the needle most.

Builds on the four T1–T4 research docs at `docs/spikes/voice-ux-research/` (loop audit, friction inventory, competitive scan, target patterns A–D). This doc does not re-derive them; it re-verifies their claims against the tree as of `613a18a` (which includes today's `d2ba1e3` extract-failure fix) and scores the experience. All file:line citations below were re-checked today.

---

## 1. Overall humanness score: 4.5/10

The raw material is better than the score suggests: the line catalogs are short, plain-spoken, and continuity-aware (11 openers keyed to yesterday/streak/flare, `lib/saha/opener-engine.ts:11-25`), the voice itself is a decent Indian-English female voice (`anushka` on `bulbul:v2`, `lib/voice/sarvam-tts-server.ts:32-33`), and as of today failures finally get honest copy instead of silence (`lib/checkin/extract-failure.ts:47-60`). What caps the score is that the loop never once performs the three behaviors that most define a human listener: it **never reflects back anything the user said** (no "got it, pain at 7" exists anywhere in the TTS path — the only acknowledgments are decline-acks at `app/check-in/page.tsx:1078-1079` and a terminal "Saved."), it **cannot be interrupted or corrected** (mic is never armed while Saha speaks; the answer loop is forward-only with no redo), and every turn ends in **2.5–5 s of unexplained dead air** while three sequential POSTs (transcribe → extract → speak) run with no receipt signal. Wysa's 4.9★ evidence (T3) says the humanness lever is acknowledgment shape, not prosody — and acknowledgment is precisely the dimension where Saha currently scores lowest. A 4.5: a polite, well-written form that talks, not yet a listener.

---

## 2. Dimension-by-dimension

### 2a. Turn-taking & latency — 4/10

**End-of-turn detection is a fixed 1.5 s silence timer, energy-only.** The recorder fires `onSilence` after 6 consecutive silent 250 ms chunks below RMS 0.01, once speech ≥ RMS 0.02 has been heard (`lib/voice/sarvam-recorder.ts:52-55`, `:344-377`). No prosody, no pitch-contour, no "is the sentence grammatically open" signal. For a user in pain who pauses mid-sentence to gather a thought, 1.5 s is tight — this is the exact failure mode ChatGPT Advanced Voice is pilloried for (T3), just with a slightly longer fuse.

**The post-turn round-trip is three fully sequential POSTs:**

1. **STT** — audio is buffered client-side and uploaded only on `stop()` (buffered-only mode, T2 F-04 still current); `/api/transcribe` proxies to Sarvam REST batch (`app/api/transcribe/route.ts:33-37` — 1 MB / 30 s caps), model `saaras:v3` (`lib/voice/sarvam-stt-rest.ts:36`).
2. **Extract** — only after the final transcript resolves does the `processing` effect fire `extractMetrics` (`app/check-in/page.tsx:834-852`), an LLM call.
3. **TTS** — only after extraction picks the next missing metric does `speaking-question` POST `/api/speak`, which itself buffers the **entire** WAV from Sarvam before returning a byte (`app/api/speak/route.ts:150-163` — "we don't stream chunk-by-chunk").

Between the user's last word and Saha's next one: 1.5 s VAD + upload + STT + LLM + TTS synth + full download. T3 measured ~2–3 s on Wi-Fi; slow networks stretch it with zero feedback (the orb spins, nothing indicates upload even started — F-04).

**What can parallelize but doesn't:** the follow-up questions are a *locked catalog of 22 strings* (`lib/saha/follow-up-variants.ts:42-62`). Their audio is 100% precomputable — prefetched at session start (or server-cached; Sarvam even exposes `enable_cached_responses` beta for bulbul:v2 per the SDK's `TextToSpeechRequest.d.ts`), the third POST leaves the critical path entirely. The opener is likewise known at mount time and could synthesize during the permission grant.

**What a human does differently:** signals receipt within ~200 ms ("mm-hm") even while formulating a reply, and lets a pause breathe when the sentence is clearly unfinished. Saha gives silence, then a question.

### 2b. Feeling heard / acknowledgment — 3/10

The #1 gap, exactly as T4 concluded. Verified in today's tree:

- **No captured value is ever spoken back.** The `extracting-answer` effect folds the value into state and dispatches `ANSWER_EXTRACTED` (`app/check-in/page.tsx:1095-1101`); the answer-loop driver (`:1127-1131`) then asks the *next* question. The user says "pain's about a seven today" and hears… "And your energy today, 1 to 10?" The only proof anyone was listening arrives minutes later as text on the Confirm screen.
- **The only mid-loop acknowledgments are decline-acks** — "OK, skipping pain." spoken via `tts.speak(ack.text)` at `app/check-in/page.tsx:1078-1079`. Saha acknowledges you *refusing* to share, but never acknowledges you sharing.
- **Silent auto-decline is an active anti-heard moment.** After two unparsed answers, the metric is declared declined with no TTS at all (`app/check-in/page.tsx:1102-1112` — `prev >= 1` → `ANSWER_EXTRACTED declined:true`, no ack line). The user answered twice, was understood zero times, and was told nothing. (Today's `d2ba1e3` fixed the *extraction-failure* flavor of this — see 2e — but a genuinely unparseable answer still silently vanishes.)
- The openers do reflect *yesterday* ("Yesterday was a rough one — how's today landing?", `lib/saha/variants.ts:99-104`) — real, and worth partial credit — but nothing said *within* the session is ever reflected within the session.

**What a human does differently:** restates before moving on — "a seven, ugh, okay" — which simultaneously confirms the value and earns the right to ask the next question. This is Pattern A verbatim, sized Small in T4, and it needs no harness.

### 2c. Language naturalness — 6/10

The strongest dimension. The catalogs were written under discipline (closers ≤ 8 words, `lib/saha/variants.ts:128`; saccharine phrases explicitly banned via `RULED_OUT_PHRASES` — "you're doing amazing", "stay strong" — `variants.ts:32-38`) and it shows.

**Reads as human:**
- "Morning, {n}. Yesterday was a rough one — how's today landing?" (`variants.ts:99-104`)
- "Is the flare still with you today, or easing up?" (`variants.ts:93-98`)
- "Saved. Today's its own day." / "Logged. I'm here." / "7 days. That's real." (`variants.ts:141-142,166-168`)
- "Hey — been a few days. How are things?" (`variants.ts:105-110`) — no guilt-trip, exactly right for a chronic-illness lapse.

**Reads as a form with a voice:**
- "Any flare today — yes, no, or still ongoing?" (`follow-up-variants.ts:48`) — reads the answer enum aloud, like an IVR menu.
- "And how are you feeling — heavy, flat, okay, bright, or great?" (`follow-up-variants.ts:45-46`) — five-way menu recital.
- "Sorry — flare today: yes, no, or ongoing?" (`follow-up-variants.ts:60`) — the re-asks get *more* telegraphic under failure, when a human gets more natural.
- "OK, skipping medication." (`follow-up-variants.ts:79`) — a system logging a command, not a person letting something go.

The enum-reading is partly deliberate (constrain answers for the extractor), but the extractor is an LLM (`lib/checkin/extract-prompt.ts`) that parses freeform answers anyway — the menus are over-insurance on attempt 1. Keeping them for attempt-2 re-asks (when parsing already failed once) is the defensible split.

**What a human does differently:** asks the question, not the schema — "anything flaring today?" — and only spells out options when the first answer didn't land.

### 2d. Sarvam voice & prosody + pace control — 5/10

**What's pinned:** speaker `anushka`, model `bulbul:v2`, env-overridable via `SARVAM_TTS_SPEAKER` / `SARVAM_TTS_MODEL` (`lib/voice/sarvam-tts-server.ts:32-33,85-86`). Language `en-IN` throughout (`lib/voice/provider.ts` DEFAULT_LANGUAGE_CODE). The `/api/speak` route accepts an optional per-request `voice` (`app/api/speak/route.ts:35-39`) but the client adapter is constructed without one, so prod always speaks `anushka`.

**What Sarvam supports vs. what we pass — this answers T4 open question #4:** `bulbul:v2` supports `pace` 0.3–3.0, `pitch` −0.75–0.75, `loudness` 0.3–3.0, all plain request fields, **no SSML needed** (verified in `node_modules/sarvamai/dist/cjs/api/resources/textToSpeech/client/requests/TextToSpeechRequest.d.ts` — pitch/loudness are v2-only; the newer `bulbul:v3` keeps `pace` 0.5–2.0, adds `temperature` + 30+ voices, drops pitch/loudness). Our `synthesize()` passes exactly four fields — text, language, speaker, model (`lib/voice/sarvam-tts-server.ts:94-99`) — so **every utterance ships at default pace 1.0, pitch 0, loudness 1.0, forever**. Pattern C is therefore *feasible today* with a small plumb: add `pace?` to `SynthesizeArgs` → route body → `SarvamTtsAdapter` opts. The blocker T4 worried about (SSML authoring) does not exist.

**Prosodic behavior:** none. The same chipper-neutral delivery greets a streak-day-30 user and a user whose yesterday logged pain 9. The continuity engine already knows which is which (`yesterday.isRoughDay`, `convex/continuity.ts:128-131`) — the signal is computed and then thrown away at the voice layer.

**What a human does differently:** drops ~15% pace and softens when the person they're greeting had a visibly bad day. One `pace: 0.85` conditional away.

### 2e. Error-recovery humanness — 5/10 (up from ~3 yesterday)

**What `d2ba1e3` fixed today — real improvement, credited:**
- Failure classes are now distinguished: `classifyExtractError` splits daily-cap 429 from transient (`lib/checkin/extract-failure.ts:23-25`).
- The answer loop **no longer auto-declines metrics on our failures** — a daily-cap error bails to taps on the first hit, transient gets one re-ask then bails; captured metrics carry over, unanswered ones stay *missing*, never falsely "declined" (`extract-failure.ts:35-41`; wired at `app/check-in/page.tsx:1050-1067`).
- Stage 2 now shows an honest notice: "…a technical hiccup on our side, not you…" (`extract-failure.ts:47-60`, rendered at `app/check-in/page.tsx:1317-1321`, `components/check-in/Stage2.tsx:85-91`). Blame-absorption ("not you") is exactly the Wysa lesson (T3).

**What still fails silently or coldly:**
- **TTS rejects are collapsed into success.** A failed question or closer synthesis dispatches `QUESTION_PLAYED` / `CLOSER_PLAYED` (`app/check-in/page.tsx:988-994,1013-1019`); a failed opener degrades to `listening` (`:940-955`). Saha goes mute mid-conversation and never says — or shows — why. The captioned text is the only fallback.
- **STT and mic errors land on a generic card with a debug slug.** `ErrorSlot` renders "Something got in the way." plus the raw error kind in monospace — `permission-denied`, `no-speech` — as user-facing copy (`components/check-in/ErrorSlot.tsx:53-58`). A chronically ill user mid-check-in is shown a slug.
- **Unknown server voice codes still collapse to `network`** (T2 F-03, `lib/voice/sarvam-adapter.ts` parseErrorPayload — unchanged).
- **Nothing is ever *spoken* about a failure.** The audit's finding stands: "No TTS for errors" (`01-loop-audit.md:80`). Full Pattern B narration ("I'm having trouble — want me to ask one at a time, or switch to taps?") remains correctly gated on the A2 e2e harness, per the PR #21 postmortem.

**What a human does differently:** narrates their own failure in the same channel the conversation was happening in — out loud, at the moment it happens, with a choice about what to do next.

### 2f. Barge-in & redo — 2/10

The weakest dimension, unchanged since the audit:

- **No barge-in.** The mic is never armed while Saha speaks (`01-loop-audit.md:89`; STT arms only at cold tap, auto-progress, and `listening-answer` re-entry — `lib/checkin/state-machine.ts:917-935`). During `speaking-question`/`speaking-closer` the reducer *ignores* `TAP_ORB` outright. The single interrupt that exists: tapping the orb during the cold-mount greeting cancels it via effect cleanup (`app/check-in/page.tsx:940-958` cleanup + `01-loop-audit.md:88`). A day-40 user who knows the questions by heart must sit through each one, every day.
- **No redo.** The loop is forward-only (`01-loop-audit.md:87` — "No way to say 'go back to the previous metric'"). No `REDO_METRIC` event exists in `lib/checkin/state-machine.ts`. If Saha mis-hears "one" as "seven", the user's only voice-path options are: finish the loop and fix it by tap on the Confirm screen, or `SwitchToTapsButton` — which abandons voice entirely (bail is one-way by design, ADR-026 B3).
- The decline detector (`lib/saha/decline-detector.ts:20-21`) matches skip/pass/don't-know — there is no intent vocabulary at all for "wait", "that's wrong", "say that again". Pattern D territory, untouched.

**What a human does differently:** stops talking the instant you inhale to speak, and treats "wait, no—" as the most important utterance in the conversation.

### 2g. Cross-day continuity — 5/10

**What genuinely works:** day 30 *does* open differently from day 1. The continuity engine computes yesterday's row, streak, flare-run, and days-skipped from a 30-day window (`convex/continuity.ts:100-145`), and the opener engine walks an 11-rule priority ladder (`lib/saha/opener-engine.ts:11-25`): rough-yesterday, good-yesterday, flare-ongoing (with a 5-day cap so a long flare stops being mentioned daily — a genuinely humane touch, `variants.ts:83-92`), multi-day-skip, streak milestones at 7/30/90/180/365 (`opener-engine.ts:44,97`). Closers pair with openers (ADR-009). The flare follow-up shifts tone when a flare is ongoing ("still ongoing, or different?", `follow-up-variants.ts:52-53`).

**Where day 40 collapses back into day 1:**
- **The five follow-up questions are word-for-word identical forever.** One tone variant exists in the entire follow-up catalog (flare-ongoing). "How's the pain today on a 1 to 10?" on day 1 and day 400.
- **Milestone days are the only variance in a streak** — days 8–29 all get `neutral-default`.
- **`upcomingEvent` is always `null`** — the doctor-visit and blood-test openers (the two most "a friend would remember this" lines in the catalog, including a hardcoded "Dr. Mehta") are dead code until F08 ships an events store (`convex/continuity.ts:12-14`, `variants.ts:71-82`).
- **No trend memory.** The engine sees single-day deltas only; "pain's been easing all week" is unrepresentable in `ContinuityState`.

**What a human friend does differently by day 30:** compresses the ritual ("usual three? pain, meds, energy—") and remembers direction, not just yesterday ("third good day in a row, no?").

---

## 3. Line rewrites

Four shipped lines that read most robotic, rewritten in Saha's register (warm, plain, brief — brevity IS warmth on day 40):

**1. `lib/saha/follow-up-variants.ts:77-81`** — `"OK, skipping pain."` (and its four siblings)
> Rewrite: **"That's fine — skipping pain today."**
> Principle: a decline-ack should grant permission, not log a command; "OK, skipping X" is a system confirming input, "that's fine" is a person letting it go.

**2. `lib/saha/follow-up-variants.ts:48`** — `"Any flare today — yes, no, or still ongoing?"`
> Rewrite: **"Anything flaring today?"** (keep the enum recital only in the attempt-2 re-ask, where parsing has actually failed once)
> Principle: the LLM extractor already parses freeform answers, so reading the answer schema aloud on attempt 1 turns a question into an IVR menu for no reliability gain.

**3. `lib/saha/follow-up-variants.ts:60`** — `"Sorry — flare today: yes, no, or ongoing?"`
> Rewrite: **"Sorry, I missed that — was there a flare today? Yes, no, or ongoing."**
> Principle: re-asks are Saha's failure, not the user's, so the retry should get *more* human ("I missed that"), not compress into colon-delimited telegraphese that sounds like impatience.

**4. `lib/checkin/extract-failure.ts:49-53`** — `"Saha has hit today's limit for understanding answers with AI, so voice capture is paused until tomorrow. Nothing you said is lost — finish today's check-in with the taps below."`
> Rewrite: **"I've hit today's limit for understanding voice answers — that's back tomorrow. Nothing you said is lost; finish below with taps."**
> Principle: Saha speaks as "I" everywhere else ("Logged. I'm here.") — third-person self-reference plus the mechanism reveal ("with AI") breaks register exactly at the moment trust is most fragile.

---

## 4. Prioritized roadmap

### Quick wins (days — shippable now, no harness dependency)

| # | Change | Pattern | Size |
|---|--------|---------|------|
| Q1 | **Pattern A acknowledgments** — new locked `ACK_VARIANTS` catalog ("Got it, pain at 7."); bundle the ack *into the next question's TTS call* ("Got it, pain at 7. And your energy today, 1 to 10?") so it costs zero extra POSTs and zero extra latency. Guard with the T4 confidence caveat (skip ack at boundary values 9–10 / 1). Hook point: the `ASK_QUESTION` dispatches at `app/check-in/page.tsx:893-901` and `:1127-1150`. | A | S |
| Q2 | **Plumb `pace` through the TTS stack** — `SynthesizeArgs` → `/api/speak` body → `SarvamTtsAdapter` opts (`lib/voice/sarvam-tts-server.ts:94-99` currently drops it). No behavior change yet; this de-risks Pattern C to a one-line conditional later. | C (enabler) | S |
| Q3 | **Prefetch/caches the 22 catalog question audios** at session start (or evaluate Sarvam `enable_cached_responses` beta), removing the TTS POST from the mid-loop silence gap. | — (latency) | M |
| Q4 | **Speak the silent auto-decline** — the `prev >= 1` give-up path at `app/check-in/page.tsx:1102-1112` gets a spoken line ("Couldn't quite get that — I'll leave pain for the form at the end.") before advancing. Kills the worst anti-heard moment. | B (spirit) | S |
| Q5 | **Per-kind plain-language copy in `ErrorSlot`** — map `permission-denied`/`no-speech`/`network` to sentences; demote the slug to a details line (`components/check-in/ErrorSlot.tsx:53-58`). | — | S |
| Q6 | **Catalog polish** per §3 rewrites (catalog-locked, reviewer pass per existing discipline). | — | S |

### Medium (needs the A2 e2e harness or a design decision)

| # | Change | Pattern | Size |
|---|--------|---------|------|
| M1 | **Full graceful-failure narration** — spoken "I'm having trouble — want me to ask one at a time, or switch to taps?" with a choice state. Hard-gated on A2 harness (PR #21 postmortem: vitest green ≠ mic re-arms live). `d2ba1e3` is the interim slice; this completes it. | B | M |
| M2 | **Per-metric redo** — tap-only `RedoMetricButton` first (`REDO_METRIC` event, `extracting-answer → speaking-question` same-metric); voice intent ("wait", "try again") later, after resolving collision with `detectDecline` ("pass"/"skip" vs "wait"). Design decision: intent vocabulary. | D | M |
| M3 | **Pre-flight tone adaptation** — if `yesterday.isRoughDay` (already computed, `convex/continuity.ts:128-131`), send `pace: 0.85` on opener + questions for that session. Depends on Q2. Design decision: apply-once-at-mount scoping per T4's patronization risk. | C | M |
| M4 | **Skip-TTS barge-in (lightweight)** — during `speaking-question`, make orb tap cancel TTS and jump to `listening-answer` (reducer currently ignores `TAP_ORB` there). Not acoustic barge-in — no echo-cancellation risk — just "let the day-40 user skip the question she knows by heart." Needs A2 to verify re-arm on this new entry path. | D (adjacent) | M |

### Research-needed

| # | Question | Size |
|---|----------|------|
| R1 | **LLM-dynamic vs locked-catalog acks** (T4 open Q2) — dynamic phrasing costs extract-budget (ADR-020 daily cap!), latency, and auditability; the locked catalog costs eventual staleness. Recommendation to investigate: locked catalog with N≥3 variants per metric, shuffled — dynamic only post-pricing. | M |
| R2 | **Prosody-informed end-of-turn** — RMS-slope + pitch-fall heuristic vs today's flat 1.5 s timer (`sarvam-recorder.ts:52-55`), for slow/pained speakers. Hume demonstrates the ceiling; a spike should establish the floor. | M/L |
| R3 | **`bulbul:v3` evaluation** — 30+ voices + `temperature` expressiveness control, but drops pitch/loudness (SDK `TextToSpeechRequest.d.ts`). Is any v3 voice warmer than `anushka` at v2 defaults? One afternoon of A/B listening. | S |
| R4 | **~~Sarvam pace-control feasibility~~** — **answered by this assessment**: v2 supports `pace`/`pitch`/`loudness` as plain request fields, no SSML. Closed. | — |

**Highest leverage per unit effort: Q1 (Pattern A acknowledgments).** It is Small, has zero harness dependency, attacks the lowest-weighted-dimension-that-matters (feeling heard, 3/10), *and* — bundled into the existing question TTS call — converts the dead-air gap of 2a into perceived responsiveness without adding a single network round-trip. T4 reached the same conclusion; today's code read confirms nothing has shipped against it and the hook points are unchanged. Estimated effect: +1.5 on the overall score by itself.

---

## 5. What NOT to do

**1. Longer, chattier lines.** The temptation after reading "3/10 feeling heard" is to add words ("Thank you so much for sharing that with me, I've noted your pain at…"). Wrong lever. This user does the flow *daily, while fatigued*; every added second compounds across 365 check-ins, and T3's Pi analysis shows deliberate-pace companionship is the wrong trade for a task with an end state. The existing ≤8-word closer discipline (`variants.ts:128`) is an asset — extend it to acks, don't relax it. Brevity is the warmth on day 40.

**2. Fake filler and fake thinking sounds.** Simulated "hmm…", breathing, or typing sounds to paper over the 2.5–5 s gap would borrow humanness the system hasn't earned — Replika's hollow voice-note gesture is the cautionary tale (T3: acknowledgment gestures without comprehension read as *more* robotic, not less). In a health tool, performed empathy also erodes the trust that the honest failure copy (`extract-failure.ts:56-59` — "our side, not you") just started building. Fix the gap (Q3) or fill it with *real* information (Q1's ack); never fill it with theater.

**3. Effusive validation / agreement-glow.** "You're doing amazing" is already in `RULED_OUT_PHRASES` (`variants.ts:32-38`) — keep it there, and resist the adjacent temptation of warm-toned *confirmation bias*: an ack line must never sound approving of the value itself ("Great, pain at 3!" makes "…pain at 9" unspeakable in the same voice). ChatGPT's glow-of-approval problem (T3) is actively dangerous where a mis-affirmed number becomes a clinical record the user shows Dr. Mehta. Acks should be neutral-warm receipts: "Got it." — full stop.
