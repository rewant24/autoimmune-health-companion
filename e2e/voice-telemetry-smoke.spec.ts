/**
 * A2 voice-telemetry e2e harness (A2.2–A2.4 + the roadmap 429 scenario).
 *
 * Exercises the FULL voice check-in loop in a real browser — the ~8
 * interdependent effects in `app/check-in/page.tsx` that own arming, TTS
 * playback, and dispatch (where PR #21 died with zero live-path
 * coverage) — and asserts the three PostHog voice events arrive on the
 * wire with their expected props:
 *
 *   voice_start_called  — `SarvamAdapter.start()` (lib/voice/sarvam-adapter.ts)
 *   voice_stop_called   — `SarvamAdapter.stop()`
 *   voice_rearm_fired   — listening-answer re-arm (lib/checkin/state-machine.ts)
 *
 * Everything external is stubbed at the Playwright network layer — NO
 * live Sarvam, NO live LLM, NO real PostHog ingestion:
 *   - getUserMedia: init-script fake returning a synthetic silent
 *     MediaStream (see `installFakeMicrophone` — the Chromium
 *     fake-device launch flags proved platform-flaky). The real
 *     AudioContext/AudioWorklet recorder runs against the fake stream.
 *   - /api/transcribe: fulfilled with the route's real SSE `final` frame
 *     shape, scripted transcript per turn.
 *   - /api/speak: fulfilled with a real tiny silent WAV so the
 *     HTMLAudioElement pipeline plays it for real and `onended` fires
 *     deterministically (~50 ms).
 *   - /api/check-in/extract: scripted `{ metrics }` bodies, or a 429
 *     `extract.rate_limited` with Retry-After (PR #36 shape).
 *   - /api/check-in/extract-event + extract-medication: empty results.
 *   - PostHog ingest host: every request intercepted; capture POSTs are
 *     decoded (gzip / base64 / plain JSON) into an in-test sink.
 *
 * Autoplay policy: the project launches with
 * `--autoplay-policy=user-gesture-required`, so the cold-mount greeting
 * TTS is deterministically blocked (GREETING_FAILED → idle-ready) and the
 * spec enters the loop with an orb tap — AFTER the PostHog sink is
 * installed, so `voice_start_called` #1 is never lost to the init race.
 * The tap grants sticky user activation, so every later TTS turn plays.
 *
 * A2.6 (live manual smoke on meetsaha.com) is deliberately NOT here —
 * this harness is local-only by design.
 */

import { randomUUID } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { test, expect, type Page } from '@playwright/test'

const PROFILE_KEY = 'saha.profile.v1'
const TEST_USER_KEY = 'saha.testUser.v1'

/** Freeform utterance — extract stub answers pain/mood/adherence/energy. */
const FREEFORM_TRANSCRIPT =
  'Slept alright. Pain is about a four, mood is okay, I took my meds and energy is a six.'

/** Follow-up answer for the one missing metric (flare). */
const FLARE_ANSWER_TRANSCRIPT = 'No flare today.'

/** Voice loops drive real (stubbed-latency) TTS + STT turns — allow slack. */
const TEST_TIMEOUT_MS = 180_000

// ---------------------------------------------------------------------------
// Stub payload builders
// ---------------------------------------------------------------------------

/**
 * Minimal valid 16 kHz mono s16le WAV (~50 ms of silence). Served from the
 * /api/speak stub so `SarvamTtsAdapter`'s blob → <audio> → onended pipeline
 * completes for real, quickly, on every TTS turn.
 */
function buildTinyWav(): Buffer {
  const sampleRate = 16_000
  const samples = 800 // 50 ms
  const dataBytes = samples * 2
  const buf = Buffer.alloc(44 + dataBytes) // PCM data stays zeroed = silence
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataBytes, 40)
  return buf
}

/** Full-shape route body (`{ metrics }`) with the given values captured. */
function extractBody(
  metrics: Partial<Record<string, unknown>>,
): string {
  return JSON.stringify({
    metrics: {
      pain: null,
      mood: null,
      adherenceTaken: null,
      flare: null,
      energy: null,
      ...metrics,
    },
  })
}

type ExtractStep =
  | { kind: 'metrics'; metrics: Partial<Record<string, unknown>> }
  | { kind: 'rate-limited' }

// ---------------------------------------------------------------------------
// PostHog capture interception (A2.3)
// ---------------------------------------------------------------------------

interface CapturedEvent {
  event: string
  properties: Record<string, unknown>
}

/**
 * Decode a posthog-js capture POST body into its event objects. Handles
 * the three wire shapes the SDK uses: gzip-js compressed JSON, form
 * `data=<base64>` fallback, and plain JSON (single object or array).
 */
function decodePosthogPayload(buf: Buffer | null): CapturedEvent[] {
  if (buf === null || buf.length === 0) return []
  let text: string
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    text = gunzipSync(buf).toString('utf8')
  } else {
    text = buf.toString('utf8')
    if (text.startsWith('data=')) {
      const encoded = text.slice('data='.length).split('&')[0] ?? ''
      text = Buffer.from(decodeURIComponent(encoded), 'base64').toString(
        'utf8',
      )
    }
  }
  const parsed: unknown = JSON.parse(text)
  const raw = Array.isArray(parsed) ? parsed : [parsed]
  const events: CapturedEvent[] = []
  for (const item of raw) {
    if (
      item !== null &&
      typeof item === 'object' &&
      typeof (item as { event?: unknown }).event === 'string'
    ) {
      const ev = item as { event: string; properties?: unknown }
      events.push({
        event: ev.event,
        properties:
          ev.properties !== null && typeof ev.properties === 'object'
            ? (ev.properties as Record<string, unknown>)
            : {},
      })
    }
  }
  return events
}

/**
 * Intercept EVERY request to the PostHog ingest host. Capture POSTs are
 * decoded into `sink`; everything else (decide/flags/config) gets an
 * empty 200 so the SDK initializes without touching the real service.
 */
async function installPosthogIntercept(
  page: Page,
  sink: CapturedEvent[],
): Promise<void> {
  await page.route(/^https:\/\/[^/]*posthog\.com\/.*/, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const isCapture =
      request.method() === 'POST' &&
      /^\/(e|batch|capture|i\/v0\/e)(\/|$)/.test(path)
    if (isCapture) {
      try {
        sink.push(...decodePosthogPayload(request.postDataBuffer()))
      } catch {
        // Malformed/unexpected encoding — don't fail the app's request;
        // the count assertions below will surface the gap.
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"status":1}',
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    })
  })
}

function eventsNamed(sink: CapturedEvent[], name: string): CapturedEvent[] {
  return sink.filter((e) => e.event === name)
}

/** posthog-js batches captures — poll until at least `count` arrived. */
async function waitForEventCount(
  sink: CapturedEvent[],
  name: string,
  count: number,
): Promise<void> {
  await expect
    .poll(() => eventsNamed(sink, name).length, {
      timeout: 30_000,
      message: `waiting for ${count}x ${name} on the PostHog wire`,
    })
    .toBeGreaterThanOrEqual(count)
}

// ---------------------------------------------------------------------------
// Voice API stubs (A2.2)
// ---------------------------------------------------------------------------

/**
 * Stub the four server routes the voice loop touches. `transcripts` and
 * `extractPlan` are consumed one entry per call (last entry repeats if a
 * scenario somehow issues extra calls — deterministic, never hangs).
 */
async function installVoiceStubs(
  page: Page,
  args: { transcripts: string[]; extractPlan: ExtractStep[] },
): Promise<void> {
  const wav = buildTinyWav()

  await page.route('**/api/speak', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: wav,
    })
  })

  let transcribeCalls = 0
  await page.route('**/api/transcribe*', async (route) => {
    const i = Math.min(transcribeCalls, args.transcripts.length - 1)
    transcribeCalls += 1
    const text = args.transcripts[i] ?? ''
    // Real route shape: one SSE `final` frame (see app/api/transcribe).
    const frame = `data: ${JSON.stringify({
      type: 'final',
      text,
      durationMs: 5,
      bytes: 0,
    })}\n\n`
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
      body: frame,
    })
  })

  let extractCalls = 0
  await page.route('**/api/check-in/extract', async (route) => {
    const i = Math.min(extractCalls, args.extractPlan.length - 1)
    extractCalls += 1
    const step = args.extractPlan[i] ?? { kind: 'metrics', metrics: {} }
    if (step.kind === 'rate-limited') {
      // PR #36 shape: dedicated `extract.rate_limited` code, Retry-After
      // honored end-to-end.
      await route.fulfill({
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
        },
        body: JSON.stringify({
          error: {
            code: 'extract.rate_limited',
            message: 'The extraction model is rate limiting requests.',
            retryAfterSeconds: 30,
          },
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: extractBody(step.metrics),
    })
  })

  // Opportunistic extractors fired on `confirming` — return empty results
  // so no live LLM call ever leaves the browser.
  await page.route('**/api/check-in/extract-event', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ visits: [], bloodWork: [] }),
    })
  })
  await page.route('**/api/check-in/extract-medication', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        simpleAdherence: null,
        skippedMedications: [],
        dosageChanges: [],
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// Loop drivers
// ---------------------------------------------------------------------------

/**
 * Replace `navigator.mediaDevices.getUserMedia` with a synthetic silent
 * MediaStream (AudioContext → MediaStreamDestination with a zero
 * constant source). The Chromium fake-device launch flags proved
 * unreliable: on macOS the runner-launched browser kept using the REAL
 * microphone, and on the ubuntu CI runner getUserMedia rejected
 * NotFoundError (no device at all). An init-script fake is deterministic
 * on every platform, keeps real audio out of the tests, and the real
 * AudioContext/AudioWorklet recorder consumes the stream unchanged.
 *
 * Silence is a feature: it stays below the recorder's speech-RMS
 * threshold so the silence VAD never fires and the manual orb tap is
 * the single deterministic end-of-turn path.
 */
async function installFakeMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fakeGetUserMedia = async (): Promise<MediaStream> => {
      const ctx = new AudioContext()
      const destination = ctx.createMediaStreamDestination()
      const source = ctx.createConstantSource()
      source.offset.value = 0 // pure silence
      source.connect(destination)
      source.start()
      // Post-gesture (the orb tap) this resolves; if not, the track
      // still exists and the recorder simply sees no samples.
      void ctx.resume().catch(() => undefined)
      return destination.stream
    }
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = fakeGetUserMedia
    } else {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: fakeGetUserMedia },
        configurable: true,
      })
    }
  })
}

/**
 * posthog-js drops EVERY capture when `isLikelyBot()` is true, and that
 * check returns true whenever `navigator.webdriver` is set — which
 * Playwright always sets. Mask it (plus userAgentData brands, which
 * carry "HeadlessChrome") so captures actually reach the wire. Verified
 * against posthog-js 1.376.0: `capture()` early-returns via
 * `_is_bot()` → `isLikelyBot` → `!!navigator.webdriver`.
 */
async function maskAutomationSignals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const proto = Object.getPrototypeOf(navigator) as object
    Object.defineProperty(proto, 'webdriver', {
      get: () => undefined,
      configurable: true,
    })
    Object.defineProperty(proto, 'userAgentData', {
      get: () => undefined,
      configurable: true,
    })
  })
}

/** Seed the qa user + onboarded profile (same convention as f04/f05 specs). */
async function seedTestUser(page: Page, userId: string): Promise<void> {
  await page.addInitScript(
    ({ uid, profileKey, userKey }) => {
      const now = Date.now()
      window.localStorage.setItem(userKey, uid)
      window.localStorage.setItem(
        profileKey,
        JSON.stringify({
          v: 2,
          name: 'QA',
          dobMonth: null,
          dobYear: null,
          email: 'qa@example.com',
          condition: 'rheumatoid-arthritis',
          conditionOther: null,
          onboarded: true,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      )
    },
    { uid: userId, profileKey: PROFILE_KEY, userKey: TEST_USER_KEY },
  )
}

/**
 * Enter the freeform listening turn. Waits for the PostHog SDK to finish
 * initializing FIRST (window.posthog is stashed in the `loaded` callback,
 * after identify + sink install) so the first `voice_start_called` cannot
 * race the sink swap. Then taps the orb — the autoplay-blocked greeting
 * leaves the machine in idle/idle-ready where a tap starts the loop; if
 * the greeting somehow auto-played and the loop already advanced, the
 * stop button is simply awaited.
 */
async function enterListening(page: Page): Promise<void> {
  await page.waitForFunction(() => 'posthog' in window, undefined, {
    timeout: 30_000,
  })
  const stop = page.getByTestId('stop-button')
  if (!(await stop.isVisible())) {
    await page
      .getByRole('button', { name: 'Start daily check-in' })
      .click({ timeout: 15_000 })
      .catch(() => undefined)
  }
  await stop.waitFor({ state: 'visible', timeout: 30_000 })
}

/**
 * Finish the current listening turn: give the recorder a moment to arm +
 * emit chunks, then tap the ORB (aria-label "Stop check-in") — a second
 * orb tap has the same TAP_ORB → provider.stop() intent as the
 * "Tap when done" button.
 *
 * Why the orb and not `stop-button`: in `listening-answer` the
 * SwitchToTapsButton overlay and the StopButton are BOTH
 * `fixed inset-x-0 [bottom:calc(5rem+env(safe-area-inset-bottom))] z-50`,
 * so "Switch to taps" fully covers "Tap when done" and intercepts its
 * pointer events (real product finding, documented in the A2 PR — not
 * fixed here). The silence VAD may also beat the tap — the catch
 * tolerates that race; either path drives `SarvamAdapter.stop()`.
 */
async function completeListeningTurn(page: Page): Promise<void> {
  const stop = page.getByTestId('stop-button')
  await stop.waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  await page
    .getByRole('button', { name: 'Stop check-in' })
    .click({ timeout: 3_000 })
    .catch(() => undefined)
  await stop.waitFor({ state: 'hidden', timeout: 30_000 })
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

test.describe('voice telemetry harness', () => {
  test('happy loop emits start/stop/rearm with stitched distinct_id across two iterations', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const testUserId = `qa_e2e_${randomUUID()}`
    const sink: CapturedEvent[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[browser:${msg.type()}] ${msg.text()}`)
      }
    })
    page.on('pageerror', (err) => {
      console.log(`[browser:pageerror] ${err.message}`)
    })

    await installFakeMicrophone(page)
    await maskAutomationSignals(page)
    await seedTestUser(page, testUserId)
    await installPosthogIntercept(page, sink)
    await installVoiceStubs(page, {
      // Two identical iterations (routes persist across the reload).
      transcripts: [
        FREEFORM_TRANSCRIPT,
        FLARE_ANSWER_TRANSCRIPT,
        FREEFORM_TRANSCRIPT,
        FLARE_ANSWER_TRANSCRIPT,
      ],
      extractPlan: [
        // Freeform captures 4/5 → flare is the one follow-up (rearm turn).
        {
          kind: 'metrics',
          metrics: { pain: 4, mood: 'okay', adherenceTaken: true, energy: 6 },
        },
        { kind: 'metrics', metrics: { flare: 'no' } },
        {
          kind: 'metrics',
          metrics: { pain: 4, mood: 'okay', adherenceTaken: true, energy: 6 },
        },
        { kind: 'metrics', metrics: { flare: 'no' } },
      ],
    })

    await page.goto('/check-in')

    // ---- Iteration 1: freeform turn + one follow-up (flare) -------------
    await enterListening(page)
    await completeListeningTurn(page) // freeform → extract → ask flare
    await completeListeningTurn(page) // flare answer → loop complete
    await expect(page.getByTestId('confirm-summary')).toBeVisible({
      timeout: 30_000,
    })

    // A2.3 — the three events arrive on the PostHog wire with their props.
    await waitForEventCount(sink, 'voice_start_called', 2) // freeform + rearm turns
    await waitForEventCount(sink, 'voice_stop_called', 2)
    await waitForEventCount(sink, 'voice_rearm_fired', 1)

    const start = eventsNamed(sink, 'voice_start_called')[0]
    expect(start?.properties.category).toBe('lifecycle')
    expect(start?.properties.source).toBe('SarvamAdapter')
    expect(start?.properties.mode).toBe('buffered')
    expect(start?.properties.language_code).toBe('en-IN')

    const stopEv = eventsNamed(sink, 'voice_stop_called')[0]
    expect(stopEv?.properties.category).toBe('lifecycle')
    expect(stopEv?.properties.source).toBe('SarvamAdapter')
    expect(typeof stopEv?.properties.durationMs).toBe('number')
    expect(stopEv?.properties.mode).toBe('buffered')

    const rearm = eventsNamed(sink, 'voice_rearm_fired')[0]
    expect(rearm?.properties.category).toBe('lifecycle')
    expect(rearm?.properties.source).toBe('useCheckinMachine')
    expect(rearm?.properties.metric).toBe('flare')

    // ---- Iteration 2 (A2.4): same context, second loop -------------------
    // Iteration-1 events are all confirmed flushed above, so the reload
    // can't drop anything from the SDK's batch queue.
    await page.reload()
    await enterListening(page)
    await completeListeningTurn(page)
    await completeListeningTurn(page)
    await expect(page.getByTestId('confirm-summary')).toBeVisible({
      timeout: 30_000,
    })

    await waitForEventCount(sink, 'voice_start_called', 4)
    await waitForEventCount(sink, 'voice_stop_called', 4)
    await waitForEventCount(sink, 'voice_rearm_fired', 2)

    // D4 identity stitch: every voice event across BOTH iterations carries
    // the seeded `saha.testUser.v1` id as its PostHog distinct_id.
    const voiceEvents = sink.filter((e) => e.event.startsWith('voice_'))
    expect(voiceEvents.length).toBeGreaterThanOrEqual(10)
    const distinctIds = new Set(
      voiceEvents.map((e) => e.properties.distinct_id),
    )
    expect([...distinctIds]).toEqual([testUserId])

    // Telemetry completion (2026-07-12): a session still on the confirm
    // screen has NO outcome yet — completed fires only on `saved` entry,
    // which this harness never reaches (saving would write dev Convex).
    expect(eventsNamed(sink, 'voice_session_outcome')).toHaveLength(0)
    // The only TTS failures on a healthy run are the autoplay-blocked
    // cold-mount greetings (0–2 on the wire depending on whether the
    // PostHog sink installed before the greeting effect fired — the
    // greeting races SDK init by design; user-path failures never do).
    for (const failure of eventsNamed(sink, 'voice_tts_speak_failed')) {
      expect(failure.properties.context).toBe('greeting')
      expect(failure.properties.kind).toBe('playback_failed')
    }
  })

  test('extract 429 (rate_limited) mid-loop bails to taps; rearm still fired', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const testUserId = `qa_e2e_${randomUUID()}`
    const sink: CapturedEvent[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[browser:${msg.type()}] ${msg.text()}`)
      }
    })
    page.on('pageerror', (err) => {
      console.log(`[browser:pageerror] ${err.message}`)
    })

    await installFakeMicrophone(page)
    await maskAutomationSignals(page)
    await seedTestUser(page, testUserId)
    await installPosthogIntercept(page, sink)
    await installVoiceStubs(page, {
      transcripts: [FREEFORM_TRANSCRIPT, 'It has been pretty quiet.'],
      extractPlan: [
        // Freeform succeeds with flare + energy missing → the loop arms a
        // follow-up turn (rearm fires) BEFORE the provider throttling hits.
        {
          kind: 'metrics',
          metrics: { pain: 4, mood: 'okay', adherenceTaken: true },
        },
        // The answer-turn extract gets the provider 429 → the answer-loop
        // policy bails to taps immediately (rate-limited is per-minute;
        // retrying seconds later just burns turns).
        { kind: 'rate-limited' },
      ],
    })

    await page.goto('/check-in')

    await enterListening(page)
    await completeListeningTurn(page) // freeform → ask flare
    await completeListeningTurn(page) // flare answer → extract 429 → bail

    // Graceful fallback: Stage 2 tap form with the honest rate-limited
    // notice (not the daily-cap copy, not the generic hiccup copy).
    await expect(page.getByTestId('stage-2')).toBeVisible({ timeout: 30_000 })
    const notice = page.getByTestId('stage-2-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('busy right now')
    await expect(notice).not.toContainText('limit')

    // Telemetry still landed: the loop armed the follow-up turn (rearm)
    // and both turns' lifecycle events made it to the wire.
    await waitForEventCount(sink, 'voice_rearm_fired', 1)
    await waitForEventCount(sink, 'voice_start_called', 2)
    await waitForEventCount(sink, 'voice_stop_called', 2)
    const rearm = eventsNamed(sink, 'voice_rearm_fired')[0]
    expect(rearm?.properties.metric).toBe('flare')
    expect(rearm?.properties.distinct_id).toBe(testUserId)

    // Telemetry completion (2026-07-12): the failure itself is now on
    // the wire — the client extract helper reports the provider 429
    // with its Retry-After...
    await waitForEventCount(sink, 'voice_extract_rate_limited', 1)
    const rateLimited = eventsNamed(sink, 'voice_extract_rate_limited')[0]
    expect(rateLimited?.properties.category).toBe('error')
    expect(rateLimited?.properties.source).toBe('extractMetrics')
    expect(rateLimited?.properties.retryAfterSeconds).toBe(30)

    // ...and the session records HOW it ended: bailed to taps because
    // of the rate limit, not by user choice.
    await waitForEventCount(sink, 'voice_session_outcome', 1)
    const outcome = eventsNamed(sink, 'voice_session_outcome')[0]
    expect(outcome?.properties.category).toBe('lifecycle')
    expect(outcome?.properties.outcome).toBe('bailed_to_taps')
    expect(outcome?.properties.reason).toBe('rate-limited')
    expect(outcome?.properties.conversational).toBe(true)
    expect(outcome?.properties.distinct_id).toBe(testUserId)
    expect(eventsNamed(sink, 'voice_session_outcome')).toHaveLength(1)
  })

  test('TTS failures land on the wire with context and never trap the loop', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const testUserId = `qa_e2e_${randomUUID()}`
    const sink: CapturedEvent[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[browser:${msg.type()}] ${msg.text()}`)
      }
    })
    page.on('pageerror', (err) => {
      console.log(`[browser:pageerror] ${err.message}`)
    })

    await installFakeMicrophone(page)
    await maskAutomationSignals(page)
    await seedTestUser(page, testUserId)
    await installPosthogIntercept(page, sink)
    await installVoiceStubs(page, {
      transcripts: [FREEFORM_TRANSCRIPT, FLARE_ANSWER_TRANSCRIPT],
      extractPlan: [
        {
          kind: 'metrics',
          metrics: { pain: 4, mood: 'okay', adherenceTaken: true, energy: 6 },
        },
        { kind: 'metrics', metrics: { flare: 'no' } },
      ],
    })
    // Override the harness /api/speak stub with a hard 500 — Playwright
    // matches routes in reverse registration order, so this wins without
    // touching the shared stub. Every TTS turn now fails server-side.
    await page.route('**/api/speak', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'speak.failed' } }),
      })
    })

    await page.goto('/check-in')

    // The loop must survive: question-TTS failures are treated as played
    // (the caption is on screen), so the flare follow-up still arms and
    // the check-in reaches the confirm screen.
    await enterListening(page)
    await completeListeningTurn(page) // freeform → ask flare (TTS 500)
    await completeListeningTurn(page) // flare answer → loop complete
    await expect(page.getByTestId('confirm-summary')).toBeVisible({
      timeout: 30_000,
    })

    // The failed question utterance is on the wire with its context.
    // (The failed greeting may or may not be captured — it races the
    // PostHog sink install — so only the post-gesture failure is
    // asserted deterministically.)
    await waitForEventCount(sink, 'voice_tts_speak_failed', 1)
    const questionFailure = eventsNamed(sink, 'voice_tts_speak_failed').find(
      (e) => e.properties.context === 'question',
    )
    expect(questionFailure).toBeDefined()
    expect(questionFailure?.properties.category).toBe('error')
    expect(questionFailure?.properties.source).toBe('CheckinPage')
    expect(questionFailure?.properties.kind).toBe('tts_failed')
    expect(questionFailure?.properties.status).toBe(500)
    expect(questionFailure?.properties.distinct_id).toBe(testUserId)

    // TTS failures alone must not end the session.
    expect(eventsNamed(sink, 'voice_session_outcome')).toHaveLength(0)
  })
})
