# Sarvam audio format spikes — STT + TTS

> Companion to `docs/features/voice-cycle-1-plan.md` step 0.10. Two
> 10-minute POCs that drive implementation choices for V.B (STT
> adapter) and V.C (TTS adapter). Both V.B and V.C read this file at
> dispatch time.

**Status:** **PENDING** — needs `SARVAM_API_KEY` in local env. Spikes
cannot run against mocks; the whole point is to discover the real wire
behaviour. Run on `feat/voice-sarvam` before tagging
`voice-c1/pre-flight-done`.

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

**Outcome (fill in after run).**
- Encoding accepted: `<webm | wav | pcm>`
- Latency to first partial: `<N ms>`
- Sample backend response shape (paste one partial JSON):
  ```json
  <paste here>
  ```

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

**Outcome (fill in after run).**
- Endpoint used: `<convert (REST) | textToSpeechStreaming>`
- Audio format returned: `<mp3 | wav | pcm | base64-mp3 | …>`
- First-byte latency: `<N ms>`
- Voice selected: `<name>` (rationale: `<one line>`)
- Notes: `<anything surprising>`

---

## Hand-off to V.B and V.C

Both subagent prompts in `docs/features/voice-cycle-1-plan.md` reference
this file. Their decision branches land in their respective adapters:

- **V.B** picks resampler vs raw-WebM in `lib/voice/sarvam-recorder.ts`.
- **V.C** picks blob vs `MediaSource` vs WebAudio decode in
  `lib/voice/sarvam-tts-adapter.ts`.

The `app/api/transcribe/route.ts` and `app/api/speak/route.ts` server
routes pass `Content-Type` and the audio bytes through Sarvam SDK calls;
they don't need to know the format at the route layer beyond reading
`Content-Type` for the validation guard.
