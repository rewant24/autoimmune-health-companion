# Hot-fix: Voice C1 prod Sarvam rejection — streaming branch ships raw PCM

**Date:** 2026-04-29
**Severity:** prod-broken (every voice check-in failed on Vercel prod)
**Cycle:** Voice C1 (PR #12, squash `1a63036`)
**Fix commit:** `5c66f1a`
**File touched:** `lib/voice/sarvam-adapter.ts` (one return value flipped in `resolveMode()`)

## Symptom

Right after the Voice C1 prod ship, every `/api/transcribe` call on
`https://saha-health-companion.vercel.app` returned 200 with an SSE error
body:

```
data: {"type":"error","kind":"voice.unprocessable",
       "message":"Sarvam rejected the request — Failed to read the file,
                  please check the audio format."}
```

Local `next dev` (HTTP/1.1) was fully green through manual smoke; the bug
only manifested on the Vercel deployment.

## Root cause

`SarvamAdapter.resolveMode()` had an `'auto'` resolver that picked
`'streaming'` whenever `window.location.protocol === 'https:'`. On Vercel
prod (HTTP/2 + HTTPS) it chose streaming; on `next dev` (HTTP/1.1) it
fell back to buffered.

The two branches are not equivalent on the wire:

| Mode      | What gets sent                                       |
|-----------|------------------------------------------------------|
| buffered  | 44-byte RIFF/WAVE header **+** PCM s16le payload     |
| streaming | raw PCM s16le chunks, no header, with `Content-Type: audio/wav` header |

Sarvam STT REST batch decodes the body as WAV, finds no RIFF marker, and
rejects with `Failed to read the file`. The streaming branch was a known
deferred TODO (see comment at the top of the streaming branch in
`sarvam-adapter.ts`) — exercised only by HTTP/2-capable hosts, so dev
never hit it. Prod did.

### Diagnostic evidence (HAR)

User-supplied HAR: `/Users/rewantprakash_1/Downloads/sahaPROD.har`

- `POST /api/transcribe?lang=en-IN` → 200, `content-type: text/event-stream`
- Server-side response headers: `x-voice-bytes: 584000`,
  `x-voice-duration-ms: 2108` (proves the bytes did arrive — Chrome's
  HAR `bodySize: 0` was misleading because the request body is a stream).
- Send timing: `18617 ms` for ~570 KB ≈ **30 KB/s**, which is exactly the
  16 kHz × 2 bytes ≈ 32 KB/s rate of mono 16-bit PCM. Streaming-mode
  fingerprint.
- SSE error body confirms Sarvam-side rejection.

## Fix applied

`lib/voice/sarvam-adapter.ts` — `resolveMode()` `'auto'` arm now always
returns `'buffered'`. Explicit overrides (`streamingMode: 'streaming'`)
still pick streaming, so the test surface that exercises the streaming
branch behaviour is untouched.

```diff
   if (this.streamingModeOpt === 'streaming') return 'streaming'
   if (this.streamingModeOpt === 'buffered') return 'buffered'
   // 'auto'
-  if (
-    typeof window !== 'undefined' &&
-    typeof window.location !== 'undefined' &&
-    window.location.protocol === 'https:'
-  ) {
-    return 'streaming'
-  }
   return 'buffered'
```

A multi-line comment above the return points at this doc and at the
post-MVP backlog item for the proper streaming-branch fix.

## Why a hot-fix instead of a proper fix

Proper fix is to make the streaming branch wrap PCM in a streaming WAV
header (a 44-byte preamble chunk before the first PCM chunk, with the
`data` chunk size left as a sentinel — Sarvam REST batch ingests the
whole upload before decode, so the size sentinel is fine). That's a
~50-line change with new tests for the header builder, the
two-chunk-write ordering, and the abort path that fires before the first
PCM chunk lands. Not a ship-day change with prod broken.

Buffered mode collects PCM into `pcmChunks` and ships one upload at
`stop()` — slightly higher latency and memory pressure (one full turn of
PCM held in memory), but Sarvam's REST batch endpoint is one-shot
anyway, so the user-visible cost is negligible for sub-30s turns. Local
smoke has always run on this path.

## Verification

- `npx tsc --noEmit` — clean
- `npx vitest run` — 800/800 pass (no test changes; the existing suite
  stresses both branches via `streamingMode` overrides)
- Prod manual smoke: pending after deploy

## Follow-ups

1. **Post-MVP backlog item:** "Wrap PCM in streaming WAV header so
   `streamingMode: 'streaming'` works on Vercel prod" — added to
   `docs/post-mvp-backlog.md` §22.5.
2. **Re-smoke prod voice flow** on `https://saha-health-companion.vercel.app`
   after the auto-promote lands (≈2 min after main push).
3. **Tag** `voice-c1/shipped` once prod smoke is green.

## Lessons

- HTTP/1.1 (local Next.js dev) and HTTP/2 (Vercel prod) take different
  branches in any code that probes `protocol`/`scheme` to gate streaming
  uploads. Adapters that have a streaming/buffered split MUST be
  end-to-end smoked on the prod transport before claiming green.
- HAR `bodySize: 0` is not "no body sent" — Chrome can't measure
  streaming request bodies. Trust server-side instrumentation
  (`x-voice-bytes`, `x-voice-duration-ms`) over Chrome's HAR for stream
  uploads.
- A `TODO` comment that names the exact failure mode ("streaming branch
  still posts raw PCM chunks labelled audio/wav") is doing its job —
  this took minutes to find from the comment text once the symptom
  pointed at Sarvam. Worth keeping that discipline on every deferred
  branch.
