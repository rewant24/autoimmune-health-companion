# Architecture Changelog

> Running log of **changes** to architectural decisions. Each entry references the ADR it updates and captures what changed and why. This is separate from `architecture-decisions.md` (which is the append-only record of decisions themselves) — this file is where we track how our thinking evolved.

**Convention.**
- Newest entries at the top.
- Each entry: date, the ADR it relates to, the change, the reason.
- When an ADR is superseded entirely, add an entry here AND add a new numbered ADR in `architecture-decisions.md` that supersedes it.

---

## 2026-04-28 — Voice C1 STT transport: pivot from Sarvam streaming WS to REST batch (ADR-028)

**Related ADR:** ADR-028 (new) replaces the **upload transport** half of ADR-027. ADR-026 (provider choice) and the rest of ADR-027 (silence VAD, cold greeting, StopButton, capability flags) are unchanged.

**What changed.**
1. New `lib/voice/sarvam-stt-rest.ts` — thin `transcribeBatch(opts)` that POSTs multipart form-data (file + model + mode + language_code) to `https://api.sarvam.ai/speech-to-text`. Direct `fetch` + `FormData`; no SDK indirection. Typed `SarvamRestError` covers `voice.{provider_unconfigured,network,session_too_long,session_too_large,unprocessable,aborted}`.
2. `app/api/transcribe/route.ts` rewritten on top of the new module. Reads request body to a Uint8Array (with byte-cap streaming), calls `transcribeBatch`, emits **one** SSE `final` frame (or one `error` frame). Caps tightened to 1 MB / 30 s (down from 5 MB / 90 s) to match Sarvam's REST batch limits. `X-Voice-{Bytes,Duration-Ms,Cap-Hit}` headers preserved.
3. `lib/voice/sarvam-stt-server.ts` (the streaming-WS bridge) and its testing surface removed. The streaming branch in `SarvamAdapter` (TransformStream → `fetch(..., { body: stream, duplex: 'half' })`) is now a no-op upstream-wise but kept in the adapter — buffered mode is what the route consumes today, and gutting the streaming branch is a separate concern.
4. SSE wire shape is unchanged (the adapter still parses `data: {…}` envelopes via `drainSseEvents`) but `partial` frames are no longer emitted by this route. Sarvam's REST batch is synchronous; partials are conceptually impossible. The check-in page already handles the partials-absent case (it just renders the final transcript on `stop()`).

**Why.** Bug 1 — every check-in returned `{type:"final", text:"", durationMs:~260}`. Two earlier fixes (Option A: codec swap, Option B: prepend WAV header) didn't move the needle. SDK-level walk of `node_modules/sarvamai` revealed the streaming WS is VAD-segmented and requires `flush_signal=true` as a query param for `socket.flush()` to actually fire — undocumented in the SDK type surface. Our usage pattern (buffer entire utterance client-side, POST as one frame, force-close 250 ms later) never trips Sarvam's VAD, so the server emits zero events. Recorder was independently verified clean (valid WAV, RMS=0.041, real voice activity profile) — the bug is in our protocol choice, not the audio. REST batch is the right tool for a buffered upload: synchronous request → synchronous transcript, no VAD/flush/timing race possible.

**What did NOT change.** ADR-026 (Sarvam as the provider, multi-turn dialog architecture), the recorder + silence VAD (ADR-027 §2), the state-machine cold greeting + `idle-greeting`/`idle-ready` states (ADR-027 §3), the StopButton + heard-transcript echo (ADR-027 §5). The browser adapter's request shape (POST `audio/wav` body to `/api/transcribe?lang=…`, parse SSE response, dispatch on `type` field) is identical.

**Tradeoff acknowledged.** Live word-by-word partials are gone. ADR-027 §1 had restored them on Vercel HTTPS (streaming POST → streaming WS); that path is collateral damage here because it shared the broken upstream. Restoring partials would require a streaming-friendly STT provider or a Sarvam streaming-WS path with `flush_signal=true` properly threaded — out of scope for closing Bug 1.

**Validation.** 797/797 vitest, `tsc --noEmit` clean, `next build` green. New tests: `tests/voice/sarvam-stt-rest.test.ts` (17 tests covering happy path + 10 error mappings + the API-key reader). `tests/api/transcribe-route.test.ts` rewritten for the REST batch shape (16 tests).

---

## 2026-04-27 — Voice C1 fix-pass (ADR-027): streaming-with-buffered-fallback + client-side silence VAD + state-machine cold greeting + StopButton

**Related ADR:** ADR-027 (new) builds on ADR-026 (Sarvam streaming STT + TTS + multi-turn dialog).

**What changed.** Six structural fixes to make Voice C1 actually work end-to-end:

1. `SarvamAdapter` switches between streaming POST (HTTPS, `duplex: 'half'`, fires fetch on `start()`) and buffered POST (HTTP, fires fetch on `stop()`) via a new `streamingMode: 'auto' | 'streaming' | 'buffered'` option. Default `'auto'` resolves on `window.location.protocol`. Live partials only fire on Vercel deploys (HTTP/2+); local `next dev` (HTTP/1.1) still works in buffered mode without partials.
2. `SarvamRecorder` adds RMS-based silence detection — `onSilenceDetected(cb)` fires once when the user stops speaking. Constants exported: `SPEECH_RMS_THRESHOLD = 0.02`, `SILENCE_RMS_THRESHOLD = 0.01`, `SILENCE_TRAILING_CHUNKS = 6` (1.5s at 250ms cadence). Adapter wires this to its own `stop()`.
3. State machine adds `idle-greeting` + `idle-ready` states and `START_GREETING` / `GREETING_PLAYED` / `GREETING_FAILED` events. Page dispatches `START_GREETING` on mount when TTS is available so the cold-mount greeting plays without the user needing to tap first.
4. `SpokenOpener` accepts an optional `autoSpeak` prop (default `true`); page passes `false` so the page-level greeting effect owns playback (avoids double-fire).
5. New `<StopButton>` component mounted during `listening` + `listening-answer` ("Tap when done"). `transientCopyFor()` echoes `"I heard: '<transcript>'"` during `processing` + `extracting` + `extracting-answer` so users see what landed before extraction.
6. Capability flags `{ partials: true, vad: true }` are now truthful end-to-end on Vercel.

**Why.** Voice C1 shipped to a Vercel preview but smoke testing surfaced two bugs: (1) opener never auto-played on `/check-in` mount, (2) live transcript dictation never appeared (locally OR on preview). Both traced to pre-existing structural issues, not regressions. The buffered-POST commit was the right call when Chrome rejected streaming on HTTP/1.1, but it killed live partials wholesale. Fixing it required threading streaming-vs-buffered through the adapter without breaking local dev.

**What did NOT change.** ADR-026 (provider choice + multi-turn dialog architecture) is unchanged. The server-side streaming bridge (`lib/voice/sarvam-stt-server.ts`) and SSE response pipeline (`app/api/transcribe/route.ts`) were already streaming-correct — only the client adapter and page-level greeting flow needed fixes.

---

## 2026-04-26 — App shell: persistent BottomNav mounted via per-route layouts (no route-group rename)

**Related ADR:** ADR-023 (post-save terminal route) — the auto-dismiss target shifts from `/` to `/journey/memory` to close the contribute → see-it-back loop.

**What changed.** `/check-in`, `/check-in/saved`, and `/journey/memory` now share a persistent fixed-bottom `<BottomNav />` so the two MVP screens read as tabs of one app. Mounted via two layouts — `app/check-in/layout.tsx` (existing, edited to add the nav after `{children}`) and `app/journey/layout.tsx` (new, mirrors check-in). Post-save auto-dismiss target flipped from `/` to `/journey/memory`. The "View memory" CTA on `/check-in/saved` is no longer gated by `NEXT_PUBLIC_F02_C1_SHIPPED` — it renders unconditionally.

**Why.** Before this change, the demo flow was disconnected: a tester could do a check-in but the post-save auto-redirect bounced them back to the marketing landing, never closing the loop into Memory. Two disconnected URLs read as two products, not one. The unification is structural — no new feature work, just shell mounting + redirect target — but it is the difference between a "demo of two pages" and "an app you can test end-to-end."

**Why not a route-group rename to `app/(app)/...`.** Considered moving both routes under a parens-wrapped route group with a single shared layout. Rejected because: (a) URLs stay identical with the layout-mounting approach too — Next.js layouts already wrap nested routes — so the route group adds no URL value; (b) layout-mounting requires zero file moves and zero test-path churn; (c) two short layouts is fewer LOC than route-group + a shared `(app)/layout.tsx`. **Threshold for refactor:** if a third app-shell screen ships (e.g., a future Medications or Patterns tab), refactor to a shared route group at that point. Two repeats is below the threshold.

**Why drop the env-flag gate.** `NEXT_PUBLIC_F02_C1_SHIPPED` was a pre-F02-C1 guard so the CTA wouldn't render before Memory existed. F02 C1 has been shipped + live in prod since 2026-04-25. The flag was never flipped on Vercel after F02 C1 shipped — so users had a "View memory" CTA invisible behind a stale env-var. Removing the gate is one fewer env-var dependency and the durable fix.

**Side effect: `MemoryTab` bottom padding bumped.** From `pb-[max(1rem,env(safe-area-inset-bottom))]` to `pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]`. Without it, the last event row scrolls under the now-fixed bottom nav.

**Shipped via PR rewant24/autoimmune-health-companion#6 → squash-merge `c0b5b28`.** The PR also bundled the entire onboarding-shell wave-1 work (welcome + 5 onboarding screens + 4 setup steps + `/home` + 5-pillar `BottomNav` + locked profile seam) because the unification branch was cut from `feat/onboarding-shell-build` rather than `main`. For deadline-driven work this was the correct call (one merge, two cycles to prod); for normal cadence, branch from `main` to keep PRs scoped to one architectural change.

---

## 2026-04-26 — Voice C1 pre-flight: Sarvam streaming STT + TTS + multi-turn dialog (ADR-026 supersedes ADR-018)

**Scope.** Pre-flight Task 0 of the voice C1 cycle (`docs/features/voice-cycle-1-plan.md`). Lays the seam for four parallel build chunks (V.A STT route, V.B STT adapter, V.C TTS route + adapter, V.D follow-up engine) without merging any wave-1 implementation yet. Branch: `feat/voice-sarvam`. Tagged `voice-c1/pre-flight-done`.

- **Decision flip.** ADR-018 deferred Sarvam to post-MVP because three blockers were unresolved: streaming endpoint URL, key handling, server-side proxy path. All three now resolved (`sarvamai` JS SDK + long-lived `api-subscription-key` server-only + Vercel HTTP-streaming proxy). Adds **ADR-026** marking Sarvam as the production voice provider for both STT and TTS, with multi-turn conversational dialog and a single "Switch to taps" bail-out (B3).
- **Sarvam audio-format spikes (run 2026-04-26 against the production key).**
  - **STT streaming codec is PCM/WAV only** — confirmed authoritatively by the SDK's own `SpeechToTextStreamingInputAudioCodec` enum (`wav`, `pcm_s16le`, `pcm_l16`, `pcm_raw`). WebM/Opus is **not** accepted at the protocol level. V.B will ship a WebAudio 16kHz s16le resampler in `lib/voice/sarvam-recorder.ts`. Wire-level smoke (silent 500ms WAV via `socket.transcribe(...)`) confirmed clean handshake at 320 ms with code-1000 close.
  - **TTS REST returns base64-encoded WAV** (`{ request_id, audios: [base64String] }`, default 24 kHz, RIFF header confirmed across 6 voices). Streaming endpoint is `bulbul:v2`-only and unlocks no quality we don't already get from REST + the same v2 voices. V.C will ship a Blob-URL playback path — no `MediaSource`, no WebAudio decode.
  - **Voice picked:** `anushka` on `bulbul:v2`. Fastest in-class (1099 ms full response on the opener line), v2's documented default for `en-IN` female, well-tuned. v3 voices were 200–600 ms slower with no audible payoff for short opener copy.
- **Seam extensions (production code, no transitions yet).**
  - `lib/voice/types.ts`: `VoiceProviderName` widened to `'web-speech' | 'openai-realtime' | 'sarvam'`; new `TtsProvider` interface + `TtsProviderName = 'web-speech' | 'sarvam'` + `TtsSpeakOptions`.
  - `lib/voice/provider.ts`: `resolveVoiceProviderName` accepts `'sarvam'`; new `resolveTtsProviderName` + `getTtsProvider`. Both factories throw `NotImplementedError` for `sarvam` until V.B/V.C land.
  - `lib/voice/web-speech-tts-adapter.ts`: split out from the legacy `tts-adapter.ts`, which is now a re-export shim so existing call sites keep working.
  - `lib/checkin/state-machine.ts`: 5 new union members (`speaking-opener`, `speaking-question`, `listening-answer`, `extracting-answer`, `speaking-closer`) and 8 new events (`OPENER_PLAYED`, `OPENER_FAILED`, `ASK_QUESTION`, `QUESTION_PLAYED`, `ANSWER_TRANSCRIBED`, `ANSWER_EXTRACTED`, `BAIL_TO_TAPS`, `CLOSER_PLAYED`) — no-op reducer cases only, Wave 2 wires real transitions per the protocol in the cycle plan.
- **Test coverage.** Vitest 455/455, tsc clean, `next build` clean. Includes new no-op reducer tests for each of the 5 new state cases + `BAIL_TO_TAPS` invariance + an `Event`-union compile-check for the 8 new event types, plus `resolveTtsProviderName`/`getTtsProvider` factory tests + `NotImplementedError` assertions for both `sarvam` paths.
- **Env scaffolding.** `.env.local.example` now lists `SARVAM_API_KEY`, `VOICE_PROVIDER`, `VOICE_TTS_PROVIDER` (default `web-speech`), and optional `SARVAM_TTS_SPEAKER` / `SARVAM_TTS_MODEL` overrides for A/B-testing the TTS voice without redeploying. Real key is in `.env.local` (gitignored). Spike audio fixtures live under `docs/research/spike-out/` (gitignored).

**Why now.** Pre-flight tagging ahead of the parked-onboarding cycle so the voice branch is in a known-good resume point: the seam is ready, format decisions are real (not guessed), and Wave 1 can dispatch with concrete adapter targets. Onboarding still ships first per the locked 6-cycle plan; voice C1 resumes from `voice-c1/pre-flight-done` once onboarding is in.

**Related.** Adds ADR-026. Supersedes ADR-018.

---

## 2026-04-25 — Product rename: Saumya → Saha (full sweep)

**Scope.** Second pre-launch rename in twelve hours. ADR-024 (Sakhi → Saumya) is now superseded by ADR-025 (Saumya → Saha). No public users; no data migration needed.

- **Brand framing locked (Option B): "endurance + together."** Sanskrit सह means both *to bear* and *with*. The landing-page brand block + footer brand line carry both meanings; gentleness was softening what autoimmune actually asks of patients.
- **App code:** `app/LandingPage.tsx` (Option B copy at the brand block + footer + 3 hero/privacy spots; remaining brand mentions straight-renamed), `app/layout.tsx` page title, `app/privacy/page.tsx`, `app/CheckInGrid.tsx`, `app/WaitlistCount.tsx`, `app/VoiceTranscript.tsx`, `app/check-in/page.tsx`, `app/journey/memory/page.tsx`, `components/check-in/{SpokenOpener,Closer,DiscardConfirm}.tsx`, `lib/checkin/{save-later,types}.ts`, `convex/continuity.ts`, `package.json` name field.
- **Directory rename:** `lib/saumya/` → `lib/saha/` (the rules-engine catalog). 21 import sites updated.
- **`localStorage` keys (none shipped to real users — pre-launch):** `saumya.saveLater.v1` → `saha.saveLater.v1`, `saumya.ttsDisabled` → `saha.ttsDisabled`, `saumya.testUser.v1` → `saha.testUser.v1`. History-state key `saumyaDiscardModal` → `sahaDiscardModal`.
- **Active docs:** scoping, build-plan, system-map, product-taxonomy, tech-stack, features/*, post-mvp-backlog, README, docs/CLAUDE.md, docs/research/sonakshi-lele-interview.md.
- **History docs (immutability exception extension):** ADR-001 through ADR-023 had active brand references updated *Saumya → Saha*. ADR-024 retains its body intact as the historical record of the prior rename — only a `Superseded by ADR-025` header is added. ADR-025 itself documents the extension and remains bounded.
- **Vercel:** project renamed `saumya-health-companion` → `saha-health-companion`; primary host becomes `saha-health-companion.vercel.app`. New `proxy.ts` (Next 16's renamed-from-middleware file convention) issues 308 permanent redirects from all legacy hosts (`saumya-*`, `sakhi-*`, `autoimmune-*`) to the canonical Saha host so existing shared links land on the new home with paths preserved. `vercel.json` redirects were rejected — they're path-based, not host-based; the proxy runs at the edge before page handlers and is the cleanest place for host-conditional 308s.

**Related.** Adds ADR-025. Supersedes ADR-024.

---

## 2026-04-25 — F01 C2 Wave 2 integration + reviewer-fix pass

**Scope.** Wires Build-E (Web Speech TTS opener) and Build-F (Day-1 tutorial, same-day re-entry, milestone celebration) into `app/check-in/page.tsx`, then absorbs the three-reviewer ship-blocker fix list. Tagged `f01-c2/wave-2-integrated` (integration) and `f01-c2/second-pass-clean` (post-fix).

- **Day-1 ribbon — scoping § 477 waiver.** Scoping reads "a small tooltip on each control"; Build-F shipped `Day1Tutorial` as a wrapper that renders one ribbon below its children. Orchestrator wraps the entire `<Stage2>` once instead of per-`TapInput`. **UX-equivalent for v1** — single ribbon below the recap is visually adjacent to the controls, the educational copy is unchanged, and per-control wrapping would either bloat `Stage2` with five ribbons or require a contract change Build-F already shipped against. Per-control polish is on the post-MVP backlog if a usability test surfaces a need.
- **Save-effect race fix.** `useQuery(api.checkIns.getTodayCheckin)` and `useQuery(api.continuity.getContinuityState)` both have a loading window where the page renders against `FALLBACK_CONTINUITY` (which carries `isFirstEverCheckin: true`). The first integration pass collapsed `undefined` (loading) and `null` (no row) via `?? null`, so a save fired during the loading window would (a) write a fresh row that the server rejected as `checkin.duplicate` and (b) trigger a Day-1 milestone for every save. `page.tsx` now tracks `continuityResolved` / `todayCheckinResolved` explicitly and gates `onSave` + the saved-state effect on resolution. `isDay1` also gates on `continuityResolved` so the FALLBACK doesn't briefly force Day-1 mode for repeat users mid-load.
- **`postSaveCloser` for milestone overlay.** `selectCloser(continuityState)` runs against pre-save state, so a save that lands on day-7 sees `streakDays === 6` and returns `neutral-default` ("Saved. See you tomorrow.") instead of `streak-milestone` ("Seven days. That's real."). Page now computes a `postSaveCloser` via `selectCloser({...continuityState, streakDays: streakDays + 1, isFirstEverCheckin: false})` and passes that to `<MilestoneCelebration>` and the `/check-in/saved` redirect.
- **`detectMilestone` guard ordering.** NaN / non-finite / `<= 0` checks now run before the `isFirstEver` short-circuit. Previously a buggy caller passing `(NaN, true)` would get `'day-1'`; now it gets `null`.
- **A11y.** SpokenOpener renders the opener text as `<h1>` (idle screen previously had no heading landmark). `MilestoneCelebration` gains `aria-modal="true"`, a friendly `aria-label` per kind ("7-day streak celebration" rather than "day-7 milestone"), and on-mount focus to the "Keep going" button so keyboard / screen-reader users aren't stranded outside the dialog. Continue button bumped from `bg-teal-600` to `bg-teal-700` for WCAG AA contrast (3.4:1 → 4.7:1 against white). Day1Tutorial ribbon gains `aria-live="polite"` so the educational hint is announced when it appears.
- **TTS un-mute.** SpokenOpener mute popover previously had no path back from `saumya.ttsDisabled === 'true'`. Long-press now re-reads the flag on open and switches the action button to "Un-mute Saumya's voice" when muted; confirming flips the flag and re-speaks the current opener so the user gets immediate confirmation.
- **Milestone visual differentiation.** `day-30` / `day-90` / `day-180` / `day-365` all render the same 30-ring grid (cap). Added a visible tier label ("30 days" / "90 days" / etc.) above the rings — the only place the actual day count is surfaced for the longer milestones.

---

## 2026-04-25 — F01 C2 pre-flight: schema migration + state-machine extension

**Scope.** Cycle 2 pre-flight Task 0 changes that subagents read as a stable contract. Tagged `f01-c2/pre-flight-done` once smoke-tested.

- **Convex schema (`convex/schema.ts`).** All five metrics (`pain`, `mood`, `adherenceTaken`, `flare`, `energy`) now `v.optional` so a row can exist with partial coverage (declined or not extracted). `flare` widened from boolean to tri-state `"no" | "yes" | "ongoing"` per ADR-021 + Cycle 2 scoping. Added `declined: v.optional(v.array(metricLiteral))` and `appendedTo: v.optional(v.id("checkIns"))` for the same-day re-entry path. New `extractAttempts` table indexed by `(userId, date)` enforces ADR-020 cost guard (5 attempts/user/day).
- **Convex handler (`convex/checkIns.ts`).** Validators updated to match optional-metric shape; range checks now gated on `value !== undefined`. `CheckinRow` and `CreateCheckinArgs` exported types track the new schema so `lib/memory/event-types.ts` and tests stay type-safe.
- **State machine (`lib/checkin/state-machine.ts`).** Union extended additively: new states `extracting`, `stage-2`, `discarding`, `celebrating`; `confirming` and `saved` gain optional fields preserving C1-shipped transitions. New events `EXTRACTION_DONE`, `STAGE_2_CONTINUE`, `METRIC_UPDATED`, `METRIC_DECLINED`, `DISCARD_REQUEST/CONFIRM/CANCEL`, `MILESTONE_DETECTED`. Reducer no-ops the new states; subagents (lanes 2.B/2.C/2.D/2.F) implement transition logic for their chunk's events only. `toOrbState` collapses all transient states to `'processing'`.
- **Shared types (`lib/checkin/types.ts`).** New file — single source of truth for `Metric`, `Mood`, `FlareState`, `StageEnum`, `CheckinMetrics`, `ContinuityState`, `OpenerVariantKey`, `MilestoneKind`. Pure types so Convex's typecheck doesn't pull view code into the server bundle.
- **Memory event mapper (`lib/memory/event-types.ts`).** Updated for optional metrics and tri-state flare (`flare === "yes" || flare === "ongoing"` triggers the second event). Switched import to relative path because `convex/tsconfig.json` has no `@/*` alias.
- **Dependencies.** Added `ai`, `@ai-sdk/openai`, `zod` (lane 2.B's extraction route depends on them). `.env.local.example` created with `AI_GATEWAY_API_KEY` placeholder (server-only).
- **Convex dev wipe.** One stale check-in row from F01 C1 testing was deleted (`flare: false` no longer satisfies the new validator). Per Cycle 2 plan — no real users to migrate.

**Gate.** `tsc --noEmit` clean; 152/152 vitest still green; baseline preserved before Wave 1 dispatch.

**Related ADRs.** ADR-005 (skip-Stage-2 routing now structurally expressible), ADR-020 (extraction route deps installed), ADR-021 (stage enum types ready), ADR-022 (save-later v1 contract referenced by lane 2.C). No ADR superseded.

---

## 2026-04-25 — Product rename: Saumya → Saumya (full sweep)

**Scope.** Pre-launch brand rename. ADR-024 records the decision, rationale, and the one-time exception to the ADR-immutability rule.

- **App code:** `app/page.tsx`, `app/layout.tsx`, `app/privacy/page.tsx`, `app/VoiceTranscript.tsx`, `app/CheckInGrid.tsx`, `app/WaitlistCount.tsx`, `package.json` name field, `package-lock.json` name field.
- **Active docs:** scoping, build-plan, system-map, product-taxonomy, tech-stack, features/*, post-mvp-backlog, README, docs/CLAUDE.md.
- **History docs (full sweep, immutability exception):** ADR-001 through ADR-023 (product noun replaced; decision content unchanged), prior entries in this changelog, prior session entries in `build-log.md`.
- **Launch page:** italic *meaning* line in the *Why Saumya* block reads "Saumya means gentle…"; new italic after-note under the waitlist CTA bullets explaining सौम्य.
- **Planned key:** the (not-yet-shipped) save-later `localStorage` key now spec'd as `saumya.saveLater.v1` everywhere it appears (ADR-022 + this changelog). Verified no shipped code uses the old key, so no migration needed.
- **Vercel:** project renamed `sakhi-health-companion` → `saumya-health-companion`; project ID unchanged so deployments, env vars, integrations are intact. Old aliases (e.g. `sakhi-health-companion.vercel.app`) continue to resolve — removing them is a separate decision.

**Related.** Adds ADR-024. No prior ADR superseded.

---

## 2026-04-25 — F01 C2 prep: 6 ADRs locked

**Scope.** Pre-F01-C2 open questions resolved into ADRs 018–023.

- **ADR-018** Sarvam AI voice swap deferred post-MVP. Web Speech remains MVP voice provider.
- **ADR-019** Auth introduction moves out of F01 C2 into F02 work. F01 C2 ships save/confirm/extract with `userId` continuing as a client-trusted arg. Production launch gated on F02 shipping with auth enforced.
- **ADR-020** Metric extraction (`extractMetrics`, F01 chunk 1.D) routed via Vercel AI Gateway + AI SDK from Next.js. Default model `gpt-4o-mini`. Cost guards (input truncation 2000 tokens, output cap 200 tokens, per-user-per-day attempt counter).
- **ADR-021** `stage` enum semantics locked: `"open"` (Stage 2 skipped), `"hybrid"` (transcript + Stage 2 fill), `"scripted"` (no usable transcript). Enables ADR-005 success metric (`count(open) / count(open+hybrid)`).
- **ADR-022** Save-later queue persists to `localStorage` (versioned key `saumya.saveLater.v1`). Retry-on-reload via shipped idempotency contract (`clientRequestId`).
- **ADR-023** Post-save confirmation screen is `/check-in/saved` — stable anchor. CTAs evolve as F02 / F08 land; route does not.

**Related.** No prior ADR superseded. Two pre-existing items confirmed (no new ADR needed): mood enum already locked at `convex/schema.ts:19-25`; idempotency already shipped at `convex/checkIns.ts:122-130`.

**Skipped (deliberate, not punted):** IST timezone canary (post-MVP testers may be outside India; backlog §21 covers the policy gap); ErrorSlot finalization (stays stub through F01 ship per ADR-015 + project rule).

---

## 2026-04-25 — F01 C1 shipped: voice check-in foundation

**Scope.** Feature 01 Cycle 1 (chunks 1.A voice provider, 1.B Convex data, 1.C orb UI) shipped on branch `feat/f01-cycle-1`. Tagged `f01-c1/shipped`.

**What landed.**
- `lib/voice/` — `VoiceProvider` contract + `WebSpeechAdapter` (`en-IN`, continuous + interim) + `OpenAIRealtimeAdapter` stub. Provider resolved from `VOICE_PROVIDER` env, defaults to `web-speech`.
- `convex/schema.ts` + `convex/checkIns.ts` — `checkIns` table, `by_user_date` index, `createCheckin` / `listCheckins` / `getCheckin`. Cursor-on-date pagination. `ConvexError({code,message})` for `checkin.duplicate` / `checkin.invalid_range`. Handlers extracted as plain functions (mock-ctx testable).
- `app/(check-in)/` + `components/check-in/` + `lib/checkin/state-machine.ts` — 7-state reducer (idle → requesting-permission → listening → processing → confirming → saving → saved|error), orb component with 4 visual states + motion-safe animations, `ScreenShell`, `ErrorSlot` (Feature 10 stub).
- `vitest.config.ts` + `tests/setup.ts` + `package.json` scripts — test infra wired.

**Gate at ship.** 88/88 tests pass across 6 files; `tsc --noEmit` clean; `next build` clean. Two rounds of parallel-subagent review (3 reviewers first pass + 1 reviewer second pass). Fix-pass addressed R3-1/3/4/6/7/9/10.

**Deferred to Cycle 2.** Auth enforcement (chunk 1.F — currently trusts `userId` arg), scripted-metric conversation (chunk 1.D), save wiring + confirmation screen (chunk 1.E). See `docs/post-mvp-backlog.md` §20 for auth note, §21 for tz/IST policy.

**Related ADR.** ADR-005 (skip Stage 2 when open-first covers all 5 metrics) — implemented per lock.

---

## 2026-04-25 — F01 C1: checkIns table
- New table `checkIns` with index `by_user_date` on (userId, date).
- Enum `mood`: heavy | flat | okay | bright | great.
- `clientRequestId` for idempotent create. Soft delete via `deletedAt`.
- Existing `waitlist` untouched.

---

## 2026-04-24 — Q1 closed: "support system" is Sonakshi's word

**Related ADR:** none — this is a language/copy decision that aligns with the already-locked § Language conventions.

**What changed.** Q1 in `scoping.md` asked which word Sonakshi uses for the concept previously called "caregiving." Rewant confirmed: **"support system."** Same term already locked in the language-conventions table as the replacement for *caregiver* / *squad* (legal-risk scrub). Now also the canonical in-product word for the concept itself.

**Why.** Removes the last ambiguity between the legal-scrub decision (*"don't say caregiver"*) and the positive naming decision (*"what do we say instead"*). One word does both jobs. Scoping doc now has 0 open questions — fully finalized.

---

## 2026-04-24 — Remaining scoping open questions closed (Q3–Q21)

**Related ADRs:** ADR-003 (five-pillar nav — Community), ADR-007 (five required metrics + data model), ADR-010 (events first-class)

**What changed.**

Eleven open questions in `scoping.md` resolved in one batch. Open-question count moves from 11 to 0 — scoping doc finalized.

1. **Q3 — onboarding screens 1–3 verbatim copy:** deferred into the Thursday L2 landing-page writing session (one writing pass covering both surfaces). Screens 4–5 already locked in the previous entry.
2. **Q4 — condition dropdown source + cardinality:** AARDA master list. **Single-select for MVP**; multi-select deferred to post-MVP backlog #18. Schema stores `conditions: string[]` from day one — MVP writes a single-entry array, post-MVP writes multi-entry, zero migration.
3. **Q5 — searchable dropdown:** yes, searchable type-ahead input (client-side filter over the AARDA list).
4. **Q10 — edit/decline summary card:** inline edit before save; on decline, **discard with confirm dialog** — no draft state, no "unconfirmed" save. Two terminal states only (save or discard) keeps Memory truthful.
5. **Q12 — Memory UI:** full spec landed in § Memory landing. Horizontal calendar strip + filter tabs + reverse-chronological scroll synced to scrubber + client-side keyword search over free-flow bonus-capture text + tap-to-detail sheet with Edit/Delete (follows § Edit/cancel rules).
6. **Q13 — milestone list:** locked at **Day 1 / 7 / 30 / 90 / 180 / 365.** Visualization follows the already-locked Whoop-style ring animation (≤2s) + paired milestone closer variant + single CTA. Non-milestone streak days get no celebration.
7. **Q14 — Whoop-style charts:** 3 charts in MVP — wellness ring, 30-day streak bar, multi-metric stacked line with dose-change markers + flare shaded blocks. **Flare ↔ dosage correlation chart deferred** to post-MVP backlog #19 (build-heavy correlation detection + annotation renderer; core signal is already visible in the stacked line). Sleep/HRV overlays (blocked on wearable integration) and heatmaps (insufficient data density) also deferred.
8. **Q15 — Community channel creation:** no user-created channels for MVP. Channels **auto-created from the AARDA list** at app launch. Removes empty-room problem and a whole moderation surface.
9. **Q16 — Community discovery:** auto-join to the channel matching the user's Setup B.4 condition; related same-family channels surfaced on first entry; full AARDA list browsable/searchable. One-tap join/leave, no approval flow.
10. **Q17 — Community content types:** **text only** for MVP. No images, links-as-cards, polls, long-form. Link auto-hyperlinking fine; unfurling/preview cards not.
11. **Q18 — Community news sharing:** none for MVP. No curated feed, no AI digest, no link cards. Channels are peer conversation only.
12. **Q19 — Community identity:** pseudonym by default. Handle-only (generated suggestion, overwritable), no real name, no avatar upload, no bio.
13. **Q20 — Community moderation:** **Rewant as sole admin for MVP.** Report button on every message → admin queue. Admin actions: hide, remove from channel, global suspend. No community moderators, no automated toxicity filters, no appeals. Explicitly interim — scales only to waitlist-sized base.
14. **Q21 — Community privacy invariant:** hard invariant that Community NEVER auto-surfaces private check-in / Memory / event data. Enforced at the data layer (Community has no read access to those tables; it is its own surface). Users can voluntarily type anything into Community; app-driven auto-share paths are zero.

**Two new post-MVP backlog items (backlog #18, #19).** Multi-select conditions and Flare↔dosage correlation chart. Both have architectural hooks preserving zero-migration paths when they ship.

**Why.**
- *Community locks collectively:* the MVP Community shell had to be shippable safely with a single admin (Rewant) and zero auto-surfacing of private data. Auto-created channels from AARDA, text-only, pseudonymous, one-admin moderation — all of these pick the simplest shape that still delivers "you are not alone" without inheriting the moderation-heavy architecture of a full community platform.
- *Single-select + correlation chart deferrals:* both are valuable signals but build-heavy against the MVP launch window. The schema and event model are already shaped to absorb them later without migration — the cost of shipping later is very close to the cost of shipping now, but the risk of shipping now is higher. Deferred with explicit architectural hooks.
- *Scoping doc finalized:* before this batch, 11 questions remained open. After, 0. The doc is the source of truth and the playbook's scope step is complete; per Rewant's direction we pause here before moving to POC.

---

## 2026-04-24 — Onboarding screens 4–5 locked (Voice check-in + Memory/Patterns) and nudge bank landed

**Related ADR:** ADR-006 (opener rules engine), ADR-009 (closer rules engine), ADR-014 (graduated feedback)

**What changed.**
1. **Onboarding screens 4 and 5 content locked.** Two screens, one feature each, Saumya speaking first-person. Screen 4 = Voice check-in (*"Talk to me. I'll remember."*) — the activation story. Screen 5 = Memory + Patterns (*"Look back. See what's changed."*) — the retention payoff. Doctor Report and Community deliberately excluded from onboarding — Doctor Report lives on the landing page (revenue-track payoff), Community reveals organically.
2. **Nudge bank for non-check-in moments landed** as a new § in scoping.md. 12 lines covering intake tap, dosage/visit capture confirm, Doctor Report generation, annotation, 2+ and 7+ day return, empty Journey/Patterns, missed intake, flare flag, network-retry sync. Separate from the 7-variant closer bank already locked for check-in endings.

Closes open questions #2 and #11 in scoping.md.

**Why.**
- *Onboarding:* Rewant directed a first-person voice and inspiration-only reference to the splash-screen Figma. Two screens (not three) matches the one-feature-per-screen template; Doctor Report doesn't belong in onboarding because it dilutes the daily-use story, and Community is not part of the core loop.
- *Nudge bank:* Every non-check-in interaction still ends with a short line; not having a documented bank would produce ad-hoc copy during build that drifts in voice. Locking the bank now preserves the closer's tone across the app. Reuses closer phrases (*"I'm here"*, *"Today's its own day"*, *"Good to hear you"*) for unified voice across surfaces.

---

## 2026-04-24 — Voice architecture locked: Web PWA for MVP, native apps post-MVP

**Related ADR:** ADR-017 (new) — supplements ADR-002 (stack)

**What changed.** Previously open (Q6 in scoping.md). Voice-first architecture decided: **MVP ships as a web app (Next.js 16 mobile-first, installable as a PWA)** with browser-based voice (Web Speech API fallback, OpenAI Realtime / Vapi as primary) behind a provider interface. Native iOS + Android apps are a post-MVP follow-on reusing the Convex backend and voice provider. Post-MVP backlog item added implicitly (native wrappers).

**Why.** MVP deliverable is a live URL on launch day — native app-store review doesn't clear that window. Rewant confirmed mobile-first is the user reality (*"preferably it should be a mobile-based application"*) but accepted web-for-MVP with native as the follow-on. PWA installability gives the home-screen-app feel without the app-store gate. Provider-interface abstraction means swapping from browser voice to a native mic bridge later is a config change, not a refactor.

---

## 2026-04-24 — Testimonial locked as founder quote (baseline; user quote as upside-swap)

**Related ADR:** ADR-001 (Scope → POC → Build methodology — landing-page deliverable)

**What changed.** Third aha-moment gap (named social proof) closed. Founder quote locked as the shipping baseline for the landing page:

> *"No one should have to be their own medical logbook. Saumya is for the people I've watched try."*
> — Rewant Prakash, Founder

If a Sonakshi-sourced or other waitlist-member named quote arrives before launch, it swaps in; the founder quote is the guaranteed baseline, not the ceiling.

**Why.** The Revenue-track aha-moment rubric asks for one named quote on the landing page. A real user quote is the strongest signal but requires a third-party reply inside a tight window, which is uncertain. A founder quote is honest social proof on its own — founder-market fit is a legitimate story for an early-stage chronic-illness app — and can ship immediately. Picking B2 (mission-framed, shorter) over B1 (problem-framed, longer) reuses the *"logbook"* word from the ROI anchor and persona pitch locked earlier the same day — all three landing-page copy anchors now reinforce the same motif, and B2 is short enough to work as a pull-quote for the launch post on X / LinkedIn. Alternatives not taken: fabricating a user quote (out of bounds), leaving the space empty with a "coming soon" frame (weakest rubric outcome), waiting on Sonakshi before committing copy (risked an empty social-proof row at launch).

---

## 2026-04-24 — One-sentence persona pitch locked

**Related ADR:** ADR-001 (Scope → POC → Build methodology — landing-page deliverable)

**What changed.** One-sentence persona pitch locked as: *"Saumya is for people with chronic autoimmune conditions who shouldn't have to be their own medical logbook."* Ships on the landing page and opens the public launch post.

**Why.** The Revenue-track aha-moment rubric asks for a one-sentence persona job description. Locking one reusable sentence (vs. drafting ad-hoc during launch prep) ensures the landing page and launch post share voice. The sentence reuses the "logbook" motif from the ROI anchor (locked same day), so both pieces of landing-page copy reinforce the same pain framing — *the invisible labor of tracking your own condition between visits.* Alternatives considered: between-visits framing, single-voice/woman-specific framing (dropped for gender narrowness), outcome-forward framing (failed the rubric's ask for a *persona* sentence).

---

## 2026-04-24 — Landing-page ROI anchor locked

**Related ADR:** ADR-001 (Scope → POC → Build methodology — landing-page deliverable)

**What changed.** Landing-page ROI anchor copy locked as: *"Stop being the logbook for your own condition. Saumya remembers every dose change, every flare, every off day — so your doctor sees the full picture, not just today."* Replaces earlier draft (*"One visit you don't have to repeat pays for a year of Saumya."*). Ships on the MVP landing-page push.

**Why.** The earlier draft framed the ROI as saving a repeat visit — which isn't the primary pain. Rewant clarified the pain is the *invisible labor between visits*: patients manually or mentally tracking 2–3 months of symptoms and dosage changes, then compressing it into a 10-minute OPD window. The new copy sells against that cognitive load directly — *"stop being the logbook for your own condition"* names the burden, and the dose-change / flare / off-day list spells out what Saumya actually remembers. Closes with the doctor-outcome tie-in.

---

## 2026-04-24 — Rubric positioning locked on Revenue track

**Related ADR:** ADR-001 (Scope → POC → Build methodology)

**What changed.** Added § Rubric positioning to scoping.md. Revenue track (176-pt ceiling) picked as the target over Virality (164) or MaaS (164). Aha-moment features audited against the Revenue-track rubric; 4 patterns scored (sub-60s time-to-first-value ✅, obvious ROI calc ⚠️, one-sentence persona ⚠️, social proof ❌). Launch-day deliverable timeline mapped to explicit pre-launch gates.

**Why.** The rubric awards most heavily on Signups (20x weight) and Revenue generated (15x), both of which Saumya can clear with a free-tier + founder-tier pricing model and a waitlist already in motion. Virality was ruled out because chronic-illness apps live in a private category — optimizing Saumya for shareable mechanics would distort the product. Three aha-moment patterns are addressable inside MVP scope (ROI copy on landing page, one-sentence persona pitch, one named testimonial).

---

## 2026-04-24 — Language scrub: "squad" / "caregiver" / reference-app names removed

**Related ADR:** ADR-013 (Tripartite Prepare-for-Visit), ADR-016 (Documentation discipline)

**What changed.** All uses of *"caregiver"*, *"squad"*, *"squad member"*, and the reference-app name (Sandy's Squad / Kinery) removed from scoping.md, post-mvp-backlog.md, architecture-changelog.md, and docs/CLAUDE.md. Replaced with **"support system"** and **"support-system member"** where a referent was needed. The reference-app audit that informed tripartite Prepare-for-Visit is now framed as *"a reference-app audit (layout-only inspiration, workflow not ported)."*

**Why.** Rewant has prior working history with Kinery (the company behind the reference app) and flagged using their brand/product language as a legal risk. The Figma reference was used for layout and information-architecture inspiration only — never to port workflows — so scrubbing brand-adjacent terms costs nothing and removes exposure. The "caregiver" term was also flagged in the original language conventions as problematic for the Indian support-system idiom (families, not single caregivers).

---

## 2026-04-24 — Edit / cancel of captured events moved into MVP

**Related ADR:** ADR-010 (Doctor visits + blood work as first-class events)

**What changed.** Edit/cancel of captured events (appointment date fix, duplicate removal, cancelled/no-show/rescheduled status) moved from post-MVP backlog into MVP scope. New subsection added under § Doctor-visit capture. Event model gains a `status` enum (scheduled / completed / cancelled / no-show / rescheduled) and a `linkedEventId` for reschedule chains. Full *check-in content* edit (pain value, mood, flare flag) remains post-MVP — the distinction is between editing *events* (supported) vs editing *self-reported metrics* (deferred).

**Why.** Rewant flagged this as MVP-critical: opportunistic voice capture will produce wrong dates, duplicates, and rescheduled appointments within the first week of use. Without edit/cancel, the timeline degrades into noise and the Doctor Report loses credibility. Cancelled-vs-deleted distinction preserves honest signal for the pattern engine and the report.

---

## 2026-04-24 — Cohort / peer comparison removed from backlog entirely

**Related ADR:** ADR-003 (Five-pillar nav) — specifically the Community pillar's scope

**What changed.** Post-MVP item *"Cohort / peer comparison"* deleted from backlog. Community is explicitly **not** a data-comparison surface — it is a Slack-style peer channel for conversation and solidarity only. No bio-data is shared or compared across users, now or post-MVP.

**Why.** Rewant clarified the intent: Community exists to deliver the "you are not alone" emotional outcome, not to benchmark patients against each other. Cohort comparison invites consent, anonymization, and statistical-significance complexity that isn't part of the product vision at all — keeping it in the backlog was a drift risk.

---

## 2026-04-24 — Provider result attachments and support-system squad mode removed from backlog

**Related ADR:** ADR-013 (Tripartite Prepare-for-Visit)

**What changed.** Two post-MVP items dropped from backlog:
1. *Provider result attachments* — file upload + PHI storage for doctor notes / prescriptions. Removed because the reference-app inspiration was purely layout-based and this workflow was never part of Saumya's own scope.
2. *Squad / caregiver co-use mode* — multi-user squad editing. Removed because the conceptual framing is from the reference app (Kinery / Sandy's Squad), not Saumya's.

The *support-system shared read-only view* (backlog item #5) remains — that one is Saumya-native and was scoped independently. Language updated to *"support system"*, never *"squad"* or *"caregiver"*.

**Why.** Rewant confirmed the reference-app Figma was inspiration only — layout patterns (cards, stepwise forms, checklists) port; workflows (squad coordination, provider file sharing) do not. Keeping those workflows in the backlog created drift toward a product shape Saumya is not.

---

## 2026-04-24 — Monetization first-pass designed (Revenue track targeting)

**Related ADR:** ADR-001 (Scope → POC → Build — now extends to pricing at MVP launch)

**What changed.** Post-MVP item #20 *"Monetization / paywall logic"* expanded from one-line placeholder into a first-pass design: two-tier **Free (Saumya Friend) / Paid (Saumya Companion)** model, ₹199/month or ₹1,499/year in India, $4.99/month or $39/year internationally, Razorpay + Stripe rails, waitlist early-bird gate (first 100 get 3 months free) landing on the MVP launch page. Gates fall on unlimited Memory history, unlimited reports, Patterns view, and future wearable / support-system features. Daily check-in and Community stay free forever.

**Why.** The Revenue track (176-pt ceiling, highest of the three) awards weighted points for *actual revenue generated* and *paid signups*. A visible pricing page at launch — even without live checkout — converts waitlist curiosity into revenue-track evidence. An optional *"Pay ₹99 to skip the waitlist"* founder-tier seeds the *revenue generated* metric at the rubric's scoring moment.

---

## 2026-04-24 — Initial documentation discipline adopted

**Related ADR:** ADR-016 (Documentation discipline)

**What changed.** Established the four-document documentation practice: `scoping.md` + `post-mvp-backlog.md` + `architecture-decisions.md` + `architecture-changelog.md`, supplementing the existing `build-log.md`.

**Why.** MVP scope decisions were accumulating in a single scoping doc with no structured place for deferred items, locked architectural decisions, or change history. Rewant called for explicit documentation from the get-go — including out-of-scope reasoning — so the project has complete context recoverable in any future session.

---

## 2026-04-24 — Check-in pillar renamed to Journey

**Related ADR:** ADR-003 (Five-pillar bottom nav)

**What changed.** The original bottom-nav pillar tentatively called "Check-in" was renamed to "Journey" after recognizing the check-in is an *act* launched from Home, not a destination.

**Why.** Leaving "Check-in" as a pillar created structural redundancy (the act and the destination were the same thing). Journey absorbs the previously-homeless surfaces (Doctor Report, Memory history, Patterns, Flare/Visit timelines) into one "looking back" pillar.

---

## 2026-04-24 — `[LOG]` renamed to "Memory" across all user-facing copy

**Related ADR:** ADR-012 ("Memory" as the user-facing name for check-in history)

**What changed.** Internal placeholder `[LOG]` (used throughout early scoping) was resolved to the user-facing term **"Memory"**. Find-and-replace completed across `scoping.md` (31 occurrences). Future copy uses "Memory" as a proper noun with possessive forms (*"your Memory"*).

**Why.** The original placeholder was too clinical; "Memory" ties directly to the README's brand story (*"Saumya means gentle — the presence that remembers with you"*). Candidate alternatives (Journal, Timeline, Diary) were warmer than `[LOG]` but less brand-operative.

---

## 2026-04-24 — Prepare-for-Visit expanded from two to three content types

**Related ADR:** ADR-013 (Tripartite Prepare-for-Visit flow)

**What changed.** Prepare-for-Visit flow expanded from (Annotations + Questions) to (Checklists + Annotations + Questions). Checklists are Sonakshi-facing only and do NOT render in the doctor-facing PDF.

**Why.** A reference-app audit (layout-only inspiration, workflow not ported) surfaced checklists as a distinct content type — pre-visit to-dos that help a patient walk into the OPD prepared. Adding this closed a real gap without expanding the PDF surface area.

---

## 2026-04-24 — Post-save closer register shifted from affirming to witnessing

**Related ADR:** ADR-009 (Continuity-aware closer)

**What changed.** Earlier draft closer variants included *"one day at a time"* and *"be kind to yourself today"*. These were removed after a research pass flagged them as toxic-positivity-adjacent or prescriptive.

**Why.** Chronic-illness communication research (cystic fibrosis / PsA / invisible illness literature) consistently flags phrases that tell the patient how to feel — the closer should *witness*, not *prescribe*. Replacement variants use companionship framing (*"I'm here"*) and specific factual affirmation (*"Seven days. That's real."*) only at rare streak milestones.

---

## 2026-04-24 — Milestone celebrations narrowed to day 1 / 7 / 30 / 90 / 180 / 365 only

**Related ADR:** ADR-014 (Graduated feedback) / § After save — celebration in scoping.md

**What changed.** Earlier framing implied a celebration could fire on any streak day. Narrowed to only six threshold days (1, 7, 30, 90, 180, 365). No daily streak celebration.

**Why.** Daily streak reinforcement turns chronic-illness tracking into gamification fatigue. Rare milestones feel meaningful; daily milestones feel like an ask.

---

## 2026-04-24 — Doctor report default granularity made dynamic (not fixed 30-day)

**Related ADR:** ADR-011 (Doctor report hybrid PDF)

**What changed.** Original framing implied four fixed report windows (7 / 14 / 30 / 90 days). Shifted to a single auto-refreshed dataset with a Daily / Weekly / Monthly granularity toggle controlled by the user, and a default that auto-picks based on data history.

**Why.** Fixed windows don't match Sonakshi's reality — dosage cadences range from daily to monthly; flare durations from hours to weeks; doctor visits on irregular schedules. One dataset with a toggle covers every case. Pattern borrowed from Whoop's user-adjustable timeframe UI.

---

## 2026-04-24 — Pattern engine locked as rules engine, not LLM

**Related ADR:** ADR-014 (Graduated feedback)

**What changed.** Explicitly ruled out LLM-generated insights for MVP. All verbal insight copy comes from templated rules-engine output.

**Why.** Predictability, speed (no network round-trip at open), safety (no hallucinated correlations), and i18n (fixed templates translate cleanly). Also: a health app cannot tolerate tone drift or invented patterns.
