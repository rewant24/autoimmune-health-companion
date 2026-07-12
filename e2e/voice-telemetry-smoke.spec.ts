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
 * Shared stubs + loop drivers live in `e2e/voice-harness.ts` (extracted
 * when the Pattern B+D recovery spec landed, 2026-07-12) — see that file
 * for the full stubbing contract and the navigator.webdriver landmine.
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
import { test, expect } from '@playwright/test'
import {
  FREEFORM_TRANSCRIPT,
  FLARE_ANSWER_TRANSCRIPT,
  TEST_TIMEOUT_MS,
  type CapturedEvent,
  enterListening,
  completeListeningTurn,
  eventsNamed,
  installFakeMicrophone,
  installPosthogIntercept,
  installVoiceStubs,
  maskAutomationSignals,
  seedTestUser,
  waitForEventCount,
  wireConsoleLogging,
} from './voice-harness'

test.describe('voice telemetry harness', () => {
  test('happy loop emits start/stop/rearm with stitched distinct_id across two iterations', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const testUserId = `qa_e2e_${randomUUID()}`
    const sink: CapturedEvent[] = []

    wireConsoleLogging(page)

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
    const spoken: string[] = []

    wireConsoleLogging(page)

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
      speakSink: spoken,
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

    // Pattern B (2026-07-12): the bail is narrated OUT LOUD, not just
    // visually — the locked rate-limited line went through /api/speak.
    expect(spoken).toContain(
      "I'm having trouble keeping up right now — not you. Nothing you said is lost; let's finish with taps.",
    )

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
