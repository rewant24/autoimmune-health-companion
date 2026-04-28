# Voice C1 — Bug 1 (empty transcripts) — Full History & Handoff

> **Audience:** an engineer (or fresh Claude session) with zero context.
> Read this end-to-end before forming any hypothesis. Per
> `feedback_diagnose_before_fixing_symptom_reports.md`: capture HAR +
> console + state trace BEFORE forming a fix.

**Status as of 2026-04-28 PM:** Bug 1 is **OPEN**. Two attempted fixes
(Option A codec swap, Option B WAV-header prepend) have both shipped
green tests but failed on the wire — Sarvam still returns
`{type:"final", text:"", durationMs:~260, bytes:N}`. Latest HAR
diagnosis (this session) has changed the framing: the `~260 ms`
duration is **our own 250 ms post-flush safety timeout firing**, not
Sarvam taking time. Sarvam emits zero partials, zero errors, zero
events in that window. The bug is one of:
1. Our flush-wait is too short (Sarvam needs >250 ms to respond), or
2. Our chunked `socket.transcribe()` calls are shape-rejected silently
   by Sarvam's streaming WS protocol.

The cheapest disambiguating experiment (bump 250 ms → 5000 ms,
re-smoke) has **NOT been run yet** — paused so this doc can be
written.

---

## Symptom

Every `POST /api/transcribe` call returns a single SSE frame:

```
data: {"type":"final","text":"","durationMs":~260,"bytes":N}
```

No `partial` frames. No `error` frames. The check-in flow then
cascades downstream: empty transcript → no metrics extracted →
state machine lands on "memo saved" with nothing recorded → user
sees "Save today's check-in" with empty content. F.1 + F.2 already
fixed two adjacent bugs (silence-VAD ownership, stop reentrancy), so
the cascade is now visible cleanly: every turn fails because
**transcription itself returns nothing**.

The /api/speak (TTS) pipeline is **healthy** and unrelated — the
opener plays correctly. The two `net::ERR_ABORTED` entries on
/api/speak in DevTools are React StrictMode dev double-mount
artifacts, not a bug.

---

## Architecture (relevant slice)

```
Browser
  ├── SarvamRecorder (lib/voice/sarvam-recorder.ts)
  │     • WebAudio AudioWorklet, resamples mic → 16 kHz mono s16le PCM
  │     • emits 250 ms chunks (8000 bytes each) as Uint8Array
  │
  └── SarvamAdapter (lib/voice/sarvam-adapter.ts)
        • Two upload modes:
            - Streaming: HTTP/2 streaming POST per chunk (not used in
              practice — Chrome blocks streaming uploads on HTTP/1.1)
            - Buffered: concat all chunks in stop(), then ONE POST
              of the full audio
        • Buffered branch (the one HAR confirms is active) sends:
            Content-Type: audio/wav
            Body: 44-byte WAV header (Option B fix) + concat'd PCM

Server (Next.js 16 App Router, Node.js runtime)
  └── POST /api/transcribe (app/api/transcribe/route.ts)
        • Validates Content-Type ∈ {audio/wav, audio/webm, audio/ogg}
        • Reads SARVAM_API_KEY (server-only)
        • Opens Sarvam streaming WS via lib/voice/sarvam-stt-server.ts
            connect args: model='saaras:v3', input_audio_codec='wav',
                          sample_rate='16000', high_vad_sensitivity='true'
        • Pumps request body chunks via socket.transcribe({audio: <base64>,
            sample_rate: 16000, encoding: 'audio/wav'})
        • On body end: handle.flush(), then 250 ms safety timeout
            → if Sarvam hasn't emitted by then, force-close + emit
              `{type:"final", text:lastTranscript, …}`
        • Returns SSE stream of partial/final/error frames
```

**Key files (full paths):**
- `lib/voice/sarvam-adapter.ts` — browser adapter, both upload paths
- `lib/voice/sarvam-recorder.ts` — WebAudio PCM chunker
- `lib/voice/wav-header.ts` — 44-byte RIFF/WAVE header builder (Option B)
- `lib/voice/sarvam-stt-server.ts` — server-side Sarvam SDK wrapper
- `app/api/transcribe/route.ts` — SSE proxy route
- `tests/voice/sarvam-adapter.test.ts` — adapter unit tests
- `tests/voice/wav-header.test.ts` — header byte-level tests
- `tests/api/transcribe-route.test.ts` — route + Sarvam mock tests

---

## Branch state

- Branch: `feat/voice-sarvam`
- Commits ahead of `origin/feat/voice-sarvam`: **15** (do NOT push
  until Rewant promotes — standing constraint)
- Working tree: clean (after this doc lands)
- Last commit: `df0bfc1 fix(voice): wrap buffered PCM in a real WAV
  header before upload` (Option B)
- Vitest: **779 / 779 passing** (last run on Option B commit)
- Typecheck + build: clean
- Running dev server: port 3001 (port 3000 was in use)

---

## Original two-option plan (saved 2026-04-28 AM)

Plan doc: `docs/voice-c1-bug-1-transcription-fix-plan.md`. The plan
diagnosed Bug 1 from a 23 MB HAR the user captured during a full
onboarding-then-check-in walk. Findings:

- 11 `POST /api/transcribe?lang=en-IN` calls during smoke.
- **Every** response: `{type:"final", text:"", durationMs:~256, bytes:N}`.
- First call's request body, first 60 bytes: all `\x00` — no `RIFF`
  magic. Confirms **raw PCM s16le payload mislabelled as
  audio/wav**. The pre-flight spike had wired the codec mismatch:
  recorder emits PCM, adapter labels it `audio/wav`, route forwards
  with `input_audio_codec='wav'` and per-chunk `encoding='audio/wav'`.
  Sarvam is told "expect WAV" and gets raw PCM with no header → silent
  decode failure → zero events.
- Pre-flight spike (`docs/research/sarvam-format-spikes.md` lines
  70–90) had verified the path with **silent audio** ("zero
  transcripts on silent audio (expected — VAD didn't trigger)") —
  real-speech verification was deferred and that deferred
  verification is what failed.

Two ways to align the contract:

**Option A — server-side codec swap.** Tell Sarvam the truth:
`input_audio_codec: 'pcm_s16le'`, per-chunk `encoding: 'audio/pcm_s16le'`,
adapter Content-Type: `audio/pcm`. No client-side audio shaping
needed. Smaller diff.

**Option B — client-side WAV-header prepend.** Send Sarvam what it
was told to expect: prepend a real 44-byte RIFF/WAVE header to the
buffered PCM in `stop()` before POSTing. Server stays unchanged.

User said "lets start with A and then do B" — interpreted as **A
primary, B fallback if A fails on smoke**.

---

## Option A — what was done and what failed

**Implementation (commits `1555123` + `cf79bc5`):**

- `lib/voice/sarvam-stt-server.ts` — `SARVAM_STT_AUDIO_CODEC = 'pcm_s16le'`.
- `app/api/transcribe/route.ts` — added `audio/pcm` to
  `ACCEPTED_CONTENT_TYPES`.
- `lib/voice/sarvam-adapter.ts:323,464` — Content-Type → `'audio/pcm'`.
- Tests updated to assert new connect args + new Content-Type.

**Smoke result:** Same symptom — empty `final`, no partials. Sarvam
silently emits nothing.

**Discovery during Option A:** The per-chunk `encoding` field on
`socket.transcribe()` is a Pydantic enum on Sarvam's server,
**gated to literally `'audio/wav'` only**, even when `input_audio_codec`
is `pcm_s16le`. Live error from Sarvam (HAR-confirmed):

```
Pipeline error: ... Input should be 'audio/wav' ...
[type=enum, input_value='audio/pcm_s16le', ...]
```

Workaround commit `cf79bc5`: hard-code per-chunk
`encoding: 'audio/wav'` regardless of `input_audio_codec`. This made
the validation pass but didn't restore transcripts — Sarvam still
returned `text:""` on every final. The `pcm_s16le` codec is **type-
accepted by the SDK but silently fails to decode raw PCM bytes** at
Sarvam's runtime decoder layer. No error frame surfaces.

**Outcome:** Option A reverted at commit `ebccaca` —
`revert(voice): undo Option A -- pcm_s16le silently fails to decode`.
Codec back to `'wav'`, Content-Type back to `'audio/wav'`, per-chunk
`encoding='audio/wav'` retained (the A.8 fix; Sarvam's enum gate is
real and orthogonal to the codec choice). Pivoted to Option B per
the pre-authorized fallback.

---

## Option B — what was done and what failed

**Implementation (commit `df0bfc1`):**

New file: `lib/voice/wav-header.ts` — pure `DataView` builder for the
canonical 44-byte RIFF/WAVE header. Hard-pinned to 16 kHz mono 16-bit
(throws on anything else; cycle 1 only supports that recorder shape;
silently accepting a wrong format would mask future regressions).

New tests: `tests/voice/wav-header.test.ts` — 3 byte-level tests
(canonical 44-byte layout, format-validation rejects, zero-length
buffer).

Modified: `lib/voice/sarvam-adapter.ts` — buffered branch now does:

```ts
const pcm = concatChunks(chunks)
const header = writeWavHeader(pcm.byteLength, {
  sampleRate: 16000, channels: 1, bitsPerSample: 16,
})
const body = new Uint8Array(header.byteLength + pcm.byteLength)
body.set(header, 0)
body.set(pcm, header.byteLength)
// POST body, Content-Type: audio/wav
```

Streaming branch in the adapter still posts raw PCM (TODO comment
added at line ~308 — would have the same Sarvam-rejects-without-header
issue if it ever ran, but Chrome blocks HTTP/1.1 streaming uploads in
practice so this branch is dormant).

Tests added to `tests/voice/sarvam-adapter.test.ts`:
- "POSTs with Content-Type audio/wav in buffered mode"
- "prepends a 44-byte RIFF/WAVE header to buffered PCM in stop()
  (Bug 1 Option B)"
- existing "POSTs the concatenated PCM chunks" updated to assert
  `byteLength === 44 + 8`

All 779 vitest pass. Typecheck clean. Build clean. Commit landed.

**Smoke result:** SAME SYMPTOM. Empty transcripts. User reported
"It is still not working when I start the user journey at the
check-in screen … It does not still transcribe." User captured two
fresh HARs:
- `/Users/rewantprakash_1/Downloads/localhost1-checkin.har` (1.0 MB)
- `/Users/rewantprakash_1/Downloads/localhost1-onboarding.har` (5.8 MB)

---

## Latest HAR diagnosis (2026-04-28 PM, this session)

| Field                  | check-in HAR             | onboarding HAR           |
|------------------------|--------------------------|--------------------------|
| Request bytes          | 176,044                  | 728,044                  |
| Audio duration         | 5.5 s                    | 22.75 s                  |
| Content-Type           | `audio/wav` ✓            | `audio/wav` ✓            |
| First 12 wire bytes    | `RIFF…WAVE` ✓            | `RIFF…WAVE` ✓            |
| SSE response           | `final, text:"", durationMs:260, bytes:176044` | `final, text:"", durationMs:268, bytes:728044` |
| Sarvam partials        | **0**                    | **0**                    |
| Sarvam errors          | **0**                    | **0**                    |
| `x-voice-bytes` header | 0 (sent at stream open)  | 0 (sent at stream open)  |

**Smoking gun:** `durationMs` is **~260 ms regardless of audio length**
(5.5 s vs 22.75 s). That equals the **250 ms post-flush safety
timeout in `app/api/transcribe/route.ts` lines 360–365**:

```ts
setTimeout(() => {
  if (!finalized) {
    if (!handle.isClosed) handle.close()
    finalizeAndClose(controller, 'flush_timeout')
  }
}, 250)
```

So we are not measuring "Sarvam returned an empty transcript." We are
measuring "**we closed the socket on Sarvam after 250 ms before it
spoke**." Sarvam stayed completely silent on the WS in that window:
no partials, no errors, no events.

Implication: Bug 1 is NOT a WAV/PCM format problem (Option B
structurally works — the WAV bytes look correct on the wire). It's
either a timing problem or a streaming-protocol-shape problem.

---

## Two competing hypotheses (NOT YET DISAMBIGUATED)

### H1 — Flush-wait is too short

Sarvam's streaming WS legitimately needs more than 250 ms after
the last `transcribe()` + `flush()` call to push the final transcript
back. Buffered uploads expose this because all bytes arrive at the
route in <50 ms, then we flush and impatiently force-close 250 ms
later. Real streaming would have given Sarvam plenty of time across
the audio's duration; buffered upload collapses that timeline.

Test: bump the 250 ms timeout in route.ts:365 to 5000 ms. If Sarvam
emits a real transcript at, say, 1500 ms after flush, **H1 wins.**

### H2 — Chunked transcribe() calls break decoding

The route reads the request body via `body.getReader().read()` in a
loop and calls `handle.sendAudioChunk(chunk)` per chunk. For a
176 KB body over localhost HTTP/1.1 keep-alive, that arrives in
multiple TCP-sized chunks (~16–64 KB each). Each chunk is
base64-encoded and sent as its own `socket.transcribe()` call.

- Chunk 1: 44-byte WAV header + first ~16 KB PCM → Sarvam parses
  the WAV header and starts decoding.
- Chunk 2+: bare PCM bytes with no RIFF header.

With `input_audio_codec='wav'`, Sarvam may treat each
`transcribe()` payload as a self-contained WAV file (chunks 2+ have
no RIFF magic → silently dropped) OR may concatenate them into one
buffer (works fine, in which case H1 wins). The "zero events ever"
behaviour is consistent with silent drop.

Test: still emit nothing after the 5 s timeout bump → H2 wins. Real
fix is then one of:
- Send the entire buffered body in a **single** `transcribe()` call
  (concat all chunks server-side before forwarding).
- Pivot off the streaming WS to Sarvam's REST batch STT endpoint
  (the buffered adapter is anti-streaming anyway — the streaming
  WS adds complexity for no benefit when we already have the whole
  audio in hand).

### H3 (long-tail, less likely)

- Wrong region/auth/key — Sarvam normally returns an `error` frame
  for these, but our handler does swallow some shapes; worth ruling
  out by checking the API key works on a Postman/curl test.
- Audio quality threshold — Sarvam's VAD discards low-amplitude
  audio; the recorded mic input may be too quiet. The user reported
  real speech though, so unlikely.
- Language code mismatch — `en-IN` vs `en-US` doesn't usually mean
  silent rejection.

---

## What's been ruled OUT

- **WAV file format invalid.** HAR confirms `RIFF…WAVE` bytes on
  the wire; structure looks correct (file size = 36 + pcm,
  data chunk size = pcm).
- **Content-Type wrong.** HAR confirms `audio/wav` on request,
  matches route's accept-list.
- **API key missing.** Route would 503 short-circuit before the
  socket opens. We get 200 + SSE stream.
- **Adapter not running.** HAR confirms 1 transcribe call per
  recording (and 3 /api/speak calls — TTS works fine).
- **Sarvam returning an error.** HAR shows zero error frames in
  the SSE stream. Truly silent.
- **/api/speak broken.** Both HARs show 1 successful 200
  (`audio/wav`, ~120 KB) per session; the two `net::ERR_ABORTED`
  entries are React StrictMode dev double-mount artifacts (the
  effect's first fetch is aborted by cleanup when the component
  unmounts and re-mounts in dev mode).

---

## Cheapest next experiment (NOT YET RUN)

One-line dev-only change: bump the post-flush safety timeout in
`app/api/transcribe/route.ts:365` from `250` to `5000`. Re-smoke
once. Three possible outcomes:

1. **Sarvam emits a real transcript at <5 s** → H1 wins. Real fix is
   the longer flush-wait (or wait for Sarvam's `close` event instead
   of timing out at all — let the SDK tell us when it's done).
2. **Still empty after 5 s** → H2 (or H3) wins. Pivot strategy
   options:
   - Send buffered audio in one `transcribe()` call (server-side
     concat before forwarding).
   - Switch to Sarvam REST batch STT (single POST → single transcript;
     streaming WS is overkill for buffered uploads).
3. **Sarvam emits an actual `error` frame** → that error is the
   diagnosis.

No commit needed for the experiment — revert after smoke. If the
fix proves to be "longer wait + stop force-closing," the real
commit is the timeout bump + a `socket.on('close', …)` path that
finalizes naturally.

---

## Standing constraints (DO NOT VIOLATE)

- No `git push origin`, no `vercel …`, no `npx convex deploy …`
  until Rewant explicitly promotes. This work is dev-only.
- One commit per task. Conventional Commits format.
- After each task that ships code: `npm run vitest -- --run`,
  `npm run typecheck`, `npm run build` before moving on.
- Per `feedback_diagnose_before_fixing_symptom_reports.md`: capture
  HAR + console + state trace BEFORE forming a hypothesis. Don't
  pattern-match a fix from "looks like X."

---

## Commit timeline (most recent first, on `feat/voice-sarvam`)

```
df0bfc1 fix(voice): wrap buffered PCM in a real WAV header before upload   ← Option B
ebccaca revert(voice): undo Option A -- pcm_s16le silently fails to decode ← A→B pivot
cf79bc5 fix(voice): pin per-chunk encoding to audio/wav (Sarvam enum gate) ← A.8 retained
1555123 fix(voice): tell Sarvam the audio is pcm_s16le, not wav            ← Option A
d53c3cb docs(voice-c1): log Fix F.1 + F.2 (silence-VAD ownership + stop reentrancy)
ed5c369 fix(voice): make SarvamAdapter.stop() reentrancy-safe              ← F.2
00c08a9 fix(voice): hook owns silence-VAD stop policy                      ← F.1
0119fe5 docs(voice-c1): log Fix D + Fix E in A/B/C fix log
692b2b1 fix(voice): auto-progress idle-greeting → listening on GREETING_PLAYED  ← Fix E
bd5ff10 fix(voice): resume AudioContext on start to unblock PCM chunk flow      ← Fix D
…earlier commits: build cycle, fix-passes A/B/C, Wave 1+2 integrations
```

44 commits total on the branch (plus this doc commit).

---

## Reference docs in this repo

- `docs/voice-c1-bug-1-transcription-fix-plan.md` — the original
  A vs B plan (still valid as background; both options now
  attempted).
- `docs/voice-c1-abc-fix-log.md` — log of fix passes A/B/C/D/E/F.1/F.2
  (state-machine and recorder-lifecycle bugs adjacent to Bug 1).
- `docs/research/sarvam-format-spikes.md` — pre-flight format
  spike (lines 70–90 are the WAV-vs-PCM trap that started this).
- `docs/features/voice-cycle-1-plan.md` — full cycle plan (Wave
  structure, Tasks V.A-V.D).

## Reference memory (Rewant's auto-memory)

- `feedback_diagnose_before_fixing_symptom_reports.md` — diagnose
  before fix; HAR + console + state trace first.
- `feedback_voice_local_smoke_lessons.md` — five reusable bugs from
  voice C1 local smokes (Turbopack env inlining, Chrome HTTP/2
  streaming, WS connect race, SSE event mismatch, finalPromise
  allocation timing).
- `project_saha_session_resume.md` — last session resume note
  (pre–Option-B; needs an update once Bug 1 closes).

---

## Resolution (2026-04-28 evening) — Option C: pivot to Sarvam REST batch

Closed by ADR-028. Neither H1, H2, nor H3 was the right hypothesis to chase — the streaming-WS protocol was the wrong tool for our usage pattern, and tweaking flush timing or chunk size on the wrong protocol would have produced more "phantom fixes."

**Root cause (re-stated, definitive).** Sarvam's streaming WS is **VAD-segmented**. The SDK's `socket.flush()` only triggers a final transcript when the connection was opened with `flush_signal=true` as a query param — undocumented in the SDK type surface, only visible in `node_modules/sarvamai/dist/esm/api/resources/speechToTextStreaming/client/Client.mjs`. Our adapter buffers the entire utterance client-side and POSTs it as a single frame in <50 ms. With no `flush_signal=true`, the server waits for VAD-detected silence to emit anything; we then force-close the socket 250 ms later, so the server emits zero events. Result: every `final` carries `text=""`, regardless of audio quality, codec, or WAV-header presence.

**Recorder validation.** Before pivoting, `/tmp/last-upload.wav` was analysed in Node.js: valid 44-byte RIFF/WAVE header, 16 kHz mono 16-bit, RMS=0.041, peak=0.31, real voice-activity profile, no clipping or DC offset. Audio is fine. Bug is in protocol choice.

**Fix shipped.** REST batch endpoint (`POST https://api.sarvam.ai/speech-to-text`, multipart form-data) replaces the streaming WS bridge. Buffered upload → synchronous transcript → SSE `final` frame to the browser. No VAD, no flush, no timing race.

**Code delta:**
- New: `lib/voice/sarvam-stt-rest.ts` (`transcribeBatch` + `SarvamRestError`).
- New: `tests/voice/sarvam-stt-rest.test.ts` (17 tests).
- Rewritten: `app/api/transcribe/route.ts` (now buffer → REST → SSE).
- Rewritten: `tests/api/transcribe-route.test.ts` (16 tests).
- Deleted: `lib/voice/sarvam-stt-server.ts` (streaming WS bridge — no source code referenced it after the rewrite).
- Tradeoff: live word-by-word `partial` SSE frames are gone (REST batch is synchronous; partials are conceptually impossible). ADR-027's silence VAD + StopButton remain — UX is "speak → silence-VAD or StopButton triggers stop() → transcript appears." The check-in page already handled the partials-absent path.
- Caps tightened in the route: 1 MB / 30 s (down from 5 MB / 90 s) to match Sarvam REST limits.

**Validation.** 797/797 vitest, `tsc --noEmit` clean, `next build` green. Live smoke on `next dev` is the next step (handed to Rewant).

**Why neither H1, H2, nor H3 was the answer.** H1 (250 ms post-flush wait too short) would still have left `flush_signal=true` missing; tuning the wait would not have changed the outcome. H2 (chunked transcribe) is closer to Sarvam's intended streaming usage but would have layered chunk-boundary fragility on top of the same flush-signal gap. H3 (long-tail silent failure) would have surfaced *some* events for some sessions if the recorder were the issue; the symptom is universal, which is the tell that the protocol path is broken, not the audio. The right move was to question the protocol choice itself.

---

*Doc written 2026-04-28 PM by Claude (Opus 4) at Rewant's request,
before starting a fresh chat for the next diagnostic step. Resolution
section appended same evening.*
