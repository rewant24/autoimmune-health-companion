# Voice friction inventory (2026-05-24)

Scope: known frictions in the voice conversational loop on `/check-in`, cross-referenced against current code at `app/check-in/page.tsx`, `lib/voice/*`, and `lib/checkin/*`. Memos consulted are listed at the bottom; where a memo's claim diverges from code, code wins.

---

## Active frictions (still present in code)

### P0

**F-01. Extract-429 silent cliff-edge — Stage 2 fallback instead of voice continuity.**
On the 6th voice turn of a day, `/api/check-in/extract` 429s (ADR-020 cost-guard, 5 calls/user/day in prod). The catch branch at `app/check-in/page.tsx:901-909` dispatches `EXTRACTION_FAILED` regardless of error class — both `ExtractDailyCapError` and `ExtractFailedError` collapse to the same reducer event. There is a `// No-op marker` comment at line 906 explicitly acknowledging the daily-cap branch is unhandled. The salvaged helper `lib/checkin/extract-failure-fallback.ts` referenced in backlog #25 is **not present** in the tree — PR #21 was closed without merge and never re-landed. So a user who hits the cap silently drops out of voice into the scripted Stage 2 card with no spoken explanation. Same cliff-edge as before PR #21.
- Citation: `app/check-in/page.tsx:901-909`; `lib/checkin/extract-metrics.ts:35-48`; backlog `docs/post-mvp-backlog.md:266-286`.
- Source memo: `feedback_server_429_ux.md` (lib/route layer is rate-limited-aware for the Sarvam STT path, but the *extract* route does NOT propagate `rate_limited` through to the UI — the lib only exposes `ExtractDailyCapError`).

### P1

**F-02. Provider lifecycle is one-way — re-entering `speaking-question` from anywhere but `speaking-opener` does not arm the mic.**
Backlog #25 root-cause hypothesis still holds in the current tree: the orb-tap → opener → listening path is the only fully-tested entry into `speaking-question`. The reducer can route `extracting → speaking-question` (page.tsx:874-887 dispatches `ASK_QUESTION` from a happy-path extraction with missing metrics) and `extracting-answer → speaking-question` for re-asks (page.tsx:1077-1083), but the page-level orchestration that arms the Sarvam provider for the follow-up listen lives in a different effect. Verifying whether the mic re-arms on every entry path requires the integration harness backlog #25 calls for — I could not confirm from static reading alone.
- Citation: `app/check-in/page.tsx:874-887, 1077-1115`; backlog `docs/post-mvp-backlog.md:278-280`.
- Source memo: `feedback_voice_local_smoke_lessons.md` §5 (adapter reuse across turns) + memory `project_saha_voice_c1_fix_f.md` (silence-VAD ownership in the hook).

**F-03. `parseErrorPayload` collapses unknown `voice.*` server codes to `network`.**
`lib/voice/sarvam-adapter.ts:969-` only explicitly maps `voice.rate_limited` → `rate-limited`. The 429 UX memo flagged this exact latent bug: every other code (`session_too_large`, `unprocessable`, `provider_unconfigured`, `aborted`) silently surfaces as `network` in the UI. Still present.
- Citation: `lib/voice/sarvam-adapter.ts:969-981`.
- Source memo: `feedback_server_429_ux.md` "Latent bug logged in code (not fixed in PR #20)".

**F-04. Buffered-only Sarvam upload — no in-turn streaming.**
`resolveMode()` auto path was pinned to `buffered` after the 2026-04-29 hot-fix (`docs/hotfixes/voice-c1-streaming-pcm.md` per backlog 22.5). PCM ships once on `stop()`. For ~30s turns on Wi-Fi the post-stop window is invisible. For longer turns or slow networks, the user sees the orb spin with no indication that upload has started. No upload-progress affordance (backlog 22.2).
- Citation: backlog `docs/post-mvp-backlog.md:238` (22.5), `:228` (22.2); `lib/voice/sarvam-adapter.ts` retains the streaming branch but it is dormant.
- Source memo: `feedback_voice_local_smoke_lessons.md` §2 (HTTP/2 streaming-upload constraint that drove the pivot).

**F-05. Named positive medications not extractable from voice; no clarification turn for ambiguous adherence.**
"I took my methotrexate" today logs zero intakes — the extractor has `simpleAdherence`, `skippedMedications`, `dosageChanges` but no `takenMedications`. "I took my medication" should trigger a "which one?" follow-up but does not. Breaks the voice-first covenant for users whose check-in centres on medication.
- Citation: backlog 22.7 `docs/post-mvp-backlog.md:236`; `lib/checkin/medication-extract.ts` (verified file exists; schema confirmation deferred to deeper read).
- Source: backlog 22.7.

### P2

**F-06. Per-user rate-limits absent on `/api/transcribe` and `/api/speak`.**
Per-connection caps only (5MB / 90s on transcribe). Auth gating the right answer; cost-blast bounded by Sarvam's own throttle today. Not user-facing friction yet but a UX rough edge once a buggy retry loop fires.
- Citation: backlog 22.3 `docs/post-mvp-backlog.md:230`.

**F-07. Streaming TTS decode not implemented.**
`/api/speak/route.ts` buffers the full Sarvam TTS response before returning. Opener / question / closer are short enough (2-6s) that first-byte latency does not bite at C1. Worth revisiting only if utterance length grows or slow-network feedback surfaces.
- Citation: backlog 22.1 `docs/post-mvp-backlog.md:226`.

**F-08. Memory tab events are not tap-to-detail.**
Adjacent to voice — a user who voice-logged a check-in cannot tap the resulting Memory row to read the transcript she said. `EventRow` exposes `onTap` but no consumer wires it.
- Citation: backlog 22.6 `docs/post-mvp-backlog.md:234`.

**F-09. Confirm-card stack threshold — no grouped presentation past N=3.**
Memory note `feedback_confirm_card_stack_threshold.md` flags that stacked confirm cards work at N≤3; current code renders `MedicationConfirmCard` + multiple `EventConfirmCard`s sequentially (page.tsx:1175, 1222, 1233, 1327, 1361, 1372). No grouped UI yet. Becomes friction once a turn extracts ≥4 confirmable items.
- Source memo: `feedback_confirm_card_stack_threshold.md`.

---

## Resolved (memo flagged it, code shows it's fixed)

**R-01. SSR/CSR hydration mismatch (React #418) from inline `localStorage` / `matchMedia` reads.**
Memo `feedback_ssr_safe_browser_only_checks.md` and the ship-day-smoke memo both flagged React #418 from inline browser-only reads. Current page (`app/check-in/page.tsx:264-287, 329-335`) uses the `useState(null) + useEffect` post-mount pattern for `userId`, `todayIso`, `profileName`, `prefersReducedMotion`. PR #29 (per project memory header) merged SSR-safe `SpokenOpener`. Fixed.

**R-02. `SarvamAdapter.stop()` reentrancy + silence-VAD double-stop empty POST.**
Memo `project_saha_voice_c1_fix_f.md` documents the F.1/F.2 fix. Current `sarvam-adapter.ts:183, 461-470` has `stopPromise` cached so concurrent `stop()` callers share one invocation; `silenceListeners` (line 142) + `onSilence()` (line 244) hand silence-VAD to the hook instead of self-stopping. Fix landed via PR #12 squash-merge `1a63036` per memo header.

**R-03. `finalPromise` allocated late in `start()`.**
Memo `feedback_voice_local_smoke_lessons.md` §5 said the promise must be allocated at the top of `start()`. Current code allocates at `sarvam-adapter.ts:290`, well before any await — matches the recommended pattern.

**R-04. ConfirmSummary fall-through bug (the F01 C2 ship-day miss).**
Memo `feedback_ship_day_manual_smoke.md` describes a `confirmingRef` post-commit mirror bug. Current `confirmingRef` is set imperatively from a state transition effect (`app/check-in/page.tsx:586`) and consumed via snapshot reads (lines 1162, 1310). Fixed at commit `21ef267` per memo.

**R-05. Sarvam SDK `connect()` race + SSE event-name dispatch mismatch.**
Memo `feedback_voice_local_smoke_lessons.md` §3 + §4. Superseded by the REST-batch transport pivot (ADR-028, supersedes ADR-027 streaming WS) — the streaming-WS race is moot now that the production path is REST. `sarvam-stt-rest.ts` is the live transport.

**R-06. Sarvam 429 surfaces as `rate-limited` end-to-end on the STT path.**
`lib/voice/sarvam-stt-rest.ts:153-211` correctly emits `voice.rate_limited` with `Retry-After` honored; adapter maps it through to UI kind `rate-limited`. Per PR #20.

---

## Out-of-loop friction (felt nearby — pacing, copy, etc.)

- **No tap-stop affordance during follow-up listen if the provider isn't armed** — coupled with F-02 above. If F-02 manifests, even the always-visible "Switch to Taps" button (page.tsx:1470, `BAIL_TO_TAPS`) might not unblock because the orb state is wrong.
- **Day-1 first-ever voice opener has no name slot until profile resolves** — `app/check-in/page.tsx:272-279` documents the gotcha. The fix is in place (`profileResolved` flag), but the comment itself flags how easy this class of "name-less greeting" bug is to reintroduce.
- **Re-ask copy variation depth unverified** — `selectFollowUpQuestion(metric, attempt, continuityState)` is called with `attempt=1` from the freeform catch (page.tsx:880) and `attempt=2` from the first re-ask (page.tsx:1077). Whether attempt-3+ copy degrades gracefully or repeats is a UX question, not a bug.
- **"Switch to Taps" is forward-only by design** — per ADR-026 / bail-out B3. Not friction, but the irreversibility is worth listing because users who tap it then realise voice is faster lose their session.

---

## Sources consulted

Memory files:
- `~/.claude/projects/-Users-rewantprakash-1/memory/feedback_voice_local_smoke_lessons.md`
- `~/.claude/projects/-Users-rewantprakash-1/memory/project_sakhi_voice_sarvam.md`
- `~/.claude/projects/-Users-rewantprakash-1/memory/feedback_ship_day_manual_smoke.md`
- `~/.claude/projects/-Users-rewantprakash-1/memory/feedback_diagnose_before_fixing_symptom_reports.md`
- `~/.claude/projects/-Users-rewantprakash-1/memory/feedback_server_429_ux.md`
- `~/.claude/projects/-Users-rewantprakash-1/memory/project_saha_voice_c1_fix_f.md`

Project files (all under `/Volumes/Coding Projects + Docker/autoimmune-health-companion/`):
- `app/check-in/page.tsx`
- `lib/voice/sarvam-adapter.ts`
- `lib/voice/sarvam-stt-rest.ts`
- `lib/checkin/extract-metrics.ts`
- `docs/post-mvp-backlog.md` items 22.x, 25
- `docs/architecture-decisions.md` (ADR-018, ADR-020, ADR-026 — and ADR-027/028 referenced)
- `docs/build-log.md` (voice-tagged session entries)

Items I could not verify from static reading alone (flagged in the body where they appear): provider-arming behaviour on `speaking-question` re-entry (F-02), and the depth of re-ask copy variations beyond attempt 2.
