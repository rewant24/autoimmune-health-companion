/**
 * Voice Pattern B+D e2e scenarios (2026-07-12) — graceful-failure
 * narration, per-metric redo, and the mic-abort fix, all against the A2
 * harness (`e2e/voice-harness.ts`; everything stubbed — no live Sarvam /
 * LLM / PostHog).
 *
 * These are the gate the PR #21 postmortem demands: every new voice path
 * is walked LIVE in a real browser — mic arm, TTS playback, extract
 * failure, fallback narration, and (critically) the mic RE-ARM after
 * recovery, which vitest could never verify.
 *
 * Scenarios:
 *   1. transient answer-loop failure ×2 → `recovering` choice; continue
 *      → mic re-arms → loop completes (the exact path that killed PR #21)
 *   2. transient freeform-extract failure → `recovering`; switch to taps
 *      → Stage 2 with honest transient notice
 *   3. daily-cap 429 in the answer loop → SPOKEN bail narration + Stage 2
 *      cap notice, no false choice (retires the extract-429 P1 out loud)
 *   4. Pattern D redo during listening-answer → provider aborted, same
 *      metric re-asked with the redo ack, loop completes
 *   5. Switch-to-taps during a live listening-answer turn → provider
 *      aborted (voice_abort_called on the wire), no stop(), no dead end
 */

import { randomUUID } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import {
  FREEFORM_TRANSCRIPT,
  FLARE_ANSWER_TRANSCRIPT,
  TEST_TIMEOUT_MS,
  type CapturedEvent,
  type ExtractStep,
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

/** Locked Pattern B / D lines (mirrors `lib/saha/recovery-variants.ts`). */
const TRANSIENT_CHOICE_LINE =
  "I'm having trouble understanding right now — that's on my side, not you. Want me to ask one at a time, or switch to taps?"
const DAILY_CAP_BAIL_LINE =
  "I've hit today's limit for understanding answers — that's back tomorrow. Nothing you said is lost; let's finish with taps."
const REDO_ACK = 'Sure — one more time.'

/** Freeform extract result with only flare missing (one follow-up turn). */
const FOUR_OF_FIVE: ExtractStep = {
  kind: 'metrics',
  metrics: { pain: 4, mood: 'okay', adherenceTaken: true, energy: 6 },
}

interface Harness {
  sink: CapturedEvent[]
  spoken: string[]
}

async function setUp(
  page: Page,
  args: { transcripts: string[]; extractPlan: ExtractStep[] },
): Promise<Harness> {
  const sink: CapturedEvent[] = []
  const spoken: string[] = []
  wireConsoleLogging(page)
  await installFakeMicrophone(page)
  await maskAutomationSignals(page)
  await seedTestUser(page, `qa_e2e_${randomUUID()}`)
  await installPosthogIntercept(page, sink)
  await installVoiceStubs(page, { ...args, speakSink: spoken })
  await page.goto('/check-in')
  return { sink, spoken }
}

test.describe('voice Pattern B — graceful-failure narration', () => {
  test('transient answer-loop failure → recovering choice → continue re-arms the mic and completes the loop', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const { sink, spoken } = await setUp(page, {
      transcripts: [
        FREEFORM_TRANSCRIPT,
        FLARE_ANSWER_TRANSCRIPT,
        FLARE_ANSWER_TRANSCRIPT,
        FLARE_ANSWER_TRANSCRIPT,
      ],
      extractPlan: [
        FOUR_OF_FIVE,
        // Two consecutive transient failures: first gets the silent
        // attempt-2 re-ask, second crosses the bail threshold → Pattern B
        // `recovering` choice instead of the old silent carry-to-taps.
        { kind: 'failed' },
        { kind: 'failed' },
        { kind: 'metrics', metrics: { flare: 'no' } },
      ],
    })

    await enterListening(page)
    await completeListeningTurn(page) // freeform → ask flare
    await completeListeningTurn(page) // flare answer → extract 500 → re-ask
    await completeListeningTurn(page) // second answer → 500 → recovering

    // The recovery choice screen renders the locked narration…
    const choice = page.getByTestId('recovery-choice')
    await expect(choice).toBeVisible({ timeout: 30_000 })
    await expect(choice).toContainText('Want me to ask one at a time')
    // …and the same line was SPOKEN (went through /api/speak).
    await expect
      .poll(() => spoken.includes(TRANSIENT_CHOICE_LINE), {
        timeout: 15_000,
        message: 'waiting for the transient narration on /api/speak',
      })
      .toBe(true)

    // Voice-continue: the question replays and the mic RE-ARMS — the
    // provider-lifecycle seam that vitest green could never prove.
    await page.getByTestId('recovery-continue').click()
    await completeListeningTurn(page) // retried flare answer → success

    await expect(page.getByTestId('confirm-summary')).toBeVisible({
      timeout: 30_000,
    })

    // Four capture turns total: freeform + answer + re-ask + post-recovery.
    await waitForEventCount(sink, 'voice_start_called', 4)
    await waitForEventCount(sink, 'voice_stop_called', 4)
    // Every listening-answer entry re-armed: answer, re-ask, post-recovery.
    await waitForEventCount(sink, 'voice_rearm_fired', 3)
    const rearms = eventsNamed(sink, 'voice_rearm_fired')
    for (const ev of rearms) {
      expect(ev.properties.metric).toBe('flare')
    }
  })

  test('transient freeform-extract failure → recovering; switch to taps lands on Stage 2 with the honest notice', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const { spoken } = await setUp(page, {
      transcripts: [FREEFORM_TRANSCRIPT],
      extractPlan: [{ kind: 'failed' }],
    })

    await enterListening(page)
    await completeListeningTurn(page) // freeform → extract 500 → recovering

    const choice = page.getByTestId('recovery-choice')
    await expect(choice).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(() => spoken.includes(TRANSIENT_CHOICE_LINE), {
        timeout: 15_000,
        message: 'waiting for the transient narration on /api/speak',
      })
      .toBe(true)

    await page.getByTestId('recovery-switch-to-taps').click()

    // Honest transient copy on the tap form ("hiccup", never "limit").
    await expect(page.getByTestId('stage-2')).toBeVisible({ timeout: 30_000 })
    const notice = page.getByTestId('stage-2-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('hiccup')
    await expect(notice).not.toContainText('limit')
  })

  test('daily-cap 429 in the answer loop → spoken bail narration + Stage 2 cap notice, no recovery choice', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const { spoken } = await setUp(page, {
      transcripts: [FREEFORM_TRANSCRIPT, FLARE_ANSWER_TRANSCRIPT],
      extractPlan: [FOUR_OF_FIVE, { kind: 'daily-cap' }],
    })

    await enterListening(page)
    await completeListeningTurn(page) // freeform → ask flare
    await completeListeningTurn(page) // answer → cap 429 → spoken bail

    // The cap is terminal — no false "continue" choice is offered…
    await expect(page.getByTestId('stage-2')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('recovery-choice')).toHaveCount(0)
    // …the Stage-2 notice is the cap copy…
    const notice = page.getByTestId('stage-2-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('limit')
    // …and — the P1 retirement — the failure was narrated OUT LOUD.
    await expect
      .poll(() => spoken.includes(DAILY_CAP_BAIL_LINE), {
        timeout: 15_000,
        message: 'waiting for the daily-cap narration on /api/speak',
      })
      .toBe(true)
  })
})

test.describe('voice Pattern D — per-metric redo + mic abort', () => {
  test('redo during listening-answer aborts the capture, re-asks the same metric with the redo ack, and completes', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const { sink, spoken } = await setUp(page, {
      transcripts: [FREEFORM_TRANSCRIPT, FLARE_ANSWER_TRANSCRIPT],
      extractPlan: [FOUR_OF_FIVE, { kind: 'metrics', metrics: { flare: 'no' } }],
    })

    await enterListening(page)
    await completeListeningTurn(page) // freeform → ask flare

    // Answer turn armed — ask to hear the question again instead of
    // finishing the turn.
    const redo = page.getByTestId('redo-metric-button')
    await redo.waitFor({ state: 'visible', timeout: 30_000 })
    await page.waitForTimeout(700) // let the recorder arm (mirrors completeListeningTurn)
    await redo.click()

    // The discarded capture turn was hard-cancelled, not stopped.
    await waitForEventCount(sink, 'voice_abort_called', 1)

    // The SAME metric is re-asked with the redo ack riding the question's
    // TTS call (zero extra POSTs — one utterance).
    await expect
      .poll(
        () => spoken.some((t) => t.startsWith(REDO_ACK) && t.length > REDO_ACK.length),
        {
          timeout: 15_000,
          message: 'waiting for the redo-ack question on /api/speak',
        },
      )
      .toBe(true)

    // The re-ask turn re-armed the mic; finishing it completes the loop —
    // prior captures (pain/mood/meds/energy) were never lost.
    await completeListeningTurn(page)
    await expect(page.getByTestId('confirm-summary')).toBeVisible({
      timeout: 30_000,
    })

    // Turn ledger: freeform stop + redo-turn abort + final answer stop.
    await waitForEventCount(sink, 'voice_start_called', 3)
    await waitForEventCount(sink, 'voice_stop_called', 2)
    await waitForEventCount(sink, 'voice_rearm_fired', 2)
  })

  test('switch-to-taps during a live listening-answer turn aborts the mic (no hot mic behind the tap form)', async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS)
    const { sink } = await setUp(page, {
      transcripts: [FREEFORM_TRANSCRIPT],
      extractPlan: [FOUR_OF_FIVE],
    })

    await enterListening(page)
    await completeListeningTurn(page) // freeform → ask flare

    // Answer turn armed — bail the whole loop mid-capture.
    const stop = page.getByTestId('stop-button')
    await stop.waitFor({ state: 'visible', timeout: 30_000 })
    await page.waitForTimeout(700)
    await page.getByTestId('switch-to-taps-button').click()

    // Stage 2 carries the captured metrics; the discarded turn was
    // hard-cancelled (abort), NOT finalised (no second stop POST).
    await expect(page.getByTestId('stage-2')).toBeVisible({ timeout: 30_000 })
    await waitForEventCount(sink, 'voice_abort_called', 1)
    await waitForEventCount(sink, 'voice_stop_called', 1)
    expect(eventsNamed(sink, 'voice_stop_called')).toHaveLength(1)
    const abortEv = eventsNamed(sink, 'voice_abort_called')[0]
    expect(abortEv?.properties.category).toBe('lifecycle')
    expect(abortEv?.properties.source).toBe('SarvamAdapter')
  })
})
