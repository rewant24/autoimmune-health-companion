/**
 * Shared A2 voice-harness helpers (extracted verbatim from
 * `voice-telemetry-smoke.spec.ts` when the Pattern B+D recovery spec was
 * added, 2026-07-12 — one harness, N specs).
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
 *     deterministically (~50 ms). Optional `speakSink` records every
 *     spoken text so specs can assert the narration lines.
 *   - /api/check-in/extract: scripted `{ metrics }` bodies, a 429
 *     `extract.rate_limited` (PR #36 shape), a 429
 *     `extract.daily_cap_reached`, or a plain 500 (`failed`).
 *   - /api/check-in/extract-event + extract-medication: empty results.
 *   - PostHog ingest host: every request intercepted; capture POSTs are
 *     decoded (gzip / base64 / plain JSON) into an in-test sink.
 *
 * Landmine documented in the A2 PR (#40): posthog-js drops EVERY capture
 * under `navigator.webdriver` — `maskAutomationSignals` is mandatory
 * before `page.goto`.
 */

import { gunzipSync } from 'node:zlib'
import { expect, type Page } from '@playwright/test'

export const PROFILE_KEY = 'saha.profile.v1'
export const TEST_USER_KEY = 'saha.testUser.v1'

/** Freeform utterance — extract stub answers pain/mood/adherence/energy. */
export const FREEFORM_TRANSCRIPT =
  'Slept alright. Pain is about a four, mood is okay, I took my meds and energy is a six.'

/** Follow-up answer for the one missing metric (flare). */
export const FLARE_ANSWER_TRANSCRIPT = 'No flare today.'

/** Voice loops drive real (stubbed-latency) TTS + STT turns — allow slack. */
export const TEST_TIMEOUT_MS = 180_000

// ---------------------------------------------------------------------------
// Stub payload builders
// ---------------------------------------------------------------------------

/**
 * Minimal valid 16 kHz mono s16le WAV (~50 ms of silence). Served from the
 * /api/speak stub so `SarvamTtsAdapter`'s blob → <audio> → onended pipeline
 * completes for real, quickly, on every TTS turn.
 */
export function buildTinyWav(): Buffer {
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
export function extractBody(
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

export type ExtractStep =
  | { kind: 'metrics'; metrics: Partial<Record<string, unknown>> }
  | { kind: 'rate-limited' }
  | { kind: 'daily-cap' }
  /** Plain 500 — classified `transient` by `classifyExtractError`. */
  | { kind: 'failed' }

// ---------------------------------------------------------------------------
// PostHog capture interception (A2.3)
// ---------------------------------------------------------------------------

export interface CapturedEvent {
  event: string
  properties: Record<string, unknown>
}

/**
 * Decode a posthog-js capture POST body into its event objects. Handles
 * the three wire shapes the SDK uses: gzip-js compressed JSON, form
 * `data=<base64>` fallback, and plain JSON (single object or array).
 */
export function decodePosthogPayload(buf: Buffer | null): CapturedEvent[] {
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
export async function installPosthogIntercept(
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

export function eventsNamed(
  sink: CapturedEvent[],
  name: string,
): CapturedEvent[] {
  return sink.filter((e) => e.event === name)
}

/** posthog-js batches captures — poll until at least `count` arrived. */
export async function waitForEventCount(
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
 * When `speakSink` is provided, every /api/speak POST's `text` is
 * recorded so specs can assert exactly what Saha spoke (Pattern B
 * narration lines, redo acks).
 */
export async function installVoiceStubs(
  page: Page,
  args: {
    transcripts: string[]
    extractPlan: ExtractStep[]
    speakSink?: string[]
  },
): Promise<void> {
  const wav = buildTinyWav()

  await page.route('**/api/speak', async (route) => {
    if (args.speakSink) {
      try {
        const body = route.request().postDataJSON() as { text?: unknown }
        if (typeof body.text === 'string') args.speakSink.push(body.text)
      } catch {
        // Non-JSON body — record nothing; count assertions surface gaps.
      }
    }
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
    if (step.kind === 'daily-cap') {
      // ADR-020 daily-cap shape → `ExtractDailyCapError` client-side.
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'extract.daily_cap_reached',
            message: 'Daily extraction cap reached.',
          },
        }),
      })
      return
    }
    if (step.kind === 'failed') {
      // Plain 5xx — classified `transient` by classifyExtractError.
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'extract.failed', message: 'Upstream error.' },
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
export async function installFakeMicrophone(page: Page): Promise<void> {
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
export async function maskAutomationSignals(page: Page): Promise<void> {
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
export async function seedTestUser(page: Page, userId: string): Promise<void> {
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

/** Pipe browser console errors/warnings + pageerrors to the runner log. */
export function wireConsoleLogging(page: Page): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    console.log(`[browser:pageerror] ${err.message}`)
  })
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
export async function enterListening(page: Page): Promise<void> {
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
 * pointer events (real product finding, housekeeping #17 — positioning
 * fix owned by a parallel lane). The silence VAD may also beat the tap —
 * the catch tolerates that race; either path drives `SarvamAdapter.stop()`.
 */
export async function completeListeningTurn(page: Page): Promise<void> {
  const stop = page.getByTestId('stop-button')
  await stop.waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  await page
    .getByRole('button', { name: 'Stop check-in' })
    .click({ timeout: 3_000 })
    .catch(() => undefined)
  await stop.waitFor({ state: 'hidden', timeout: 30_000 })
}
