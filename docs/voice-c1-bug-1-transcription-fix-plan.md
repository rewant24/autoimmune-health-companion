# Voice C1 — Bug 1 (empty transcripts) — Fix Plan

> **Audience:** an engineer with zero context for this codebase. Every
> file path is exact. Every test and code block is complete. Two options
> presented in parallel; pick one *after* reading both.

**Goal:** make `/api/transcribe` return real transcripts instead of
`{type:"final", text:"", durationMs:~256, bytes:N}` on every call.

**Architecture:** the browser produces raw 16-bit little-endian PCM at
16 kHz mono via `SarvamRecorder` (WebAudio resampler). The adapter
POSTs those bytes to `/api/transcribe` labelled as `Content-Type:
audio/wav`. The route opens a Sarvam streaming WebSocket with
`input_audio_codec: 'wav'` and forwards each chunk with
`encoding: 'audio/wav'`. **Sarvam expects a `RIFF…WAVE` header on
`wav`-typed audio and gets none** → zero transcript events → the
route's 250 ms post-flush safety timeout fires → empty `final` frame.
Two ways to align the contract: tell Sarvam the truth (Option A,
"server-side"), or send Sarvam what it was told to expect (Option B,
"client-side").

**Tech Stack:** Next.js 16 App Router, `sarvamai` SDK (streaming STT
WebSocket), Vitest 1.x, jsdom test env, TypeScript strict.

---

## Background — what the HAR proved (2026-04-28)

HAR file: `/Users/rewantprakash_1/Downloads/localhost.har` (23 MB,
221k lines, captured during the user's onboarding-then-check-in
walk on `localhost:3000`).

- 11 `POST /api/transcribe?lang=en-IN` calls during the smoke session.
- **Every** response: `data: {"type":"final","text":"","durationMs":~256,"bytes":N}`.
- First call's request body, first 60 bytes: `\x00 × 60` — no `RIFF`
  magic, no `WAVE` chunk identifier. Confirms raw PCM s16le payload.
- `Content-Type: audio/wav`, `bodySize` 80 KB – 752 KB across the 11
  calls (matches 2.5 s – 23 s of 16 kHz mono 16-bit audio).
- Downstream `/api/check-in/extract`: first call returns
  `{"metrics":{"pain":null,"mood":null,"adherenceTaken":null,"flare":null,"energy":null}}`,
  later calls return 429 (the `5/user/day` cost-guard burning out on
  empty inputs). Both are *symptoms* of Bug 1, not separate bugs.

The pre-flight spike (`docs/research/sarvam-format-spikes.md` lines
70–90) decided to send PCM s16le bytes labelled as
`audio/wav` — and verified the path with **silent audio** that
produced "zero transcripts on silent audio (expected — VAD didn't
trigger)". Real-speech verification was deferred to V.B's manual
smoke. That deferred verification is what just failed.

---

## Pre-flight (shared by both options)

Branch state at start: `feat/voice-sarvam`, 11 commits ahead of
`origin/feat/voice-sarvam`, working tree clean. Vitest baseline
**773/773 passing** (per `docs/voice-c1-abc-fix-log.md` after F.2).

Constraints carried over from the prior session and still in force:
- No `git push origin`, no `vercel …`, no `npx convex deploy …`
  until Rewant explicitly promotes.
- One commit per task. Conventional Commits format.
- After each task: run `npm run vitest -- --run`, `npm run typecheck`
  (or `npx tsc --noEmit`), and `npm run build` before moving on.

Manual-smoke verification (whichever option you ship):

1. Start dev: `npm run dev` → http://localhost:3000.
2. Walk: `/onboarding/1` → finish setup with name "Harish" →
   `/check-in` → tap green orb → say a real sentence ("I feel
   tired today, my pain is about a 4 out of 10").
3. Watch the network tab: the `/api/transcribe` SSE response should
   contain `partial` frames with non-empty `text`, then a `final`
   frame with the full sentence.
4. Confirm the next state-machine transition lands on Stage 2 with
   metrics auto-filled (or "Switch to taps" path if extraction
   declines).

If transcription is now working but the user still lands on "memo
saved" without Stage 2, that's a separate state-machine bug — file
it as Bug 1b and stop here.

---

## Option A — server-side codec swap (smaller diff)

> Tell Sarvam the truth: `pcm_s16le`, not `wav`. The recorder is
> already PCM-native; the only WAV in the system was a *label*.

### File structure (Option A)

- Modify: `lib/voice/sarvam-stt-server.ts` — change the audio-codec
  constant from `'wav'` to `'pcm_s16le'`; update the per-chunk
  `encoding` value the SDK forwards.
- Modify: `app/api/transcribe/route.ts:51-55` — extend
  `ACCEPTED_CONTENT_TYPES` to include `audio/pcm` (and keep
  `audio/wav` for backwards-compatibility during the cutover).
- Modify: `lib/voice/sarvam-adapter.ts:323,464` — flip the request
  `Content-Type` from `'audio/wav'` to `'audio/pcm'`.
- Modify (tests): `tests/api/transcribe-route.test.ts` — assert the
  new connect args and per-chunk encoding.
- Modify (tests): `tests/voice/sarvam-adapter.test.ts` and
  `tests/voice/sarvam-adapter-streaming.test.ts` — assert the new
  `Content-Type` header on the outgoing fetch.

No new files. No new tests beyond the ones updated.

### Tasks (Option A)

#### Task A.1: failing test for the route's new connect args

**Files:**
- Modify: `tests/api/transcribe-route.test.ts`

- [ ] **Step 1: add a test asserting `pcm_s16le` reaches Sarvam**

Add this test inside the existing `describe('/api/transcribe')` block
(near the other "happy path" tests; search for `connectArgs`). The
fake-state plumbing already exists from `FakeSocket` / `fakeState`
in this file (lines 30–110); reuse it.

```ts
it('forwards audio as pcm_s16le, not wav, to Sarvam', async () => {
  process.env.SARVAM_API_KEY = 'test-key'

  // 4-byte fake PCM payload (no WAV header on purpose).
  const body = new Uint8Array([0x00, 0x01, 0x00, 0x01])
  const req = new Request('http://localhost/api/transcribe?lang=en-IN', {
    method: 'POST',
    headers: { 'content-type': 'audio/pcm' },
    body,
  })

  const { POST } = await import('@/app/api/transcribe/route')
  const res = await POST(req)
  // Drain the SSE so the route finishes and connectArgs is recorded.
  await res.text()

  expect(fakeState.connectArgs).toMatchObject({
    input_audio_codec: 'pcm_s16le',
    sample_rate: '16000',
  })
  // The per-chunk `encoding` flows through `socket.transcribe`.
  // FakeSocket.sentChunks captures it.
  expect(fakeState.socket?.sentChunks[0]).toMatchObject({
    encoding: 'audio/pcm_s16le',
    sample_rate: 16000,
  })
})
```

- [ ] **Step 2: run it and watch it fail**

```
npx vitest run tests/api/transcribe-route.test.ts -t "forwards audio as pcm_s16le"
```

Expected: FAIL — current code asserts `input_audio_codec: 'wav'` and
`encoding: 'audio/wav'`.

#### Task A.2: change the codec constant + accepted content types

**Files:**
- Modify: `lib/voice/sarvam-stt-server.ts:34`
- Modify: `app/api/transcribe/route.ts:51-55`

- [ ] **Step 3: update `SARVAM_STT_AUDIO_CODEC`**

In `lib/voice/sarvam-stt-server.ts`:

```ts
// Before:
export const SARVAM_STT_AUDIO_CODEC = 'wav' as const
// After:
export const SARVAM_STT_AUDIO_CODEC = 'pcm_s16le' as const
```

The constant is consumed twice in the same file (in the `connect`
call at line 119 and in `socket.transcribe` at line 210). Both pick
up the new value automatically.

- [ ] **Step 4: extend the route's accepted content-types**

In `app/api/transcribe/route.ts:51-55`:

```ts
// Before:
const ACCEPTED_CONTENT_TYPES = new Set([
  'audio/wav',
  'audio/webm',
  'audio/ogg',
])
// After:
const ACCEPTED_CONTENT_TYPES = new Set([
  'audio/pcm',
  'audio/wav', // legacy, kept for one cycle to avoid a hard cutover
  'audio/webm',
  'audio/ogg',
])
```

- [ ] **Step 5: re-run the failing test — it should pass**

```
npx vitest run tests/api/transcribe-route.test.ts -t "forwards audio as pcm_s16le"
```

Expected: PASS.

- [ ] **Step 6: run the full route test file — fix any pre-existing
  asserts that were pinned to `'wav'`**

```
npx vitest run tests/api/transcribe-route.test.ts
```

Likely failures: any `expect(fakeState.connectArgs).toMatchObject({
input_audio_codec: 'wav' })` and any `expect(...sentChunks[0]
).toMatchObject({ encoding: 'audio/wav' })`. Update those literals
to `'pcm_s16le'` / `'audio/pcm_s16le'` respectively. **Do not loosen
the assertions** — they're load-bearing for protocol regression.

Expected: all green.

#### Task A.3: failing test for the adapter's new request `Content-Type`

**Files:**
- Modify: `tests/voice/sarvam-adapter.test.ts`

- [ ] **Step 7: add a test asserting `audio/pcm` on the outgoing fetch**

Find the existing buffered-mode test that asserts request shape
(search for `Content-Type` and `audio/wav`). Add or replace one case:

```ts
it('POSTs with Content-Type audio/pcm in buffered mode', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init! })
    // Return a minimal SSE final frame so the adapter resolves cleanly.
    const body = new TextEncoder().encode(
      'data: {"type":"final","text":"hi","durationMs":10,"bytes":4}\n\n',
    )
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  const adapter = new SarvamAdapter({
    language_code: 'en-IN',
    fetchImpl,
    streamingMode: 'buffered',
    // … existing test seams (recorderFactory, getUserMediaImpl …)
  })
  await adapter.start()
  // Feed 4 bytes via the test recorder seam, then stop.
  // (Use whatever helper the existing tests use — search for
  //  `feedChunk` or `emitChunk` in this file.)
  await adapter.stop()

  expect(calls).toHaveLength(1)
  expect(
    (calls[0].init.headers as Record<string, string>)['Content-Type'],
  ).toBe('audio/pcm')
})
```

If the existing tests use a `recorderFactory` test seam that returns
a fake recorder with an `emit(chunk)` helper, reuse that. Don't
invent a new seam — keep the diff small.

- [ ] **Step 8: run it and watch it fail**

```
npx vitest run tests/voice/sarvam-adapter.test.ts -t "audio/pcm"
```

Expected: FAIL — current adapter sends `audio/wav`.

#### Task A.4: flip the adapter's request `Content-Type`

**Files:**
- Modify: `lib/voice/sarvam-adapter.ts:323`
- Modify: `lib/voice/sarvam-adapter.ts:464`

- [ ] **Step 9: replace the two `audio/wav` literals**

```ts
// lib/voice/sarvam-adapter.ts:323 (streaming-mode fetch headers)
// Before: headers: { 'Content-Type': 'audio/wav' },
// After:
headers: { 'Content-Type': 'audio/pcm' },
```

```ts
// lib/voice/sarvam-adapter.ts:464 (buffered-mode fetch headers)
// Before: headers: { 'Content-Type': 'audio/wav' },
// After:
headers: { 'Content-Type': 'audio/pcm' },
```

- [ ] **Step 10: re-run the new + existing adapter tests**

```
npx vitest run tests/voice/sarvam-adapter.test.ts tests/voice/sarvam-adapter-streaming.test.ts
```

Update any test that pinned `'audio/wav'` for parity (same rule as
A.6: don't loosen, just retarget the literal).

Expected: all green.

#### Task A.5: full suite + typecheck + build

- [ ] **Step 11: vitest**

```
npm run vitest -- --run
```

Expected: 773/773 (or higher if the new test was added net) — no
regressions.

- [ ] **Step 12: typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 13: next build**

```
npm run build
```

Expected: clean.

#### Task A.6: commit

- [ ] **Step 14**

```
git add lib/voice/sarvam-stt-server.ts app/api/transcribe/route.ts \
        lib/voice/sarvam-adapter.ts \
        tests/api/transcribe-route.test.ts \
        tests/voice/sarvam-adapter.test.ts \
        tests/voice/sarvam-adapter-streaming.test.ts
git commit -m "fix(voice): tell Sarvam the audio is pcm_s16le, not wav

Bug 1 from the 2026-04-28 HAR diagnosis. The recorder produces
raw PCM s16le and the adapter labelled it audio/wav, so the
server told Sarvam to decode bytes that lacked a RIFF/WAVE
header. Sarvam emitted zero transcript events and the route's
250ms safety timeout finalised every call with text:''.

Aligns the protocol with what the recorder actually sends:
- SARVAM_STT_AUDIO_CODEC: 'wav' -> 'pcm_s16le'
- /api/transcribe accept-list: + audio/pcm
- adapter Content-Type: audio/wav -> audio/pcm
- tests retargeted accordingly

No new behaviour, no new code paths — just truthful labels."
```

#### Task A.7: live smoke

- [ ] **Step 15: start dev + walk the smoke**

```
npm run dev
```

Walk steps from the Pre-flight section. Confirm:
- DevTools Network shows `/api/transcribe` returning **non-empty**
  `partial` and `final` frames (open the SSE response, not just
  the response size).
- Stage 2 lands with at least one metric pre-filled.

If it works → handoff to Bug 2 (greeting name) and Bug 3
("Switch to taps" visibility). If it doesn't → see "If Option A
fails on the wire" below.

### If Option A fails on the wire (Sarvam rejects `pcm_s16le`)

The `sarvamai` SDK type def
(`SpeechToTextStreamingInputAudioCodec`) lists `pcm_s16le` as a
valid `input_audio_codec`. The per-chunk `encoding` string is
*less* documented; if Sarvam emits `voice.network` errors on the
first chunk, try these in order without re-running the whole
plan:

1. `encoding: 'audio/pcm'` (explicit, instead of the templated
   `audio/${SARVAM_STT_AUDIO_CODEC}` → `audio/pcm_s16le`).
2. `encoding: 'audio/L16; rate=16000'` (RFC 3551 Linear-16 MIME).
3. `encoding: undefined` — the SDK's default may be inferred from
   `input_audio_codec`.

Each is a single-line change in `lib/voice/sarvam-stt-server.ts:210`.
If none work → fall back to Option B (the format that the spike
*intended* to ship and that Sarvam definitively accepts).

---

## Option B — client-side WAV-header prepend (bigger diff)

> Send Sarvam what it was told to expect: a real WAV. Prepend a
> 44-byte RIFF/WAVE header to the buffered PCM at stop().

### File structure (Option B)

- Create: `lib/voice/wav-header.ts` — pure helper that builds a
  44-byte RIFF/WAVE header for a known-length PCM s16le 16 kHz
  mono buffer. No DOM, no Buffer — `DataView` only, so it runs in
  jsdom and node tests without polyfills.
- Create: `tests/voice/wav-header.test.ts` — byte-level assertions
  (offsets, magic strings, length fields).
- Modify: `lib/voice/sarvam-adapter.ts:454-465` — buffered-mode
  branch: prepend the header to the concatenated PCM before POSTing.
- Modify (tests): `tests/voice/sarvam-adapter.test.ts` — assert the
  outgoing body starts with `RIFF` + correct length fields.
- **Streaming mode is OUT OF SCOPE for Bug 1.** The current dev
  smoke is on `next dev` (HTTP/1.1) which already forces buffered
  mode. Streaming-mode WAV is harder (length-unknown header) and
  is only used on Vercel, where we can defer to either (a) a
  separate cycle once buffered ships, or (b) Option A applied to
  the streaming path only. Document this limitation in the commit.

No accept-list change needed: `audio/wav` is already accepted by
the route (line 51 of `route.ts`).

### Tasks (Option B)

#### Task B.1: failing test for the WAV-header builder

**Files:**
- Create: `tests/voice/wav-header.test.ts`

- [ ] **Step 1: write the test file**

```ts
import { describe, expect, it } from 'vitest'
import { writeWavHeader } from '@/lib/voice/wav-header'

const PCM_16K_MONO = { sampleRate: 16000, channels: 1, bitsPerSample: 16 } as const

describe('writeWavHeader', () => {
  it('writes the canonical 44-byte RIFF/WAVE header', () => {
    const pcmByteLength = 32000 // 1 second @ 16k mono 16-bit
    const header = writeWavHeader(pcmByteLength, PCM_16K_MONO)

    expect(header.byteLength).toBe(44)

    const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
    const ascii = (offset: number, len: number) =>
      String.fromCharCode(...new Uint8Array(header.buffer, header.byteOffset + offset, len))

    expect(ascii(0, 4)).toBe('RIFF')
    // chunkSize = 36 + dataSize (little-endian uint32 at offset 4)
    expect(view.getUint32(4, true)).toBe(36 + pcmByteLength)
    expect(ascii(8, 4)).toBe('WAVE')
    expect(ascii(12, 4)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16)         // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1)          // PCM
    expect(view.getUint16(22, true)).toBe(1)          // mono
    expect(view.getUint32(24, true)).toBe(16000)      // sample rate
    expect(view.getUint32(28, true)).toBe(32000)      // byte rate = sr * ch * bps/8
    expect(view.getUint16(32, true)).toBe(2)          // block align = ch * bps/8
    expect(view.getUint16(34, true)).toBe(16)         // bits per sample
    expect(ascii(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(pcmByteLength)
  })

  it('rejects non-PCM-s16le shapes for cycle 1', () => {
    expect(() =>
      writeWavHeader(100, { sampleRate: 16000, channels: 2, bitsPerSample: 16 }),
    ).toThrow(/mono/)
    expect(() =>
      writeWavHeader(100, { sampleRate: 44100, channels: 1, bitsPerSample: 16 }),
    ).toThrow(/16000/)
    expect(() =>
      writeWavHeader(100, { sampleRate: 16000, channels: 1, bitsPerSample: 8 }),
    ).toThrow(/16-bit/)
  })
})
```

- [ ] **Step 2: run it and watch both tests fail**

```
npx vitest run tests/voice/wav-header.test.ts
```

Expected: FAIL — module not found.

#### Task B.2: implement `writeWavHeader`

**Files:**
- Create: `lib/voice/wav-header.ts`

- [ ] **Step 3: write the implementation**

```ts
/**
 * Build a 44-byte canonical RIFF/WAVE header for a PCM s16le buffer
 * of known length. Used by the Sarvam adapter to wrap recorder
 * output before POSTing to /api/transcribe so Sarvam can decode it
 * with `input_audio_codec: 'wav'`.
 *
 * Cycle 1 only supports 16 kHz mono 16-bit; anything else throws
 * because the recorder is hard-pinned to that shape and silently
 * accepting a wrong format would mask future regressions.
 *
 * Wire format reference: http://soundfile.sapp.org/doc/WaveFormat/
 */

export interface WavFormat {
  sampleRate: number
  channels: number
  bitsPerSample: number
}

export function writeWavHeader(pcmByteLength: number, fmt: WavFormat): Uint8Array {
  if (fmt.sampleRate !== 16000) {
    throw new Error('wav-header: cycle 1 only supports 16000 Hz')
  }
  if (fmt.channels !== 1) {
    throw new Error('wav-header: cycle 1 only supports mono')
  }
  if (fmt.bitsPerSample !== 16) {
    throw new Error('wav-header: cycle 1 only supports 16-bit')
  }

  const header = new Uint8Array(44)
  const view = new DataView(header.buffer)
  const writeAscii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) header[offset + i] = s.charCodeAt(i)
  }

  const byteRate = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8)
  const blockAlign = fmt.channels * (fmt.bitsPerSample / 8)

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + pcmByteLength, true) // file size - 8
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)                // fmt chunk size
  view.setUint16(20, 1, true)                 // PCM
  view.setUint16(22, fmt.channels, true)
  view.setUint32(24, fmt.sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, fmt.bitsPerSample, true)
  writeAscii(36, 'data')
  view.setUint32(40, pcmByteLength, true)

  return header
}
```

- [ ] **Step 4: re-run the wav-header tests — both should pass**

```
npx vitest run tests/voice/wav-header.test.ts
```

Expected: PASS (2/2).

#### Task B.3: failing test for the adapter wrapping PCM in WAV

**Files:**
- Modify: `tests/voice/sarvam-adapter.test.ts`

- [ ] **Step 5: add an assertion that the buffered POST starts with RIFF**

```ts
it('prepends a WAV header to buffered PCM in stop()', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init! })
    const body = new TextEncoder().encode(
      'data: {"type":"final","text":"hi","durationMs":10,"bytes":4}\n\n',
    )
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  const adapter = new SarvamAdapter({
    language_code: 'en-IN',
    fetchImpl,
    streamingMode: 'buffered',
    // … existing test seams (recorderFactory etc.)
  })
  await adapter.start()
  // Feed exactly 4 PCM bytes via the existing test seam.
  await adapter.stop()

  const body = calls[0].init.body as Uint8Array
  expect(body.byteLength).toBe(44 + 4) // header + 4 PCM bytes
  // ASCII "RIFF" at offset 0
  expect(String.fromCharCode(...body.slice(0, 4))).toBe('RIFF')
  expect(String.fromCharCode(...body.slice(8, 12))).toBe('WAVE')
  // Header data-length field equals the PCM length
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  expect(view.getUint32(40, true)).toBe(4)
})
```

- [ ] **Step 6: run it and watch it fail**

```
npx vitest run tests/voice/sarvam-adapter.test.ts -t "prepends a WAV header"
```

Expected: FAIL — body starts with `\x00`, not `RIFF`.

#### Task B.4: implement WAV wrapping in `SarvamAdapter.stop`

**Files:**
- Modify: `lib/voice/sarvam-adapter.ts:454-465`

- [ ] **Step 7: import the helper and prepend the header**

At the top of `lib/voice/sarvam-adapter.ts` (with the other imports):

```ts
import { writeWavHeader } from './wav-header'
```

In the buffered-mode branch of `stop()` (current lines 451–465),
replace:

```ts
// Before:
const body = concatChunks(this.pcmChunks, this.pcmByteLength)
this.pcmChunks = []
this.pcmByteLength = 0

this.uploadController = new this.abortControllerCtor()
const url = `${this.endpoint}?lang=${encodeURIComponent(this.language_code)}`
this.fetchPromise = this.fetchImpl(url, {
  method: 'POST',
  body,
  signal: this.uploadController.signal,
  headers: { 'Content-Type': 'audio/wav' },
} as RequestInit)
```

with:

```ts
// After:
const pcm = concatChunks(this.pcmChunks, this.pcmByteLength)
this.pcmChunks = []
this.pcmByteLength = 0

const header = writeWavHeader(pcm.byteLength, {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
})
const body = new Uint8Array(header.byteLength + pcm.byteLength)
body.set(header, 0)
body.set(pcm, header.byteLength)

this.uploadController = new this.abortControllerCtor()
const url = `${this.endpoint}?lang=${encodeURIComponent(this.language_code)}`
this.fetchPromise = this.fetchImpl(url, {
  method: 'POST',
  body,
  signal: this.uploadController.signal,
  headers: { 'Content-Type': 'audio/wav' },
} as RequestInit)
```

- [ ] **Step 8: re-run the new + existing adapter tests**

```
npx vitest run tests/voice/sarvam-adapter.test.ts
```

Existing tests that asserted body length will need their fixtures
updated (the body is now 44 bytes longer than before). Search for
`byteLength` and `body.length` inside the file. **Don't blanket-add
44** — re-derive the expected length from the test's PCM payload
size + 44 so the assertion still proves something.

Expected: PASS.

#### Task B.5: streaming-mode fallback note

**Files:**
- Modify: `lib/voice/sarvam-adapter.ts:300-348`

- [ ] **Step 9: leave streaming-mode as-is + add a TODO comment**

Streaming mode (line ~302) does not get the header — the body is
written chunk-by-chunk and we don't know the final length up front.
Adding a placeholder-length WAV header (`0xFFFFFFFF` data size) is
non-trivial and Sarvam may or may not accept it. For Cycle 1, leave
streaming mode alone and add a comment so the next reader knows:

```ts
// Streaming mode: open the request stream + fire fetch BEFORE the
// first chunk arrives so the upload is hot-pipelined.
//
// TODO(voice-c1-bug-1): the streaming branch still POSTs raw PCM
// labelled audio/wav. This works on `next dev` only because that
// path is HTTP/1.1 and Chrome forces buffered mode anyway (see
// resolveMode below). On Vercel (HTTP/2+) this path WILL emit
// empty transcripts the same way buffered did. Either:
//   (a) apply Option A to this path only (codec=pcm_s16le), or
//   (b) write a streaming WAV header with placeholder length.
// Defer to a follow-up cycle; buffered fix unblocks local smoke.
const ts = new TransformStream<Uint8Array, Uint8Array>()
```

(Edit only the comment block — no behaviour change in this task.)

#### Task B.6: full suite + typecheck + build

- [ ] **Step 10: vitest**

```
npm run vitest -- --run
```

Expected: 775/775 (773 baseline + 2 new wav-header + 1 new adapter
case − 1 if you replaced an existing test, etc — derive from your
actual diff). No regressions.

- [ ] **Step 11: typecheck**

```
npx tsc --noEmit
```

- [ ] **Step 12: build**

```
npm run build
```

#### Task B.7: commit

- [ ] **Step 13**

```
git add lib/voice/wav-header.ts \
        lib/voice/sarvam-adapter.ts \
        tests/voice/wav-header.test.ts \
        tests/voice/sarvam-adapter.test.ts
git commit -m "fix(voice): wrap buffered PCM in a real WAV header before upload

Bug 1 from the 2026-04-28 HAR diagnosis. The recorder emits raw
PCM s16le and the adapter POSTed it as audio/wav, so Sarvam's
WAV decoder saw zero RIFF magic and emitted no transcripts.

Adds lib/voice/wav-header.ts (pure DataView, jsdom-safe) and
prepends a 44-byte canonical RIFF/WAVE header to buffered uploads
before POST. Streaming-mode upload still ships raw PCM and is
left for a follow-up — local 'next dev' is HTTP/1.1 which forces
buffered mode anyway; Vercel preview will need the streaming
fix before voice C1 ships to prod.

No protocol change on the server: route still tells Sarvam
input_audio_codec=wav, encoding=audio/wav. Server is unchanged."
```

#### Task B.8: live smoke

Same as Option A's Task A.7 — start dev, walk onboarding +
check-in, watch for non-empty SSE frames.

### If Option B fails on the wire

If Sarvam still emits zero transcripts after Option B's WAV header
lands, the bug is *not* the format — it's something else:

1. **API key invalid / quota exhausted** — re-check `SARVAM_API_KEY`
   in `.env.local` against Sarvam dashboard; the `/api/transcribe`
   route 503s on missing key but a *bad* key would surface as
   `voice.network` SDK errors which the route forwards as SSE
   `error` frames — none in the HAR, so the key is at minimum
   present and valid-shape.
2. **250 ms post-flush window too short** — bump to 1500 ms in
   `app/api/transcribe/route.ts:360-365` and re-smoke.
3. **WAV header math wrong** — double-check by saving the request
   body to `/tmp/test.wav` and `afplay /tmp/test.wav` (macOS) or
   open in Audacity. If the file plays back correctly, the header
   is fine.

---

## Contrast — A vs B at a glance

| Dimension | Option A (server says pcm) | Option B (client wraps WAV) |
|---|---|---|
| Files touched | 3 prod + 3 test | 2 prod + 2 test (+1 new) |
| New files | 0 | 2 (`wav-header.ts` + test) |
| Lines added (approx) | ~20 | ~120 |
| Streaming mode covered | Yes (same constants apply) | No — buffered only this cycle |
| Bytes per turn over the wire | unchanged | +44 bytes per turn (negligible) |
| Wire-format risk | Sarvam's per-chunk `encoding` value for `pcm_s16le` is *not* covered by the spike — fallback path documented in Task A's "If Option A fails" | Zero — WAV is what the spike actually proved against silent audio |
| Aligns with spike's stated decision | No (spike said "send as WAV") | Yes |
| Aligns with spike's *real* state | Yes (spike never proved real-speech transcription) | Yes |
| Cost-guard impact | None | None |
| Reversibility | Single-line revert per file | Single-line revert + delete one file |
| Time to first green smoke | Faster (no header math) | Slower (more code, tests, edge cases) |

## Decision criteria

Choose **Option A** if:
- You want the smallest possible diff for an unblock fix.
- You're willing to fall back to Option B if Sarvam rejects
  `pcm_s16le` on the per-chunk `encoding` field (the part the spike
  didn't verify).
- You want streaming mode (Vercel) covered in the same patch.

Choose **Option B** if:
- You want the *most conservative* protocol change — WAV is what
  the SDK type system advertises and what the silent-audio spike
  succeeded against.
- You're OK landing the streaming-mode fix in a separate cycle.
- You're willing to write 44 bytes of header math and a new
  module-level test file.

## Open questions for the next chat

1. Does Sarvam accept `encoding: 'audio/pcm_s16le'` or does it want
   one of `audio/pcm`, `audio/L16; rate=16000`, or `undefined`?
   (Resolved by Task A.7 smoke; documented in
   "If Option A fails on the wire".)
2. Is the 250 ms post-flush window in `app/api/transcribe/route.ts:360-365`
   long enough once Sarvam *does* start emitting transcripts? On
   23-second clips the route gives Sarvam ~250 ms to flush — Sarvam
   may need longer. Watch the smoke; if `final` arrives before all
   `partial`s land, bump the window.
3. After Bug 1 lands, should Bug 2 (greeting doesn't say "Harish")
   and Bug 3 ("Switch to taps" not visible) ship in the same fix
   pass or one commit each? Default: one commit each (matches the
   F.1 / F.2 cadence and the user's "verify before fixing" rule).
