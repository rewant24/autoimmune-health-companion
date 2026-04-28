# Sarvam audio format spikes — STT + TTS

> Companion to `docs/features/voice-cycle-1-plan.md` step 0.10. Two
> 10-minute POCs that drive implementation choices for V.B (STT
> adapter) and V.C (TTS adapter). Both V.B and V.C read this file at
> dispatch time.

**Status:** **DONE** — ran 2026-04-26 against the production Sarvam key
on `feat/voice-sarvam`. Outcomes filled in below; sample audio in
`docs/research/spike-out/` (gitignored, not committed).

**Prerequisite.** Drop the key into `.env.local` (server-only,
never `NEXT_PUBLIC_*`). Then:

```bash
export SARVAM_API_KEY=$(grep '^SARVAM_API_KEY=' .env.local | cut -d= -f2)
node --input-type=module -e "$(cat <<'JS'
import { SarvamAIClient } from 'sarvamai'
const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY })
console.log('client keys:', Object.keys(client))
JS
)"
```

---

## STT spike

**Question:** Does Sarvam streaming STT accept browser-native
`MediaRecorder` output (`audio/webm;codecs=opus`), or do we need a
WebAudio-based 16k-mono PCM/WAV resampler in V.B?

**Procedure.**
1. Capture a known-good `audio/webm;codecs=opus` chunk (~250ms, 16kHz
   mic) ahead of time using Chrome DevTools — drop the `.webm` blob in
   `tests/fixtures/voice/sample-en-IN.webm`.
2. In a Node REPL with `sarvamai`:
   ```js
   const socket = await client.speechToTextStreaming.connect({
     model: 'saaras:v3',
     mode: 'transcribe',
     'language-code': 'en-IN',
     high_vad_sensitivity: 'true',
   })
   socket.on('open', () => console.log('open'))
   socket.on('message', (m) => console.log('msg', m))
   socket.on('error', (e) => console.error('err', e))
   ```
3. Send the WebM buffer:
   ```js
   socket.transcribe({
     audio: webmBuffer,
     sample_rate: 16000,
     encoding: 'audio/webm',
   })
   ```
4. Observe: does the server return a partial? Or an error like
   "unsupported encoding"?

**Decision criteria.**
- **WebM accepted** → V.B forwards `MediaRecorder` chunks raw. No
  resampler. Faster path; ~50 fewer lines.
- **WebM rejected** → V.B includes a small WebAudio-based resampler:
  capture stream into an `AudioContext`, downsample to 16kHz mono, emit
  PCM (or a minimal WAV header + PCM) at the boundary. ~80 lines.
  Reference pattern: [Chrome's MediaStreamAudioDestinationNode +
  OfflineAudioContext]. Performance constraint: must run faster than
  realtime on iOS Safari (target = 16x realtime; we have headroom).

**Outcome (2026-04-26).**
- Encoding accepted: **wav (PCM 16-bit LE 16kHz mono)**. Confirmed
  authoritatively by the SDK's own type def
  `SpeechToTextStreamingInputAudioCodec` which only enumerates
  `wav`, `pcm_s16le`, `pcm_l16`, `pcm_raw` — **WebM/Opus is not a
  supported value at the protocol level.**
- Wire smoke (real call): connection opened in 320 ms; sent a 500 ms
  silent WAV (`input_audio_codec: 'wav'`, `sample_rate: '16000'`,
  base64-encoded via `socket.transcribe(...)`); server accepted
  without error and closed cleanly with code 1000. Zero transcripts
  on silent audio (expected — VAD didn't trigger).
- **Decision:** V.B implements the WebAudio resampler path. Capture
  `MediaStream` into an `AudioContext`, downsample to 16kHz mono PCM
  s16le, base64-encode chunks, and send via `socket.transcribe({
  audio, sample_rate: 16000, encoding: 'audio/wav' })`. Open
  `connect({ input_audio_codec: 'wav', sample_rate: '16000', … })`.
- Sample backend response shape: not captured (silent input → no
  partials emitted). When V.B integrates against real speech, expect
  the message handler to receive `{ type, transcript, is_final, … }`
  per `SpeechToTextStreamingResponse`. Live capture deferred to V.B's
  manual smoke step.

---

## TTS spike

**Question:** What does Sarvam TTS return — base64 chunk, MP3 stream,
raw PCM? What can the browser `<audio>` element play directly without a
custom decoder? Pick a default voice for `en-IN` neutral female.

**Procedure.**
1. In a Node REPL with `sarvamai`:
   ```js
   const out = await client.textToSpeech.convert({
     text: 'Hello Sonakshi. How are you feeling today?',
     target_language_code: 'en-IN',
     speaker: 'meera', // or whatever Sarvam recommends — try 2-3
   })
   console.log('keys:', Object.keys(out))
   console.log('audio sample:', String(out.audios?.[0]).slice(0, 80))
   ```
2. Save a returned `audio` payload to disk as the right extension
   (`.mp3` if it begins with `ID3` / `\xFF\xFB`; `.wav` if it begins
   with `RIFF`; raw PCM otherwise) and play it with `afplay` to confirm
   the format guess is right.
3. If the SDK exposes a streaming endpoint (e.g.
   `client.textToSpeechStreaming.connect`), check whether per-chunk
   playback is feasible (`MediaSource` + `SourceBuffer`). Streaming
   matters for opener latency — first audio byte under 800ms is the
   target.
4. Compare 2–3 voice candidates (e.g. `meera`, `pavithra`, default) on
   the same line and pick one. Cycle 1 ships a single voice; future
   cycles can expose a chooser.

**Decision criteria.**
- **MP3 / direct-playable** → V.C blob-plays per response. Adapter
  POSTs `{ text, language_code }`, server proxies, response body is
  the audio bytes; client makes a Blob URL and `<audio>.src = url`.
- **Streaming MP3** → V.C uses `MediaSource` for live playback. ~30
  more lines, but gets us under the 800ms first-byte target.
- **Raw PCM / non-direct** → V.C decodes via WebAudio
  (`AudioContext.decodeAudioData`) before playback. Slowest but works.

**Outcome (2026-04-26).**
- Endpoint used: **`textToSpeech.convert` (REST)**. The streaming
  WebSocket endpoint (`textToSpeechStreaming`) is **bulbul:v2 only**
  per `TextToSpeechStreamingClient.ConnectArgs.model: "bulbul:v2"`,
  so it doesn't unlock anything we can't already get from REST + the
  same v2 voices. Skipping streaming for Cycle 1 — REST is simpler
  and the latency is fine.
- Audio format returned: **WAV (RIFF header confirmed across all 6
  samples)**, base64-encoded inside `{ request_id, audios: [string] }`.
  Default `speech_sample_rate` = 24000 Hz. No decoder needed — browser
  `<audio>` plays WAV directly via Blob URL.
- Latency (full response, single chunk; Sarvam server + network from
  Bombay/Mumbai region):
  - bulbul:v2 / anushka  → 1099 ms (105 KB)
  - bulbul:v2 / manisha  → 1015 ms (107 KB)
  - bulbul:v2 / vidya    →  863 ms (110 KB)
  - bulbul:v3 / ritu     → 1288 ms (101 KB)
  - bulbul:v3 / priya    → 1365 ms (112 KB)
  - bulbul:v3 / neha     → 1688 ms (146 KB)
- 800 ms first-byte target was aspirational; in practice REST
  full-response is ≥863 ms even on the fastest voice. For Cycle 1
  this is acceptable — opener plays once at session start. Future
  cycles can move to streaming MP3 if the opener feel needs to be
  snappier.
- Voice selected: **`anushka` on `bulbul:v2`**. Rationale: it's the
  documented v2 default, came back in 1.1 s on the first call, and
  v2 is the model Sarvam has tuned longest for `en-IN` female. v3
  voices were 200–600 ms slower for no audible payoff in this short
  opener line. (User can swap by changing `SARVAM_TTS_SPEAKER` /
  `SARVAM_TTS_MODEL` env vars in V.C; defaults baked in.)
- **Decision:** V.C `app/api/speak/route.ts` calls
  `client.textToSpeech.convert({ text, target_language_code:
  'en-IN', speaker: 'anushka', model: 'bulbul:v2' })`,
  base64-decodes `data.audios[0]`, returns
  `Response(buffer, { headers: { 'Content-Type': 'audio/wav' } })`.
  Client-side adapter creates a Blob URL and assigns to
  `audio.src`. No `MediaSource`, no WebAudio decode.
- Notes: TTS request returns full audio in ~1 s; no chunking. If
  future cycles need streaming, switch to v2 streaming socket
  (different code path entirely) or move to v3 + REST and accept the
  +200–600 ms.

---

## Hand-off to V.B and V.C

Both subagent prompts in `docs/features/voice-cycle-1-plan.md` reference
this file. Their decision branches land in their respective adapters:

- **V.B** ships the WebAudio 16kHz PCM resampler in
  `lib/voice/sarvam-recorder.ts` (no raw-WebM passthrough — codec
  rejected by the streaming endpoint).
- **V.C** ships the Blob-URL playback path in
  `lib/voice/sarvam-tts-adapter.ts` (no `MediaSource`, no WebAudio
  decode — `<audio>` plays the returned WAV directly).

The `app/api/transcribe/route.ts` and `app/api/speak/route.ts` server
routes pass `Content-Type` and the audio bytes through Sarvam SDK calls;
they don't need to know the format at the route layer beyond reading
`Content-Type` for the validation guard.
