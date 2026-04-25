# Voice — Cycle 1 (Conversational, Sarvam STT + TTS) Build Plan

> **For agentic workers:** This plan follows the **Project Process Playbook** (`~/.claude/projects/-Users-rewantprakash_1/memory/reference_project_process.md`) — scoping ✓ → pre-flight → parallel build subagents → parallel review subagents → fix → second pass → ship. Steps inside each chunk follow TDD inside the subagent.
>
> **Branch:** `feat/voice-sarvam` off `main` (post `f01-c2/shipped` squash-merge `a5361ed`)
> **Created:** 2026-04-25 · **Owner:** orchestrator (Claude Code main)
> **Scoping status:** Architecture locked 2026-04-25 in `~/.claude/projects/-Users-rewantprakash_1/memory/project_sakhi_voice_sarvam.md` (STT path) + this doc (TTS + multi-turn dialog + bail-to-taps).
> **Cycle position:** Originally "Cycle 4 / 5" (voice + save-later) in the 6-cycle plan. Pulled forward by Rewant 2026-04-25 with conversational scope. F02 pre-cycle 2.0 (auth) and F02 C2 follow this cycle.

**Goal:** Ship a voice-first, multi-turn conversational check-in. Saha speaks the opener (Sarvam TTS), listens to the freeform reply (Sarvam STT), extracts as many of the 5 metrics as possible from the transcript, and then **speaks a follow-up question for each remaining metric** (Sarvam TTS) → listens for the answer (Sarvam STT) → repeats until covered or declined. Every screen during the dialog shows a single **"Switch to taps"** affordance that bails to the existing Stage 2 grid with the partial-metrics state preserved. Web Speech remains as the dev/test fallback for both STT and TTS.

**Architecture (STT):** Browser captures audio with `MediaRecorder` → POSTs to a Vercel HTTP-streaming proxy at `/api/transcribe` → server holds a Sarvam WebSocket via the `sarvamai` SDK → partial transcripts pipe back as Server-Sent Events. Adapter implements the existing `VoiceProvider` interface so the page wiring barely changes.

**Architecture (TTS):** Browser POSTs `{ text, language_code }` to `/api/speak` → server calls the `sarvamai` TTS endpoint → server pipes audio bytes back as a streaming response → adapter plays via `<audio>` (`MediaSource` if streaming-decode is supported, otherwise blob playback). Adapter implements a new `TtsProvider` interface that the existing `tts-adapter.ts` (Web Speech) is refactored to satisfy.

**Architecture (Dialog):** Existing check-in state machine extends with five new states (`speaking-opener`, `speaking-question`, `listening-answer`, `extracting-answer`, `speaking-closer`) and seven new events (`OPENER_PLAYED`, `ASK_QUESTION`, `QUESTION_PLAYED`, `ANSWER_TRANSCRIBED`, `ANSWER_EXTRACTED`, `BAIL_TO_TAPS`, `CLOSER_PLAYED`). The page orchestrates the loop; a new `selectFollowUpQuestion(metric, continuityState)` rules engine produces the prompt copy for each missing metric.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 strict · Convex 1.36 · Tailwind 4 · Vitest · `sarvamai` JS SDK · Server-Sent Events for STT partials · streaming `Response` body for TTS audio · Web Speech (STT + TTS) retained as fallback.

---

## Resume tags

| Tag | What's in the tree |
|---|---|
| `voice-c1/plan-saved` | This file committed. Nothing built. |
| `voice-c1/pre-flight-done` | ADR-025 written, SDKs installed, env scaffolded, audio-format spike done, TTS-format spike done, provider seams extended (STT + TTS), state-machine union extended, build green. |
| `voice-c1/wave-1-integrated` | V.A (STT route) + V.B (STT adapter) + V.C (TTS route + adapter) + V.D (follow-up engine) merged. Tests + tsc + build green. |
| `voice-c1/wave-2-integrated` | Page rewired for multi-turn dialog + bail-out + closer TTS; state-machine transitions implemented. |
| `voice-c1/reviewed` | First-pass review findings collected (read-only). |
| `voice-c1/fixed` | Fix pass applied, all green. |
| `voice-c1/second-pass-clean` | Second reviewer returned clean. |
| `voice-c1/shipped` | ADR-018 superseded by ADR-025; changelog + system-map + build-log updated; Vercel envs set; live conversational check-in verified on a deployed preview. |

A phase entry is appended to `docs/build-log.md` at every tag.

---

## Context — what's shipped on `main` vs what this cycle delivers

### Shipped on `main` (post `a5361ed`)
- **Voice (STT):** `lib/voice/web-speech-adapter.ts` (en-IN), `lib/voice/openai-realtime-adapter.ts` stub, `lib/voice/provider.ts` resolver, `lib/voice/types.ts` (`VoiceProvider`, `VoiceError`, `VoiceProviderName`).
- **Voice (TTS):** `lib/voice/tts-adapter.ts` exporting `createTtsAdapter()` + `isTtsAvailable()` + `TtsAdapter` interface (Web Speech `speechSynthesis`).
- **Saha engine:** `lib/saha/opener-engine.ts`, `closer-engine.ts`, `variants.ts` (locked variant catalog).
- **Check-in logic:** `lib/checkin/extract-metrics.ts`, `extract-prompt.ts`, `coverage.ts`, `state-machine.ts` (idle → listening → processing → extracting → stage-2 → confirming → saving → saved → celebrating).
- **Convex:** `continuity.ts` (`getContinuityState`), `checkIns.ts` (`createCheckin`, `listCheckins`, `getCheckin`, `getTodayCheckin`), `extractAttempts.ts` (cost guard).
- **Components:** `Stage2.tsx`, `Stage2Recap.tsx`, `MissingMetricList.tsx`, `TapInput.tsx`, `ConfirmSummary.tsx`, `Closer.tsx`, `SpokenOpener.tsx`, `MilestoneCelebration.tsx`, `Day1Tutorial.tsx`, etc.
- **Routes:** `app/check-in/page.tsx`, `app/check-in/saved/page.tsx`, `app/api/check-in/extract/route.ts`.

### This cycle delivers
| Deliverable | Chunk |
|---|---|
| Vercel HTTP-streaming proxy at `/api/transcribe` (STT) | V.A |
| `sarvamai` STT SDK invocation server-side, `SARVAM_API_KEY` never reaches browser | V.A |
| SSE partials piped back to browser | V.A |
| `lib/voice/sarvam-adapter.ts` implements `VoiceProvider` | V.B |
| `MediaRecorder` chunked upload via streaming `fetch` body | V.B |
| `EventSource`-style partial consumption in adapter | V.B |
| `language_code` constructor arg flowing to Sarvam connect call | V.B |
| Vercel route at `/api/speak` (TTS) — Sarvam TTS proxy with audio streaming | V.C |
| `lib/voice/sarvam-tts-adapter.ts` implements new `TtsProvider` interface | V.C |
| Existing `tts-adapter.ts` refactored to satisfy `TtsProvider`, becomes `web-speech-tts-adapter.ts` | V.C |
| TTS resolver picks Sarvam vs Web Speech via `VOICE_TTS_PROVIDER` env flag | V.C |
| `lib/saha/follow-up-engine.ts` — `selectFollowUpQuestion(metric, continuityState)` returns variant + text | V.D |
| `lib/saha/follow-up-variants.ts` — locked per-metric question + decline-acknowledgement copy | V.D |
| State-machine extension for multi-turn dialog (orchestrator pre-flight) | Task 0 |
| Page-level multi-turn loop in `app/check-in/page.tsx` (orchestrator integration) | Task 2 |
| `<SwitchToTapsButton>` affordance always visible during voice dialog | Task 2 |
| ADR-025 superseding ADR-018 on Sarvam deferral | Task 0 |

### Out of scope (deferred)
- Hindi or other Indic languages at runtime — adapter takes `language_code: 'en-IN'` for MVP. Multilingual surfaces (string resources, PDF language param) are F03+ concerns.
- Removing `OpenAIRealtimeAdapter` stub. Leave; cheap to keep.
- WebRTC transport (Sarvam supports it). HTTP-streaming + SSE is enough for MVP.
- Auth enforcement (ADR-019 — F02 pre-cycle 2.0).
- Voice barge-in / full-duplex. Multi-turn means strict turn-taking: Saha speaks, then listens; user speaks, then waits. (Option C from scoping was rejected.)
- Save-later offline queue retry on background. C2 ships the queue; this cycle doesn't change it.
- Day-1 tutorial copy rewrite for conversational mode. Day 1 keeps existing `Day1Tutorial` overlay; opener gets a conversational-aware Day-1 line via the existing variant catalog (`first-ever`).

---

## Locked decisions — do NOT re-litigate

### Provider + transport
- **Streaming, not REST batch.** Live partials under the orb is a UX requirement.
- **Server-side proxy, not browser-direct.** Sarvam doesn't expose ephemeral tokens. Long-lived `api-subscription-key` MUST stay server-only.
- **Vercel HTTP-streaming + SSE for STT.** Vercel doesn't terminate WebSockets at the function layer. Stay on one platform.
- **Vercel streaming `Response` body for TTS audio.** Server proxies Sarvam TTS; client `<audio>` plays via blob (MVP) or `MediaSource` (if pre-flight spike confirms streaming decode).
- **`sarvamai` JS SDK, not raw WebSocket.** SDK abstracts auth/protocol.
- **Model `saaras:v3` (STT).** 23-language readiness, future-proof. `saarika:v2.5` is the Indic-only alternative; v3 wins for multilingual.
- **`high_vad_sensitivity: "true"` (STT).** Suits short paused-out check-in speech.
- **Sarvam TTS model:** TBD in pre-flight spike — pick the lowest-latency Indic-friendly voice that supports `en-IN` + has a Hindi voice in the same family for future. Locked once spike completes.
- **`language_code` is mandatory.** Both STT and TTS adapters accept it as a constructor arg, not a default constant. Tests assert flow-through.
- **`VOICE_PROVIDER` (STT) + `VOICE_TTS_PROVIDER` (TTS) env flags pick adapters.** Both default to `web-speech` so tests + dev keep running offline. `sarvam` for production preview/prod once shipped. No runtime user toggle.
- **`SARVAM_API_KEY` server-only.** Never `NEXT_PUBLIC_*`. Vercel Production + Preview only.
- **Web Speech stays installed for both STT and TTS.** Removal is a separate decision.

### Conversational dialog shape
- **Strict turn-taking.** No barge-in. While Saha speaks, the mic is closed. While the user speaks, TTS is silent.
- **Voice-first with single bail-out.** A persistent `<SwitchToTapsButton>` is visible during every voice state (`speaking-opener`, `listening` (freeform), `speaking-question`, `listening-answer`). Tapping cancels in-flight TTS + STT and transitions to the existing `stage-2` state with the partial `metrics` / `missing` / `declined` preserved. **Cannot return to voice mode from `stage-2` in this cycle** (forward-only — keeps the state machine tractable).
- **Question order = scoping order.** `pain → mood → adherenceTaken → flare → energy`, skipping any already covered. Same order as `Stage2`'s `MissingMetricList`.
- **Per-question extraction reuses `extractMetrics`.** Single-question answers are short transcripts ("a 7", "I felt flat", "skip"); the existing extractor handles them. The follow-up loop reads only the asked-about metric from the result; other-metric updates from a per-question answer also stick (an unprompted "and my pain was 5" gets captured).
- **Decline detection.** If after a per-question turn the asked-about metric is still null in the extraction AND the answer transcript matches a small allowlist of decline phrases (`/skip|next|don'?t (want|know)|not sure|move on|pass/i`), the metric is added to `declined[]` and the loop advances. Anything else → re-ask once. Second non-answer → mark declined and advance.
- **No re-asking declined metrics.** Once declined, they stay declined unless the user later taps to correct on the ConfirmSummary (existing C2 behavior — unchanged).
- **Closer is spoken.** When entering `confirming`, the page kicks off Sarvam TTS for the closer. The user can interact with the ConfirmSummary while the closer plays. (No state-machine change for this — TTS plays alongside `confirming`.)
- **Day-1 conversational mode.** Day 1 = same opener (`first-ever` variant from the existing catalog) + same `Day1Tutorial` overlay rendered when bail-out lands in Stage 2. No conversational-specific Day-1 copy this cycle.
- **Same-day re-entry.** The `re-entry-same-day` opener variant ("Back again, Sonakshi — anything else?") plays via Sarvam TTS just like the first-time opener. If after the freeform reply nothing got captured (all metrics still null), the loop ends without follow-up questions and goes straight to a short closer.
- **Milestone celebration unchanged.** Celebration overlay still kicks off after `SAVE_OK` per C2's `MILESTONE_DETECTED` path. Closer TTS plays first; celebration replaces the orb screen after.

### Provider-seam extension protocol

`lib/voice/types.ts`, `lib/voice/provider.ts`, and `lib/voice/tts-adapter.ts` are touched by V.B (STT adapter), V.C (TTS adapter + resolver), and the Wave 2 page wiring. To prevent merge collisions, **orchestrator extends the seams during pre-flight** (Task 0):

1. `lib/voice/types.ts`:
   - `VoiceProviderName` extends to `'web-speech' | 'openai-realtime' | 'sarvam'`.
   - New `TtsProvider` interface added (parallel to `VoiceProvider`):

     ```typescript
     export interface TtsProvider {
       speak(text: string, opts?: TtsSpeakOptions): Promise<void>
       cancel(): void
       isAvailable(): boolean
     }
     export type TtsProviderName = 'web-speech' | 'sarvam'
     ```

   - The existing inline `TtsAdapter` interface in `tts-adapter.ts` becomes an alias for `TtsProvider` to keep C2 callers compiling.

2. `lib/voice/provider.ts`:
   - STT resolver gains `case 'sarvam'` returning a placeholder: `throw new Error('NotImplementedError: Sarvam STT — pending V.B')`.
   - New TTS resolver `getTtsProvider()` added with two branches: `web-speech` (delegates to `createTtsAdapter()` from refactored `web-speech-tts-adapter.ts`) and `sarvam` (placeholder: `throw new Error('NotImplementedError: Sarvam TTS — pending V.C')`).

3. Existing `lib/voice/tts-adapter.ts` is **renamed** to `lib/voice/web-speech-tts-adapter.ts` (orchestrator does this in pre-flight). A re-export shim is left at the old path until Wave 2 wires the resolver in (so C2's `SpokenOpener.tsx` import still resolves):

   ```typescript
   // lib/voice/tts-adapter.ts (re-export shim — delete in Wave 2)
   export * from './web-speech-tts-adapter'
   ```

4. `lib/checkin/state-machine.ts` extends with the five new states + seven new events from the Conversational Dialog section above. Pre-flight commits the union + no-op transitions; Wave 2 implements the transitions.

V.B and V.C and V.D each see the seam as existing and simply implement against it.

### State-machine extension protocol

The new states added to `State`:

```typescript
| { kind: 'speaking-opener'; text: string; variantKey: OpenerVariantKey }
| { kind: 'speaking-question'; metric: Metric; text: string; metrics: Partial<CheckinMetrics>; missing: Metric[]; declined: Metric[]; transcript: Transcript }
| { kind: 'listening-answer'; metric: Metric; partial: string; metrics: Partial<CheckinMetrics>; missing: Metric[]; declined: Metric[]; transcript: Transcript }
| { kind: 'extracting-answer'; metric: Metric; answerTranscript: Transcript; metrics: Partial<CheckinMetrics>; missing: Metric[]; declined: Metric[]; transcript: Transcript }
| { kind: 'speaking-closer'; text: string; metrics: CheckinMetrics; declined: Metric[]; stage: StageEnum; transcript: Transcript }
```

The new events:

```typescript
| { type: 'OPENER_PLAYED' }                                          // TTS finished opener → start freeform listening
| { type: 'OPENER_FAILED' }                                          // TTS error → degrade to silent text + start listening
| { type: 'ASK_QUESTION'; metric: Metric; text: string }             // page picks next missing metric, kicks TTS
| { type: 'QUESTION_PLAYED' }                                        // TTS finished question → start per-metric listening
| { type: 'ANSWER_TRANSCRIBED'; transcript: Transcript }             // STT done for per-question turn
| { type: 'ANSWER_EXTRACTED'; metrics: Partial<CheckinMetrics>; declined: boolean }  // page extracted; declined flag set if decline phrase detected
| { type: 'BAIL_TO_TAPS' }                                           // user tapped Switch-to-Taps from any voice state
| { type: 'CLOSER_PLAYED' }                                          // TTS finished closer → final SAVE_OK path resumes
```

Transition logic (implemented in pre-flight as no-ops; Wave 2 fleshes out):

- `idle + TAP_ORB` → continue to use existing `requesting-permission` path; permission grant transitions to **`speaking-opener`** instead of `listening` (orchestrator wiring decides which voice mode to enter — for MVP, always conversational).
- `speaking-opener + OPENER_PLAYED` → `listening` (existing freeform listening state, now reached via this path).
- `speaking-opener + OPENER_FAILED` → `listening` (silent fallback — opener text already on screen).
- `speaking-opener + BAIL_TO_TAPS` → `stage-2` with `metrics: {}`, `missing: ['pain','mood','adherenceTaken','flare','energy']`, `declined: []`, `transcript: { text: '', durationMs: 0 }`.
- `listening + BAIL_TO_TAPS` → `stage-2` with same empty payload.
- `extracting + ASK_QUESTION { metric, text }` → `speaking-question` (driven by page after first extraction lands).
- `speaking-question + QUESTION_PLAYED` → `listening-answer` for that metric.
- `speaking-question + BAIL_TO_TAPS` → `stage-2` with current metrics/missing/declined.
- `listening-answer + PROVIDER_STOPPED` → `extracting-answer`.
- `listening-answer + BAIL_TO_TAPS` → `stage-2`.
- `extracting-answer + ANSWER_EXTRACTED` → if metric covered or declined and `missing.length === 0` → `confirming` (with stage='hybrid'). Else if metric covered/declined and more missing → page dispatches `ASK_QUESTION` for next → `speaking-question`. Else (no extract, not declined) → page may re-ask once via `ASK_QUESTION` again with re-ask copy.
- `confirming + CONFIRM` → `speaking-closer` (TTS for closer text); on `CLOSER_PLAYED` → `saving` (existing path).
- `speaking-closer + CLOSER_PLAYED` → `saving`.
- `speaking-closer + BAIL_TO_TAPS` → `confirming` (the Stage 2 isn't the right destination here — bail in `speaking-closer` just cancels TTS and stays on the confirm screen; this case is rare since the user is already on confirm).

The reducer keeps "unknown event in state X = return state" for safety. Tests in pre-flight assert each transition above.

---

## Task 0: Pre-flight (orchestrator only, before dispatch)

**Why:** ADR, SDK install, env scaffolding, both provider seams, state-machine extension, and the two format spikes must exist before parallel agents run.

**Files touched (all by orchestrator):**
- Create: `docs/architecture-decisions.md` — append ADR-025
- Modify: `package.json` — add `sarvamai`
- Create or modify: `.env.local.example` — append `SARVAM_API_KEY=`, `VOICE_PROVIDER=`, `VOICE_TTS_PROVIDER=`
- Modify: `lib/voice/types.ts` — extend `VoiceProviderName`; add `TtsProvider` interface + `TtsProviderName`
- Modify: `lib/voice/provider.ts` — add `case 'sarvam'` STT placeholder; add `getTtsProvider()` resolver with two branches
- Rename: `lib/voice/tts-adapter.ts` → `lib/voice/web-speech-tts-adapter.ts`; create thin re-export shim at old path
- Modify: `lib/checkin/state-machine.ts` — extend `State` + `Event` unions per protocol; add no-op transitions; existing tests must stay green
- Create: `tests/voice/provider-resolver.test.ts` — assert resolver picks `'sarvam'` when env is set; assert TTS resolver branches
- Create: `docs/research/sarvam-format-spikes.md` — 1-page write-up of STT input format + TTS output format spikes
- Modify: `docs/architecture-changelog.md` — append Voice C1 pre-flight entry
- Append: `docs/build-log.md`

### Steps

- [ ] **0.1** — Verify clean tree on `feat/voice-sarvam` branched from `main` at `a5361ed` or later. Run `npm run test:run`, `npx tsc --noEmit`, `npm run build` — confirm baseline green (should match post-C2 baseline).

- [ ] **0.2** — Write **ADR-025 — Voice provider for production: Sarvam AI streaming (STT + TTS) + multi-turn dialog**. Append to `docs/architecture-decisions.md`. Body:

  ```markdown
  ## ADR-025 — Voice provider for production: Sarvam AI streaming (STT + TTS) + multi-turn dialog

  **Date:** 2026-04-25
  **Status:** accepted (supersedes ADR-018 on the deferral)

  **Context.** ADR-018 deferred Sarvam to post-MVP. Three blockers were
  resolved 2026-04-25: `sarvamai` JS SDK abstracts streaming WebSocket;
  long-lived `api-subscription-key` server-only; Vercel HTTP-streaming +
  SSE for STT partials and Vercel streaming `Response` for TTS audio.
  In the same conversation Rewant chose Option B + B3 from the dialog
  scoping menu — multi-turn voice with a "Switch to taps" bail-out.

  **Decision.** Sarvam AI is the production voice provider for both STT
  and TTS. `WebSpeechAdapter` (STT) and `web-speech-tts-adapter.ts` (TTS)
  remain as dev/test fallbacks. New files:
  - `lib/voice/sarvam-adapter.ts` (STT client, `VoiceProvider`).
  - `app/api/transcribe/route.ts` (Vercel Fluid Compute STT proxy).
  - `lib/voice/sarvam-tts-adapter.ts` (TTS client, new `TtsProvider`).
  - `app/api/speak/route.ts` (TTS audio proxy).
  - `lib/saha/follow-up-engine.ts` + `follow-up-variants.ts` (per-metric question + re-ask + decline-acknowledgement copy).

  Resolvers picked by env: `VOICE_PROVIDER=sarvam` (STT),
  `VOICE_TTS_PROVIDER=sarvam` (TTS). Multi-turn dialog drives via 5 new
  states + 7 new events on the existing check-in state machine.
  Bail-to-taps from any voice state lands in the existing Stage 2 grid
  with partial metrics preserved; cycle-1 makes that path forward-only.

  **Consequences.**
  - Pros: live partials match the existing UX; multilingual readiness
    is now a config change (Hindi-next via `language_code`); key never
    reaches the browser; conversational flow turns into a real product
    differentiator vs the plain transcribe-and-tap shape of C2.
  - Cons: dialog flow adds ~300 lines of state-machine + page wiring.
    Cost + latency budget per metric (TTS + STT + extract) is ~3-5s,
    multiplied by up to 5 missing metrics ⇒ worst-case ~25s of dialog
    after the freeform turn. Acceptable for MVP; revisit with telemetry.
  - Two-deploy-target risk avoided — everything stays on Vercel.

  **Alternatives considered.**
  - Browser-direct with ephemeral tokens: rejected — Sarvam doesn't
    expose ephemeral tokens.
  - Separate WebSocket service on Render/Fly: rejected — second deploy
    + monitoring + bill.
  - REST batch (no streaming): rejected — kills live partials.
  - Option B1 (no taps during dialog): rejected — punishing on iOS
    Safari STT failures.
  - Option B2 (Stage 2 visible during dialog): rejected — two input
    paths racing each other is messy.
  - Option C (full duplex / barge-in): out of scope for cycle 1.

  **Supersedes:** ADR-018 on the deferral. ADR-018 stays in the record
  as the point-in-time rationale; ADR-025 is the active decision.
  ```

- [ ] **0.3** — Install SDK: `npm install sarvamai`. Verify import: `node -e "console.log(Object.keys(require('sarvamai')))"`. Commit `package.json` + `package-lock.json`.

- [ ] **0.4** — Append `.env.local.example`:

  ```
  # Sarvam AI — server-only. Never NEXT_PUBLIC_*.
  SARVAM_API_KEY=

  # Voice provider selectors. Defaults to web-speech for dev/tests.
  VOICE_PROVIDER=web-speech
  VOICE_TTS_PROVIDER=web-speech
  ```

- [ ] **0.5** — Extend `lib/voice/types.ts`:
  - `VoiceProviderName = 'web-speech' | 'openai-realtime' | 'sarvam'`.
  - Add `TtsProvider` interface, `TtsProviderName`, `TtsSpeakOptions` (move from `tts-adapter.ts`).

- [ ] **0.6** — Rename `lib/voice/tts-adapter.ts` → `lib/voice/web-speech-tts-adapter.ts`. Strip the local interface declarations (now in `types.ts`); the file exports `createTtsAdapter()`, `isTtsAvailable()`, `selectVoice()`, `resetVoiceCacheForTests()`. Create thin shim at `lib/voice/tts-adapter.ts`:

  ```typescript
  // Compatibility shim — delete in Wave 2 once the resolver is wired.
  export * from './web-speech-tts-adapter'
  ```

  Update no other call sites — the existing `SpokenOpener` import keeps resolving via the shim.

- [ ] **0.7** — Extend `lib/voice/provider.ts`:
  - `resolveVoiceProviderName()` recognises `'sarvam'` (STT).
  - `getVoiceProvider()` adds `case 'sarvam'` returning `throw new Error('NotImplementedError: Sarvam STT — pending V.B')`.
  - New `resolveTtsProviderName(): TtsProviderName` reads `process.env.VOICE_TTS_PROVIDER`; defaults to `'web-speech'`.
  - New `getTtsProvider(name = resolveTtsProviderName()): TtsProvider`:

    ```typescript
    switch (name) {
      case 'sarvam':
        throw new Error('NotImplementedError: Sarvam TTS — pending V.C')
      case 'web-speech':
      default:
        return createTtsAdapter() // from web-speech-tts-adapter.ts
    }
    ```

- [ ] **0.8** — Extend `lib/checkin/state-machine.ts`:
  - Add the five new states + seven new events per the State-machine extension protocol above.
  - Add no-op transition cases (`return state`) so existing tests pass.
  - Add 6 new tests in `tests/check-in/state-machine.test.ts` exercising each new state's `BAIL_TO_TAPS` no-op behavior + asserting the union compiles.

- [ ] **0.9** — Add `tests/voice/provider-resolver.test.ts` (or extend if it exists):
  - STT resolver returns `'sarvam'` when env is set; throws marker error from the placeholder branch.
  - TTS resolver returns Web Speech adapter by default.
  - TTS resolver throws marker error from `'sarvam'` branch.

- [ ] **0.10** — **STT audio-format spike + TTS audio-format spike.** 10–20 minute combined POC, no commit:
  1. **STT spike.** Open a Node REPL with `sarvamai`. Try `client.speechToTextStreaming.connect({ model: 'saaras:v3', mode: 'transcribe', 'language-code': 'en-IN', high_vad_sensitivity: 'true' })`. Send a known WebM/Opus chunk via `socket.transcribe({ audio: <buffer>, sample_rate: 16000, encoding: 'audio/webm' })`. If accepted → V.B does NOT need a PCM resampler. Else → V.B includes a small WebAudio-based 16k mono PCM/WAV resampler (~80 lines).
  2. **TTS spike.** Try `client.textToSpeech.convert({ text: 'Hello Sonakshi.', target_language_code: 'en-IN', speaker: <Sarvam default> })`. Observe response shape — base64 chunk, MP3 stream, raw PCM? Determine: (a) the right Sarvam TTS endpoint (REST `convert` vs streaming), (b) the audio format the browser `<audio>` element can play directly without decoding, (c) latency to first audio byte.
  3. Pick a Sarvam TTS voice name. Default candidate: `meera` or whichever Sarvam recommends for `en-IN` neutral female.
  4. Document outcome to `docs/research/sarvam-format-spikes.md` (1 page). Both V.B and V.C read the spike outcome to pick implementation paths.

- [ ] **0.11** — Smoke test: `npm run test:run`, `npx tsc --noEmit`, `npm run build`. **All green.**

- [ ] **0.12** — Append entry to `docs/architecture-changelog.md`:

  ```markdown
  ## 2026-MM-DD — Voice C1 pre-flight

  - ADR-025 written (supersedes ADR-018).
  - `sarvamai` SDK installed.
  - `VoiceProviderName` extended to include `'sarvam'`.
  - New `TtsProvider` interface added; `tts-adapter.ts` renamed to
    `web-speech-tts-adapter.ts` with a re-export shim.
  - STT resolver placeholder for `sarvam`; new TTS resolver
    `getTtsProvider()` with `web-speech` default + `sarvam` placeholder.
  - State machine extended with 5 new states + 7 new events for
    multi-turn dialog (no-op transitions; Wave 2 implements logic).
  - STT format spike result: `<WebM accepted | PCM resampler required>`.
  - TTS format spike result: `<MP3 streaming | base64 blob | …>`,
    voice: `<name>`.
  - `.env.local.example` documents `SARVAM_API_KEY`, `VOICE_PROVIDER`,
    `VOICE_TTS_PROVIDER` (all `web-speech` default).
  ```

- [ ] **0.13** — Commit: `chore(voice-c1): pre-flight Task 0 — ADR-025, SDK install, provider seams, state-machine extension, format spikes`. Tag `voice-c1/pre-flight-done`. Append phase entry to `docs/build-log.md`. **Do not push yet — await Rewant signal to dispatch Wave 1.**

---

## Task 1: Wave 1 build dispatch — 4 subagents in ONE multi-tool-call message

All four prompts dispatched in a single message. File ownership is disjoint. Integration seams are typed contracts in `lib/voice/types.ts` (extended in pre-flight) and `lib/checkin/types.ts` (untouched, already from C2).

### Build-A prompt (Chunk V.A — STT route + Sarvam WebSocket bridge + SSE)

**Files OWNED:**
- `app/api/transcribe/route.ts`
- `lib/voice/sarvam-stt-server.ts` (server-only — Sarvam STT SDK wiring, SSE writer, abort plumbing)
- `tests/api/transcribe-route.test.ts` (with mocked `sarvamai`)

**Do NOT touch:** `lib/voice/sarvam-adapter.ts`, `lib/voice/sarvam-tts-adapter.ts`, `lib/voice/sarvam-tts-server.ts`, `app/api/speak/**`, `lib/voice/types.ts`, `lib/voice/provider.ts`, `lib/voice/web-speech*.ts`, `lib/voice/tts-adapter.ts`, `lib/checkin/**`, `lib/saha/**`, `app/check-in/**`, `components/**`, `convex/**`.

**Stories implemented:**

- **Transcribe.US-V.A.1** — `POST /api/transcribe`. Reads streaming `ReadableStream` request body. Each chunk is forwarded as audio to Sarvam via `socket.transcribe({ audio, sample_rate: 16000, encoding: <from pre-flight spike> })`. Listens for partial results. Writes each partial as an SSE event `data: {"type":"partial","text":"..."}\n\n` to the streaming response body. On Sarvam socket close OR client abort, flushes a final `data: {"type":"final","text":"...","durationMs":N}\n\n` and closes. Runtime: `export const runtime = 'nodejs'`. `export const dynamic = 'force-dynamic'`.

- **Transcribe.US-V.A.2** — Auth posture: route reads `SARVAM_API_KEY` from `process.env`. Never logs the key. Never echoes it in error responses. Validates the key at module load — if missing, route returns 503 with code `voice.provider_unconfigured`.

- **Transcribe.US-V.A.3** — Cost + abuse guards:
  - Reject `Content-Type` not in `{'audio/webm', 'audio/wav', 'audio/ogg'}` → 415.
  - Hard cap connection lifetime at 90 seconds (typical conversational dialog with 5 metrics is well under this even if every turn ran). After cap → flush final + close. Code: `voice.session_too_long`.
  - Hard cap aggregate audio bytes at 5 MB. Beyond → close with `voice.session_too_large`.
  - Surface counts via response headers (`X-Voice-Bytes`, `X-Voice-Duration-Ms`).

- **Transcribe.US-V.A.4** — Abort handling. Subscribe to `request.signal.addEventListener('abort', ...)`; close the Sarvam socket cleanly. Tests assert no dangling socket.

**Test approach (TDD):** ≥10 tests. Mock `sarvamai`'s `SarvamAIClient` with an EventEmitter-shaped fake. Cases: happy-path (3 chunks → 3 partials + 1 final SSE event); missing key → 503; bad content-type → 415; >5MB → close with `voice.session_too_large`; >90s → close with `voice.session_too_long`; client abort → Sarvam socket closed; Sarvam error → SSE `data: {"type":"error","kind":"network"}` then close.

**Commit per story** — Conventional Commits, `feat(voice-c1): …`. After last commit, `npm run test:run` must be green.

---

### Build-B prompt (Chunk V.B — `SarvamAdapter` STT client)

**Files OWNED:**
- `lib/voice/sarvam-adapter.ts`
- `lib/voice/sarvam-recorder.ts` (`MediaRecorder` wrapper — capture + chunk + optional PCM resample if pre-flight required it)
- `tests/voice/sarvam-adapter.test.ts`
- `tests/voice/sarvam-recorder.test.ts`

**Do NOT touch:** `app/api/transcribe/**`, `app/api/speak/**`, `lib/voice/sarvam-stt-server.ts`, `lib/voice/sarvam-tts-*.ts`, `lib/voice/types.ts`, `lib/voice/provider.ts` (orchestrator flips placeholder in Task 2), `lib/voice/web-speech*.ts`, `lib/voice/tts-adapter.ts`, `lib/voice/openai-realtime-adapter.ts`, `app/**`, `components/**`, `convex/**`, `lib/checkin/**`, `lib/saha/**`.

**Stories implemented:**

- **SarvamAdapter.US-V.B.1** — `class SarvamAdapter implements VoiceProvider`. Constructor takes `{ language_code: string }` — **mandatory**. Forwards `language_code` to the `/api/transcribe` upload (query param `?lang=<code>`); the route relays it to Sarvam (`'language-code'`). Capabilities: `{ partials: true, vad: true }`.

- **SarvamAdapter.US-V.B.2** — `start()`: `navigator.mediaDevices.getUserMedia({ audio: true })`. Errors → typed `VoiceError` (`permission-denied`, `unsupported`, `aborted`). Spawns `MediaRecorder` (or PCM resampler pipeline per pre-flight). 250ms chunks pushed to a `ReadableStream` consumed by `fetch('/api/transcribe?lang=en-IN', { method: 'POST', body: stream, duplex: 'half' })`. Concurrently consumes the response body via `Response.body.getReader()` + a tiny SSE parser. Each `partial` event fires `partialListeners`.

- **SarvamAdapter.US-V.B.3** — `stop(): Promise<Transcript>`: closes recorder, ends upload stream, awaits route's `final` SSE event. Resolves `{ text, durationMs }`. SSE `error` → typed `VoiceError`.

- **SarvamAdapter.US-V.B.4** — Cleanup. On `stop()` OR external abort, tracks released (`MediaStreamTrack.stop()`), reader cancelled, fetch aborted via `AbortController`. No leaked mic indicator.

- **SarvamRecorder.US-V.B.5** — `MediaRecorder` wrapper. WebM mode: thin wrapper at 250ms timeslice. PCM mode (if pre-flight required): WebAudio resampler → 16k mono PCM → WAV chunks. The `audioFormat` constant comes from pre-flight.

**Test approach (TDD):** ≥14 tests. Mock `getUserMedia`, `MediaRecorder`, `fetch`, `Response.body.getReader()`. Cases: constructor rejects empty `language_code`; `start()` requests mic; permission denied → typed error; partials fire in order; final SSE → `stop()` resolves with right transcript; `stop()` releases tracks; abort cancels fetch; SSE error event → typed error; `language_code` flows into URL; recorder modes emit chunks at 250ms.

**Commit per story** — `feat(voice-c1): …`.

---

### Build-C prompt (Chunk V.C — Sarvam TTS route + adapter + resolver wiring)

**Files OWNED:**
- `app/api/speak/route.ts`
- `lib/voice/sarvam-tts-server.ts` (server-only — Sarvam TTS SDK wiring, audio streaming, key handling)
- `lib/voice/sarvam-tts-adapter.ts` (browser-side TTS adapter implementing `TtsProvider`)
- `tests/api/speak-route.test.ts` (with mocked `sarvamai`)
- `tests/voice/sarvam-tts-adapter.test.ts`

**Do NOT touch:** `app/api/transcribe/**`, `lib/voice/sarvam-adapter.ts`, `lib/voice/sarvam-recorder.ts`, `lib/voice/sarvam-stt-server.ts`, `lib/voice/types.ts`, `lib/voice/provider.ts` (orchestrator flips in Task 2), `lib/voice/web-speech*.ts`, `lib/voice/tts-adapter.ts` (it's now a shim — leave alone), `lib/voice/openai-realtime-adapter.ts`, `app/**` (other than the new `api/speak`), `components/**`, `convex/**`, `lib/checkin/**`, `lib/saha/**`.

**Stories implemented:**

- **SpeakRoute.US-V.C.1** — `POST /api/speak`. Body: JSON `{ text: string, language_code: string, voice?: string }`. Server invokes Sarvam TTS via SDK (endpoint + format per pre-flight). Pipes audio bytes back as a streaming response. `Content-Type` matches the spike result (`audio/mpeg`, `audio/wav`, etc.). On Sarvam error → 502 with code `voice.tts_failed`. On missing key → 503 `voice.provider_unconfigured`. Hard cap text length at 1000 chars → 413 `voice.text_too_long`. Reject malformed body → 400.

- **SpeakRoute.US-V.C.2** — Auth + safety. `SARVAM_API_KEY` server-only. Never logs key. Reject `text` containing newlines beyond 5 (cheap proxy for prompt-injection-via-multiline). Reject any control chars beyond ASCII 0x20 except `\n`.

- **SarvamTtsAdapter.US-V.C.3** — `class SarvamTtsAdapter implements TtsProvider`. Constructor `{ language_code: string, voice?: string }` — `language_code` mandatory. `speak(text)`: POST to `/api/speak` with `{ text, language_code, voice }`. Feed response body to a `<audio>` element via `URL.createObjectURL(new Blob(...))` (MVP) OR `MediaSource` (if pre-flight confirmed streaming-decode). Resolves on `audio.onended`. Rejects on `audio.onerror`. `cancel()` aborts the fetch + pauses + resets the audio element. `isAvailable()` returns `true` always (provider is server-driven; client just needs `<audio>`).

- **SarvamTtsAdapter.US-V.C.4** — Idempotent re-cancel. Calling `cancel()` while idle is a no-op. Calling `cancel()` while another `speak()` is pending: rejects the prior promise with a typed `{ kind: 'aborted' }` and the new `speak()` proceeds.

- **SarvamTtsAdapter.US-V.C.5** — `language_code` flows through. Tests assert the request body sent to `/api/speak` includes the constructor `language_code`.

**Test approach (TDD):** ≥12 tests. Route: missing key → 503; malformed body → 400; text >1000 → 413; happy path streams audio back (mocked `sarvamai`); Sarvam error → 502; control chars rejected → 400. Adapter: speak resolves on `ended`; cancel rejects pending speak; cancel idempotent; bad fetch (4xx) → typed error; `language_code` in body. Mock `fetch`, `URL.createObjectURL`, `<audio>` element with controlled play/end events.

**Commit per story** — `feat(voice-c1): …`.

---

### Build-D prompt (Chunk V.D — Follow-up question engine + variant catalog)

**Files OWNED:**
- `lib/saha/follow-up-engine.ts`
- `lib/saha/follow-up-variants.ts` (locked variant catalog: per-metric question, re-ask question, decline-acknowledgement copy)
- `lib/saha/decline-detector.ts` (small helper that runs the decline-phrase regex over an answer transcript)
- `tests/check-in/follow-up-engine.test.ts`
- `tests/check-in/decline-detector.test.ts`

**Do NOT touch:** anything else. Pure logic — no UI, no Convex, no API calls.

**Stories implemented:**

- **FollowUp.US-V.D.1** — `selectFollowUpQuestion(metric: Metric, attempt: 1 | 2, continuityState: ContinuityState): { variantKey: string; text: string }`. Pure function. `attempt=1` returns the standard per-metric question; `attempt=2` returns the re-ask copy ("Sorry — I missed that. Can you say it again?"). Uses `continuityState` for any per-metric tonal variants (e.g., if `flareOngoingDays > 0` and metric is `flare`, the question copy adapts: "And the flare today — still ongoing, or different?" vs the default "Any flare today?"). The catalog covers all 5 metrics × 2 attempts × ≤2 continuity tones = ≤20 variants. Catalog is locked verbatim from the variant table at the bottom of this prompt.

- **FollowUp.US-V.D.2** — `selectDeclineAcknowledgement(metric: Metric): { text: string }`. Used by the page to play a 1-second TTS line confirming a metric was skipped before moving on ("OK, skipping the pain question."). 5 variants — one per metric.

- **DeclineDetector.US-V.D.3** — `detectDecline(answerTranscript: string): boolean`. Regex over `/skip|next|don'?t (want|know)|not sure|move on|pass|none|nothing/i`. Conservative — false positives become "user declined" which is OK. Tests cover the allowlist + a handful of false-negative-prone phrases ("I'm fine" should NOT match decline; "that's all" should match).

**Variant catalog (locked, copy verbatim):**

| Metric | Attempt 1 (default) | Attempt 1 (continuity-tone variant — only for `flare` when `flareOngoingDays > 0`) | Attempt 2 (re-ask) | Decline ack |
|---|---|---|---|---|
| `pain` | "How's the pain today on a 1 to 10?" | — | "Sorry — missed that. The pain today, 1 to 10?" | "OK, skipping pain." |
| `mood` | "And how are you feeling — heavy, flat, okay, bright, or great?" | — | "Sorry — could you say how you're feeling? Heavy, flat, okay, bright, or great?" | "OK, skipping mood." |
| `adherenceTaken` | "Did you take your medication today?" | — | "Sorry — meds today, yes or no?" | "OK, skipping medication." |
| `flare` | "Any flare today — yes, no, or still ongoing?" | "And the flare today — still ongoing, or different?" | "Sorry — flare today: yes, no, or ongoing?" | "OK, skipping flare." |
| `energy` | "And your energy today, 1 to 10?" | — | "Sorry — energy today, 1 to 10?" | "OK, skipping energy." |

All 22 strings copied verbatim into `follow-up-variants.ts` as a TypeScript record. Reviewers verify exact match.

**Test approach (TDD):** ≥18 tests. `selectFollowUpQuestion`: every metric × every attempt → expected variantKey + text; `flare` with `flareOngoingDays > 0` returns the continuity-tone variant; `flare` with `flareOngoingDays === 0` returns the default. `selectDeclineAcknowledgement`: every metric → expected text. `detectDecline`: 8 positive cases ("skip", "next please", "I'll skip that", "don't know", "not sure", "pass", "move on", "nothing today"), 6 negative cases ("I'm fine", "I'm good", "okay", "great today", "yes", "seven").

**Commit per story** — `feat(saha): …`.

---

## Task 2: Wave 1 integration + Wave 2 (orchestrator)

This cycle's "Wave 2" is orchestrator-only — page rewiring, state-machine transitions, and the bail-out button. No additional parallel build chunks.

**Files touched (orchestrator):**
- Modify: `lib/voice/provider.ts` — flip both placeholders to real adapters
- Trash: `lib/voice/tts-adapter.ts` shim (replaced by direct resolver use)
- Modify: `lib/checkin/state-machine.ts` — implement transition logic for the 7 new events
- Modify: `app/check-in/page.tsx` — multi-turn loop + closer TTS + bail-out wiring
- Modify: `components/check-in/SpokenOpener.tsx` — driven by Sarvam TTS instead of direct `tts-adapter` call
- Create: `components/check-in/SwitchToTapsButton.tsx` (sticky-bottom button visible during voice states)
- Modify: `components/check-in/Closer.tsx` — accept a `playAudio?: boolean` prop so the page can drive TTS playback
- Modify: existing tests as needed

### Steps

- [ ] **2.1** — Pull merged Wave 1 work. Run `git log --name-only voice-c1/pre-flight-done..HEAD` and verify zero file-ownership overlap between V.A / V.B / V.C / V.D.

- [ ] **2.2** — Replace STT + TTS placeholders in `provider.ts`:

  ```typescript
  case 'sarvam':
    return new SarvamAdapter({ language_code: 'en-IN' })
  // and for TTS:
  case 'sarvam':
    return new SarvamTtsAdapter({ language_code: 'en-IN' })
  ```

  Trash the `lib/voice/tts-adapter.ts` re-export shim. Update `SpokenOpener.tsx` to use `getTtsProvider()` from `provider.ts` instead of importing from the old path.

- [ ] **2.3** — Implement state-machine transitions for the 7 new events per the State-machine extension protocol section above. Add tests in `tests/check-in/state-machine.test.ts` covering each.

- [ ] **2.4** — Build `<SwitchToTapsButton>`. Sticky-bottom positioning, copy "Switch to taps", calls `dispatch({ type: 'BAIL_TO_TAPS' })`. Hidden when state is not in `{ speaking-opener, listening, speaking-question, listening-answer, extracting-answer, extracting }`. Add a 200ms fade-in so it doesn't flash during transient states.

- [ ] **2.5** — Rewire `app/check-in/page.tsx`:
  - On `idle` + `TAP_ORB`: `requesting-permission` → on grant, page dispatches a synthetic `ENTER_OPENER` (or just transitions in state machine) → page kicks `tts.speak(openerText)` → on resolve, dispatches `OPENER_PLAYED`; on reject, dispatches `OPENER_FAILED`.
  - On `speaking-opener`: render opener text + orb + Switch-to-Taps button.
  - On `listening` (freeform): existing partial-rendering behavior, plus Switch-to-Taps.
  - On `processing`/`extracting`: existing extract call. After `EXTRACTION_DONE`:
    - If `missing.length === 0` AND not Day-1 → page dispatches into `confirming` (existing path).
    - Else → page picks `next = missing[0]`, calls `selectFollowUpQuestion(next, 1, continuityState)`, dispatches `ASK_QUESTION { metric, text }`. On state entering `speaking-question`, page kicks `tts.speak(text)` → on resolve, dispatches `QUESTION_PLAYED`.
  - On `listening-answer`: same partial-rendering as `listening`. Mic auto-stops after 8s of silence (`MediaRecorder` plus a silence-detection timeout — Sarvam VAD also helps but we add a client-side guard).
  - On `extracting-answer`: page calls `extractMetrics(answerTranscript.text)`. Result merged into `state.metrics`. Decline detected via `detectDecline(answerTranscript.text)` AND `result[metric] === null/undefined`. Page dispatches `ANSWER_EXTRACTED { metrics, declined }`.
  - State machine routes: still missing → next question; otherwise → `confirming`.
  - On entering `confirming`: page renders existing ConfirmSummary + plays closer via TTS. While TTS plays, the button doesn't show; user can still edit rows.
  - On `CONFIRM`: dispatch into `speaking-closer`. On resolve, dispatch `CLOSER_PLAYED` → `saving` (existing path).
  - Page also handles re-ask: if `ANSWER_EXTRACTED` shows neither covered nor declined, increment a `reaskCount[metric]` counter; if 1 → `selectFollowUpQuestion(metric, 2, continuityState)`; if 2 → mark declined + advance.

- [ ] **2.6** — Build `same-day-reentry` quick path. If `getTodayCheckin` returns a row AND the freeform extraction yields zero new metrics (all values null/undefined) → skip follow-up loop, go straight to `confirming` with empty `metrics` and an "all declined / nothing new" state. ConfirmSummary renders the prior row's values (read from `getTodayCheckin`) so the user can still edit. Closer copy: same `re-entry-same-day` closer variant.

- [ ] **2.7** — Run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. All green.

- [ ] **2.8** — Local smoke test: `VOICE_PROVIDER=sarvam VOICE_TTS_PROVIDER=sarvam SARVAM_API_KEY=<dev-key> npm run dev` → open `/check-in` → tap orb → hear opener → speak partial answer → hear follow-up question → speak answer → hear next question → reach ConfirmSummary → hear closer. Verify Network tab: `/api/transcribe` (one per voice turn) + `/api/speak` (one per TTS), both streaming, no `SARVAM_API_KEY` anywhere in client payloads. Test bail-out: tap "Switch to taps" mid-question → Stage 2 grid appears with the metrics captured so far. Test fallback: unset `VOICE_PROVIDER` and `VOICE_TTS_PROVIDER` → flow runs end-to-end on Web Speech.

- [ ] **2.9** — Commit: `feat(voice-c1): integrate Wave 1 + multi-turn dialog — STT, TTS, follow-up engine, bail-out, page rewire`. Tag `voice-c1/wave-2-integrated` (skip `wave-1-integrated` since this cycle integrates everything in one orchestrator pass). Append phase entry to `docs/build-log.md`.

---

## Task 3: Review dispatch — 3 reviewers in ONE multi-tool-call message

All three read the delta `voice-c1/pre-flight-done..HEAD`.

### Review-1 prompt (brief alignment)
- Every story's acceptance satisfied or explicitly deferred to backlog
- ADR-025 written; supersedes ADR-018 on the deferral; ADR-018 not modified
- `language_code` is mandatory in both `SarvamAdapter` and `SarvamTtsAdapter` constructors (no default fallback)
- Web Speech adapters still work when env vars unset (regression check — both STT and TTS)
- Follow-up question copy in `follow-up-variants.ts` matches the locked catalog in this plan **verbatim**, including punctuation and the em-dash "—"
- Decline-acknowledgement copy verbatim
- Phrases ruled out by ADR-009 (closer engine) absent from any new TTS-played copy: "one day at a time", "be kind to yourself", "stay strong", "you're doing amazing", "thank you for trusting this"
- "support-system" never "caregiver" / "squad"
- Scope creep outside the 4 chunks + orchestrator integration

### Review-2 prompt (security + spec + ADR + regression)
- `SARVAM_API_KEY` never appears in any file under `app/check-in/**`, `components/**`, `lib/voice/sarvam-adapter.ts`, `lib/voice/sarvam-tts-adapter.ts`, `lib/voice/sarvam-recorder.ts`, or any test that runs in jsdom
- `SARVAM_API_KEY` not echoed in any error response body or log line; not in `X-Voice-*` response headers
- `NEXT_PUBLIC_*` not used for any voice secret
- Both routes validate content-type / body shape; STT route enforces byte + duration caps; TTS route enforces text-length cap
- Both routes close upstream Sarvam connection on `request.signal` abort
- ADR-025 referenced from `docs/architecture-changelog.md`
- `VoiceProvider` interface unchanged — no new methods, no breaking signature changes; `TtsProvider` interface added cleanly without disturbing C2 callers
- `VoiceProviderName` and `TtsProviderName` unions are discriminated string unions; both resolvers default to `'web-speech'`
- Multilingual readiness: `language_code` flows from adapter constructor → fetch URL/body → server route → Sarvam connect/convert args; trace it in tests for both STT and TTS
- C2 regression: `SpokenOpener` still works in dev with `VOICE_TTS_PROVIDER=web-speech`; existing `tts-adapter.test.ts` still green; existing 152 tests green
- State-machine: existing C2 transitions unchanged; new transitions match the protocol; reducer tests cover every new event from every legal source state

### Review-3 prompt (edge cases)
- **STT**: mic permission denied → `VoiceError.kind === 'permission-denied'`; orb returns to error state; no half-open fetch
- **STT**: network failure mid-stream → typed error; reader cancelled; mic released
- **STT**: user clicks stop mid-utterance → `stop()` resolves with partial text; no dangling Sarvam socket on server
- **STT**: 90s cap → server flushes final + closes; client `stop()` resolves with truncated transcript
- **STT**: 5MB byte cap → same path
- **STT**: malformed JSON in a partial → adapter logs + continues
- **TTS**: text >1000 chars → 413 surfaced as `VoiceError.kind === 'aborted'` with helpful message
- **TTS**: cancel during mid-playback → audio stops cleanly; no audible click
- **TTS**: `Sarvam returns malformed audio` → audio.onerror → typed error; UI recovers (page falls back to silent text + advances state)
- **Dialog**: 0 metrics covered after freeform → all 5 follow-up questions asked in scoping order
- **Dialog**: 5 metrics covered after freeform → no follow-up questions; goes straight to confirming + closer TTS
- **Dialog**: user declines all 5 follow-ups → confirming with all-null metrics; ConfirmSummary still renders with skipped rows
- **Dialog**: bail-out from each voice state lands in Stage 2 with the exact partial metrics state preserved (test all 6 bail sources: speaking-opener, listening, speaking-question, listening-answer, extracting-answer, extracting)
- **Dialog**: 8s silence timeout in `listening-answer` → mic auto-stops; if no transcript captured, decline advances after re-ask
- **Dialog**: re-ask happens once, never twice
- **Dialog**: same-day re-entry with empty freeform → skip follow-up loop → confirming with prior row's values shown
- **Dialog**: bail-to-taps cancels in-flight TTS AND in-flight STT (no zombie audio playing while Stage 2 renders)
- **Day 1**: opener variant `first-ever` plays via Sarvam TTS; `Day1Tutorial` overlay appears only after bail-out
- **Continuity**: `flare` follow-up uses the continuity-tone variant when `flareOngoingDays > 0`; default variant otherwise
- **`prefers-reduced-motion`**: `<SwitchToTapsButton>` fade-in collapses to instant
- **WCAG AA**: Switch-to-Taps button ≥44pt, contrast verified, keyboard reachable
- **Voice provider unset**: `VOICE_PROVIDER` and `VOICE_TTS_PROVIDER` both unset → flow runs on Web Speech end-to-end; tests cover this path with mocked `speechSynthesis`
- **`VOICE_PROVIDER=sarvam` but `SARVAM_API_KEY` missing**: route returns 503; adapter surfaces typed error; UI degrades gracefully (silent opener text + Web Speech STT fallback if sensible, OR an error orb state)

Merge findings into one ordered fix list grouped by chunk. Tag `voice-c1/reviewed`.

---

## Task 4: Fix pass

- [ ] **4.1** — Triage findings: blocker → major → minor. Discard anything that re-litigates a locked decision (see top).
- [ ] **4.2** — Apply smallest-diff fixes. One commit per chunk.
- [ ] **4.3** — Re-run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. All green.
- [ ] **4.4** — Tag `voice-c1/fixed`. Append phase entry to `docs/build-log.md`.

---

## Task 5: Second-pass review

One Agent call. Prompt includes the locked-decisions list + first-pass summary. Looks for 1–2 missed items.

- [ ] **5.1** — Dispatch second-pass reviewer (Explore agent, very thorough).
- [ ] **5.2** — If clean: tag `voice-c1/second-pass-clean`.
- [ ] **5.3** — If findings: one more fix commit max, then tag `voice-c1/second-pass-clean`.

**Stop condition:** if second pass finds blocker-level issues that need more than one fix commit → stop, don't ship, flag for morning.

---

## Task 6: Ship

- [ ] **6.1** — Vercel: add `SARVAM_API_KEY` to Production + Preview environments. Add `VOICE_PROVIDER=sarvam` + `VOICE_TTS_PROVIDER=sarvam` to Production + Preview. Confirm none are `NEXT_PUBLIC_*`. Use the per-branch trick learned in F02 C1 — set values for the `feat/voice-sarvam` preview branch explicitly.
- [ ] **6.2** — Push branch: `git push origin feat/voice-sarvam`.
- [ ] **6.3** — Open PR or rely on auto-deploy preview. Verify the preview URL: open `/check-in`, complete a full conversational check-in, observe TTS opener → freeform → follow-up → ConfirmSummary → closer TTS → saved. Test bail-out at every voice state. Confirm Network tab shows `/api/transcribe` + `/api/speak` calls; key never in client payload.
- [ ] **6.4** — Merge to `main`. Vercel production deploy. Verify `https://saha-health-companion.vercel.app/check-in` runs Sarvam end-to-end.
- [ ] **6.5** — `docs/architecture-changelog.md` — append "Voice C1 shipped" entry.
- [ ] **6.6** — `docs/system-map.md` — reflect Sarvam paths: browser → `/api/transcribe` → Sarvam STT WebSocket → SSE; browser → `/api/speak` → Sarvam TTS → audio stream.
- [ ] **6.7** — `docs/build-log.md` — session entry: what shipped, reviewer notes, surprises.
- [ ] **6.8** — `docs/post-mvp-backlog.md` — confirm "Sarvam adapter" removed from post-MVP list (now shipped). Add follow-up entries: "Sarvam barge-in / full duplex", "Sarvam Hindi runtime toggle", "voice settings panel".
- [ ] **6.9** — Update `~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md`: voice swap status → shipped + conversational. Update linked `project_sakhi_voice_sarvam.md` to reflect ship.
- [ ] **6.10** — Commit: `docs: ship voice C1 — Sarvam STT + TTS + multi-turn, ADR-025, system-map, build-log`. Tag `voice-c1/shipped`.

---

## Stop conditions (apply throughout)

- After 2 fix-pass iterations still red → stop, don't ship, morning brief.
- Reviewer blocker that conflicts with a locked decision → discard, note, don't wake.
- `tsc` / `next build` / route handler runtime failure on Vercel preview unresolvable without touching `scoping.md` → stop.
- Sarvam STT or TTS hard-failure (auth, model unavailable) reproducible against the dev key → stop, contact Sarvam, don't ship.
- Multi-turn dialog gets stuck (e.g. infinite re-ask loop, state-machine deadlock) reproducible in dev → stop, fix the state machine before any more chunks.
- Any subagent crosses its `Do NOT touch` list → reject the patch, restart that chunk.

---

## Scoping coverage map (verification)

| Scoping requirement | Cycle / Chunk |
|---|---|
| Live partials under the orb (UX parity with Web Speech) | V.A (SSE) + V.B (consumer) |
| Voice AI accepts language as a setting (`docs/scoping.md` § Language) | V.B + V.C (`language_code` constructor args) |
| `SARVAM_API_KEY` never reaches the browser | V.A + V.C (server-only) + Review-2 |
| `VoiceProvider` interface unchanged so existing C1/C2 wiring still works | V.B + Review-2 |
| Web Speech remains as fallback for both STT and TTS | pre-flight resolvers + Review-1 |
| Multilingual-ready architecture (Hindi-next becomes config change) | V.B + V.C `language_code` flow + ADR-025 |
| Conversational dialog: voice asks for missing metrics | V.D + Task 2 page wiring |
| Bail-to-taps preserves partial state | Task 2 + state machine + Review-3 |
| Strict turn-taking (no barge-in) | state machine (sequential states) + Review-3 |
| Closer is spoken via Sarvam TTS | Task 2 + V.C |

---

## Review notes
*(Filled in after Task 3 / Task 5.)*

## Learnings
*(Filled in post-ship.)*
