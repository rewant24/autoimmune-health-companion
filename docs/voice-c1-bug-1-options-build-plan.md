# Voice C1 — Bug 1 — Options A / B / C Build Plan

> Companion to `voice-c1-bug-1-history.md` and
> `voice-c1-bug-1-transcription-fix-plan.md`. This doc lays out the full
> build plan for each of the three live options, then re-checks whether
> the recommended option (A — pivot to REST batch) actually closes
> Bug 1 or just shifts it.

**Branch:** `feat/voice-sarvam` (15 commits ahead of `origin/feat/voice-sarvam`).
**Constraint:** dev-only — no `git push origin`, no `vercel …`, no
`npx convex deploy …` until Rewant explicitly promotes.
**Discipline:** one commit per task; `npm run vitest -- --run`,
`npm run typecheck`, `npm run build` clean before each task lands.

---

## What we know going in

| Fact                                                    | Source                                              |
|---------------------------------------------------------|-----------------------------------------------------|
| Sarvam streaming WS uses VAD-based segmentation.        | Streaming API docs (`high_vad_sensitivity` 0.5/1s). |
| `flush_signal=true` is required for `flush()` to act.   | SDK `Client.mjs:41-43` — separate query param.      |
| `vad_signals=true` emits `speech_start`/`speech_end`.   | Streaming API docs.                                 |
| Sarvam REST batch is a single multipart POST.           | `client.speechToText.transcribe({file,…})` SDK.     |
| REST batch caps audio at 30 s, synchronous response.    | REST API docs.                                      |
| REST accepts WAV, MP3, AAC, FLAC, OGG, PCM, more.       | `SpeechToTextTranscriptionRequest.d.mts`.           |
| Our buffered audio has no trailing silence.             | Recorder stops on user-action (tap/silence VAD).    |
| Our `flush()` is currently a no-op on the server.       | Inferred from missing query param + HAR silence.    |
| HAR confirms WAV bytes on wire are valid (`RIFF…WAVE`). | `voice-c1-bug-1-history.md` §"Latest HAR".          |

---

## Option A — Pivot to REST batch

**Thesis:** stop using the streaming WebSocket for what is fundamentally
a buffered upload. Replace the streaming WS server module with a thin
REST batch caller. Keep the SSE response shape intact so the browser
adapter doesn't change.

### Files touched

| File                                   | Change                                                                                                  |
|----------------------------------------|---------------------------------------------------------------------------------------------------------|
| `lib/voice/sarvam-stt-rest.ts`         | NEW — `transcribeBatch(audio: Uint8Array, languageCode: string): Promise<{transcript, durationMs, requestId}>`. Wraps `client.speechToText.transcribe({file, model:'saaras:v3', mode:'transcribe', language_code})`. |
| `app/api/transcribe/route.ts`          | REWRITE — read full body, call `transcribeBatch`, emit ONE SSE `final` frame, close stream. Drop streaming-WS plumbing (handle, pendingTranscript, pendingError, pendingClose, flush_timeout, abort race). |
| `lib/voice/sarvam-stt-server.ts`       | DELETE (or quarantine to `_archive/`). Re-add later if streaming returns.                                |
| `tests/voice/sarvam-stt-rest.test.ts`  | NEW — mock SDK, assert request shape (model, language_code, file bytes), error handling.                |
| `tests/api/transcribe-route.test.ts`   | REWRITE — drop WS-mock setup; mock `transcribeBatch`; assert SSE `final` frame shape on happy path + error paths (415, 503, 502, byte cap, timeout). |
| `tests/voice/sarvam-stt-server.test.ts`| DELETE (no longer applicable).                                                                          |
| `lib/voice/sarvam-adapter.ts`          | NO CHANGE — adapter still POSTs `audio/wav` body, still parses SSE `final` frame. **This is the load-bearing reason to keep the SSE shape.** |
| `lib/voice/wav-header.ts`              | NO CHANGE — REST batch accepts WAV; we keep producing valid WAV.                                        |
| `docs/architecture-decisions.md`       | NEW ADR-027 — pivoted from streaming WS to REST batch for Bug 1; rationale + when streaming returns.    |
| `docs/architecture-changelog.md`       | New entry referencing the ADR.                                                                          |
| `docs/build-log.md`                    | New "Bug 1 — Option A pivot" entry.                                                                     |
| `docs/voice-c1-bug-1-history.md`       | Append "Resolution" section after smoke passes.                                                         |

### Tasks (sequential; one commit each)

| # | Task                                                                                              | Validation                                        |
|---|---------------------------------------------------------------------------------------------------|---------------------------------------------------|
| A.0 | **Recorder-output validation spike (5 min, see Inference Re-Check § below).** Add temp `if (process.env.SAHA_DUMP_AUDIO === '1')` branch in route to write request body to `/tmp/last-upload.wav`. Smoke once. Open in QuickTime/Audacity. **Block A.1+ if it isn't audible voice.** Revert the dump branch in same commit-or-discard. | Listening test. |
| A.1 | Write `lib/voice/sarvam-stt-rest.ts` + unit tests. Pure function, mock the SDK.                  | `vitest -- sarvam-stt-rest --run` green.          |
| A.2 | Rewrite `app/api/transcribe/route.ts` to call `transcribeBatch` and emit one SSE `final` frame.  | New route tests green; old WS tests removed.      |
| A.3 | Delete `lib/voice/sarvam-stt-server.ts` + its tests; remove unused imports.                      | `tsc` clean.                                      |
| A.4 | Full repo: `npm run vitest -- --run`, `npm run typecheck`, `npm run build`.                      | All green.                                        |
| A.5 | Live smoke on `next dev` (port 3001). Capture HAR. Walk: open check-in → speak → confirm transcript appears. | Real transcript text in SSE final frame. |
| A.6 | Write ADR-027 + update changelog + update build-log + append "Resolution" to bug-1 history.      | Docs commit.                                      |
| A.7 | Update memory (`project_saha_session_resume.md` + `feedback_voice_local_smoke_lessons.md`).      | Memory file edits.                                |

### Risks

- **R-A1: SDK `file` parameter shape in Node.js.** `Uploadable` accepts `ReadStream | Blob | Buffer` per `core/file`. We have `Uint8Array`; need to wrap in a Node `Blob` (`new Blob([uint8array], {type:'audio/wav'})`) or write to a tmp file. *Mitigation:* test in A.1 — fall back to `fetch` against `https://api.sarvam.ai/speech-to-text` directly with `FormData` if SDK is awkward.
- **R-A2: REST endpoint behaves differently for the same WAV bytes.** Possible if there's a real recorder bug (see A.0). Validation step A.0 catches this before A.1+ is wasted effort.
- **R-A3: Adapter still expects streaming partials.** The adapter handles `partial` events but doesn't require them — REST batch sends only `final`, which the adapter already handles. *Mitigation:* re-read `sarvam-adapter.ts:634-688` (`handleSseEvent`); the `partial` path is optional. Confirmed: no change needed.
- **R-A4: 30 s cap mismatch with our 90 s server cap.** A check-in voice memo is well under 30 s in practice, but our route's `MAX_DURATION_MS = 90_000` and `MAX_AUDIO_BYTES = 5MB` would now allow uploads Sarvam can't process. *Mitigation:* drop server cap to 30 s + 1 MB; surface a typed `voice.session_too_long` error to the client.
- **R-A5: REST cost may differ from streaming.** Docs note: "Pricing differs for REST and Batch APIs." *Mitigation:* not a Bug 1 concern; flag in the ADR for finance.

### Exit criteria

- Live smoke produces a real transcript on the SSE final frame (text non-empty, matches what the user said).
- 779+ vitest tests green; tsc + build clean.
- Build-log + ADR-027 + changelog updated.
- Bug 1 closes in `voice-c1-bug-1-history.md`.

### Estimated diff size

Net **negative** — route shrinks from ~415 lines to ~100; we delete the
~262-line WS server module and add a ~50-line REST module. About −400
LoC including test rewrites.

---

## Option B — Stay on streaming WS, fix the missing flags

**Thesis:** keep the streaming-WS protocol but add the two query params
we forgot (`flush_signal=true`, `vad_signals=true`), bump the post-flush
timeout, and switch from "force-close after 250 ms" to "let
`socket.on('close')` finalize naturally."

### Files touched

| File                                     | Change                                                                                                    |
|------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `lib/voice/sarvam-stt-server.ts`         | Add `flush_signal:'true', vad_signals:'true'` to connect args; expose `events`-typed messages via callbacks. |
| `app/api/transcribe/route.ts`            | Bump 250 ms post-flush timeout to 5000 ms (or, better, remove the timeout and rely on `socket.on('close')`); listen for `events`-typed `speech_end` to finalize earlier. |
| `tests/voice/sarvam-stt-server.test.ts`  | Update connect-args assertions; add `events` message-handler tests.                                       |
| `tests/api/transcribe-route.test.ts`     | Update timeout-related assertions.                                                                        |
| `lib/voice/sarvam-adapter.ts`            | NO CHANGE.                                                                                                |
| `docs/architecture-changelog.md`         | New entry — flush_signal + vad_signals enabled.                                                            |
| `docs/build-log.md`                      | "Bug 1 — Option B fix" entry.                                                                             |

### Tasks (sequential; one commit each)

| # | Task                                                                                              | Validation                                        |
|---|---------------------------------------------------------------------------------------------------|---------------------------------------------------|
| B.0 | Recorder-output validation spike (same as A.0). Block on audible-voice check.                    | Listening test.                                   |
| B.1 | Add `flush_signal:'true'` + `vad_signals:'true'` to `connectSarvamStt` args; tests updated.       | Tests green.                                      |
| B.2 | Bump or remove post-flush timeout in route.ts. Wire `events` messages → finalize on `speech_end`. | Tests green.                                      |
| B.3 | Live smoke. Three branches:                                                                       |                                                   |
|     | • Real transcript arrives → Bug 1 closed via Option B.                                            |                                                   |
|     | • Still empty + `events` shows `speech_end` fired → Sarvam finalized but transcript was empty (audio quality / language code). Pivot to recorder validation. |  |
|     | • Still empty + no `events` → VAD never fired → buffered upload model is fundamentally wrong → pivot to A. |                                            |
| B.4 | Build-log + changelog updates.                                                                    | Docs commit.                                      |

### Risks

- **R-B1: VAD still won't fire on a buffered upload that has no trailing silence.** This is the architectural mismatch noted in my prior reply. Adding `flush_signal=true` lets `flush()` work — but the entire model assumes Sarvam is producing transcripts as VAD detects silence in a real-time stream. Replaying a 5.5 s clip in <50 ms is not a real-time stream. **High likelihood B doesn't fully solve Bug 1.**
- **R-B2: Cost.** Streaming WS connections cost more per minute than REST batch in many provider pricing models (open-socket overhead). Worth checking in the ADR.
- **R-B3: Complexity tax stays.** All the WS plumbing (waitForOpen, pendingTranscript, abort race, flush timeout, base64 encoding, chunk semantics) remains in the codebase — and would need to be revisited again next time we touch voice.

### Exit criteria

Same as A — real transcript on SSE final frame. If B.3 lands in branch
"still empty + no events," Option B is **abandoned** and we pivot to A;
the work done in B.1 + B.2 stays committed (it's correct anyway) and
A.1+ runs on top.

### Estimated diff size

Small — ~30 lines changed plus test updates. Net positive ~50 LoC.

---

## Option C — Diagnostic timeout-bump experiment (no fix)

**Thesis:** before committing to A or B, run the cheapest possible
experiment to confirm whether VAD-based finalization ever fires on a
buffered upload. One-line route edit, one smoke, capture HAR, revert.

### Files touched

| File                                     | Change                                                                                                     |
|------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `app/api/transcribe/route.ts:365`        | Bump `250` → `5000`. **Reverted in same task.** No commit lands on the branch.                              |

### Tasks

| # | Task                                                                                              | Validation                                        |
|---|---------------------------------------------------------------------------------------------------|---------------------------------------------------|
| C.1 | Edit route.ts:365 in-place (no commit yet).                                                       | —                                                 |
| C.2 | Live smoke once. Capture HAR. Note `durationMs` value, partials count, `events`/error frames.    | HAR file saved, observed values noted.            |
| C.3 | Triage outcome (three branches as in B.3).                                                       | Diagnosis recorded in build-log.                  |
| C.4 | Revert the bump (working tree clean).                                                            | `git status` clean.                               |
| C.5 | Decide A or B based on result. Commit a single build-log entry capturing the experiment's result. | Build-log commit on branch.                       |

### Risks

- **R-C1: Cheap but inconclusive without `vad_signals=true`.** Without that query param Sarvam doesn't tell us *why* it's silent — VAD-not-fired vs decode-failed are indistinguishable. *Mitigation:* combine with adding `vad_signals=true` for the experiment-only run, since that's a one-line addition too.
- **R-C2: Recorder-output bug would still be invisible.** If recorder PCM is silence/garbage, a 5 s wait won't help. *Mitigation:* run the A.0 listening spike before C.1.

### Exit criteria

We know which of H1 / H2 / H3 wins. Build-log records the data point.
Branch is unchanged structurally (only a single docs commit).

### Estimated diff size

Zero net code change; one build-log paragraph.

---

## Inference Re-Check — does Option A actually close Bug 1?

This is the part I want to be honest about. My prior recommendation
("pivot to REST batch") was based on architectural reasoning, not on
having proven the recorder produces real audio. Let me audit the chain.

### What the HAR proves

- Browser POSTs `audio/wav` body of N bytes to `/api/transcribe`.
- Body's first 12 bytes are `RIFF…WAVE`.
- Server returns SSE `final` with empty `text`, `durationMs ≈ 260`.

### What the HAR does *not* prove

- That the bytes between byte 44 and byte N are **audible voice**. They could be:
  - Audible voice → REST batch fixes Bug 1.
  - Silence (zero PCM samples) → VAD has nothing to fire on; **REST batch will also return an empty transcript**. Bug 1 doesn't close.
  - DC bias / continuous noise → Sarvam may transcribe garbage or empty; behaviour TBD.
  - Wrong sample rate (e.g., 48 kHz PCM labelled as 16 kHz in the WAV header) → playback is sped up/slowed down, transcription quality varies.

### Why my prior recommendation could be wrong

If the recorder is broken, all three options (A, B, C) fail. The
streaming WS empty `final` would then have a different root cause
(silent input, not flush-timing or protocol mismatch), and pivoting
upload tools fixes nothing.

I argued strongly for A based on protocol-level analysis. That analysis
is correct *if* the input bytes are good. **It assumes the upstream
recorder is fine, which we have not verified.**

### The validation that should happen first (Task A.0 / B.0 / pre-C.1)

5-minute experiment, no commits required:

1. Add `if (process.env.SAHA_DUMP_AUDIO === '1') { fs.writeFileSync('/tmp/last-upload.wav', body) }` at the top of the route's body handler.
2. `SAHA_DUMP_AUDIO=1 npm run dev` on port 3001.
3. Smoke: open check-in → speak a known sentence ("the quick brown fox jumps over the lazy dog") → tap stop.
4. `open /tmp/last-upload.wav` in QuickTime / VLC / Audacity.

**Three outcomes:**

| What you hear                 | Diagnosis                                                       | Next step                                  |
|-------------------------------|-----------------------------------------------------------------|--------------------------------------------|
| Your voice, clearly           | Recorder is fine. Bug 1 is upstream protocol/timing.            | Proceed to **Option A** with high confidence. |
| Silence / DC noise            | Recorder is producing zero audio. Worklet wiring or AudioContext suspended. | Fix recorder first; A/B/C all moot. |
| Voice but sped-up / chipmunk  | Sample-rate mismatch in WAV header vs actual PCM rate.           | Fix WAV-header sampleRate or recorder downsample; then A. |
| Voice with clipping / static  | float→s16 conversion bug.                                        | Fix recorder; then A.                      |

This is the diagnostic discipline from
`feedback_diagnose_before_fixing_symptom_reports.md` — capture the
artifact, don't pattern-match.

### Honest verdict

- **If A.0 says recorder is fine:** Option A is the right call and will
  close Bug 1. Recommendation stands.
- **If A.0 says recorder is broken:** Bug 1 is misdiagnosed. None of A,
  B, C fixes it. Real fix is in `lib/voice/sarvam-recorder.ts`.

### Refined sequence I recommend

1. **Run A.0 / B.0 first** — listen to `/tmp/last-upload.wav`. This is
   the single most important diagnostic step we have not yet taken.
2. **If recorder is fine → Option A** (REST batch). Smaller code, no
   VAD/flush/timing concerns, matches the buffered upload model.
3. **If recorder is broken → fix the recorder** before touching the
   upload path. Then pick A vs B based on whether real-time partials
   are wanted (for now, A; B if/when we deploy on HTTP/2+ Vercel and
   want streaming partials).
4. **Skip Option B as a primary path.** Even with the missing flags
   added, the architectural mismatch (buffered audio + streaming WS)
   means we'd be paying complexity tax for no UX win in the buffered
   case. B is a viable fallback only if A surfaces an unexpected
   blocker.
5. **Skip Option C as a separate step.** It's subsumed by A.0 + the
   first A.5 smoke. If A surfaces empty transcripts, C-style timeout
   bumps won't help (A doesn't have a timeout to bump).

### What I'd commit to today, in order

| Step | Action                                                                  | Outcome                       |
|------|-------------------------------------------------------------------------|-------------------------------|
| 1    | A.0 listening spike. Decide: recorder OK / broken.                      | Diagnostic data point.        |
| 2    | If recorder OK: A.1–A.7 in sequence.                                    | Bug 1 closed via REST batch.  |
| 2′   | If recorder broken: recorder-fix cycle (separate plan), THEN A.1–A.7.   | Bug 1 closed properly.        |
| 3    | Build-log + ADR-027 + memory updates.                                   | Documented.                   |
| 4    | Hand to Rewant for promotion (push + Vercel deploy).                    | Out of dev-only state.        |

---

*Doc written 2026-04-28 PM by Claude (Opus 4) at Rewant's request,
after re-reading `voice-c1-bug-1-history.md`, the Sarvam streaming WS
docs, the REST API docs, and the SDK source (`Socket.mjs`,
`Client.mjs`, `SpeechToTextTranscriptionRequest.d.mts`).*
