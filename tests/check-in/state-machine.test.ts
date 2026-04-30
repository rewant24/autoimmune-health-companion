/**
 * Reducer tests for the check-in state machine (US-1.C.1).
 *
 * Pure reducer — no React. One test per transition, plus edge cases
 * called out in the cycle plan:
 *   - double-tap on idle
 *   - TAP_ORB during listening is a no-op at the reducer level
 *     (the hook fires provider.stop)
 *   - RESET from every state returns to idle
 *   - stray events are ignored (state unchanged)
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  Transcript,
  VoiceCapabilities,
  VoiceError,
  VoiceProvider,
} from '@/lib/voice/types'
import {
  initialState,
  reducer,
  toOrbState,
  useCheckinMachine,
  type State,
} from '@/lib/checkin/state-machine'

const transcript: Transcript = { text: 'pain is 4 today', durationMs: 12000 }

const voiceErr = (kind: VoiceError['kind']): VoiceError => ({ kind })

describe('reducer: initial', () => {
  it('starts in idle', () => {
    expect(initialState).toEqual({ kind: 'idle' })
  })
})

describe('reducer: idle transitions', () => {
  it('TAP_ORB moves idle → requesting-permission', () => {
    expect(reducer({ kind: 'idle' }, { type: 'TAP_ORB' })).toEqual({
      kind: 'requesting-permission',
    })
  })

  it('ignores unrelated events from idle', () => {
    expect(
      reducer({ kind: 'idle' }, { type: 'PARTIAL', text: 'hi' }),
    ).toEqual({ kind: 'idle' })
  })

  it('START_GREETING moves idle → idle-greeting (Voice C1 fix-pass)', () => {
    expect(
      reducer(
        { kind: 'idle' },
        { type: 'START_GREETING', text: 'How are you feeling today?', variantKey: 'first-ever' },
      ),
    ).toEqual({
      kind: 'idle-greeting',
      text: 'How are you feeling today?',
      variantKey: 'first-ever',
    })
  })
})

describe('reducer: idle-greeting / idle-ready transitions (Voice C1 fix-pass)', () => {
  const greeting = {
    kind: 'idle-greeting' as const,
    text: 'How are you feeling today?',
    variantKey: 'first-ever' as const,
  }
  const ready = {
    kind: 'idle-ready' as const,
    text: 'How are you feeling today?',
    variantKey: 'first-ever' as const,
  }

  it('GREETING_PLAYED moves idle-greeting → requesting-permission (Fix E auto-progress, ADR-026)', () => {
    expect(reducer(greeting, { type: 'GREETING_PLAYED' })).toEqual({
      kind: 'requesting-permission',
    })
  })

  it('GREETING_FAILED moves idle-greeting → idle-ready with greetingBlocked: true (Fix C — page surfaces the autoplay-blocked cue)', () => {
    expect(reducer(greeting, { type: 'GREETING_FAILED' })).toEqual({
      ...ready,
      greetingBlocked: true,
    })
  })

  it('GREETING_PLAYED produces a clean requesting-permission with no extra fields', () => {
    const result = reducer(greeting, { type: 'GREETING_PLAYED' })
    expect(result).toEqual({ kind: 'requesting-permission' })
  })

  it('TAP_ORB during idle-greeting jumps to requesting-permission (skip the greeting)', () => {
    expect(reducer(greeting, { type: 'TAP_ORB' })).toEqual({
      kind: 'requesting-permission',
    })
  })

  it('TAP_ORB from idle-ready moves to requesting-permission', () => {
    expect(reducer(ready, { type: 'TAP_ORB' })).toEqual({
      kind: 'requesting-permission',
    })
  })

  it('idle-ready ignores unrelated events', () => {
    expect(reducer(ready, { type: 'PARTIAL', text: 'noop' })).toEqual(ready)
  })
})

describe('reducer: requesting-permission transitions', () => {
  it('PERMISSION_GRANTED → listening with empty partial', () => {
    expect(
      reducer(
        { kind: 'requesting-permission' },
        { type: 'PERMISSION_GRANTED' },
      ),
    ).toEqual({ kind: 'listening', partial: '' })
  })

  it('PERMISSION_DENIED → error(permission-denied)', () => {
    expect(
      reducer(
        { kind: 'requesting-permission' },
        { type: 'PERMISSION_DENIED' },
      ),
    ).toEqual({ kind: 'error', error: { kind: 'permission-denied' } })
  })

  it('VOICE_ERROR(unsupported) → error(unsupported)', () => {
    expect(
      reducer(
        { kind: 'requesting-permission' },
        { type: 'VOICE_ERROR', error: voiceErr('unsupported') },
      ),
    ).toEqual({ kind: 'error', error: { kind: 'unsupported' } })
  })

  it('ignores a second TAP_ORB while waiting for permission (double-tap)', () => {
    // Double-tap: user taps the orb twice before the permission prompt
    // resolves. Second tap must not advance the machine.
    const after1 = reducer({ kind: 'idle' }, { type: 'TAP_ORB' })
    const after2 = reducer(after1, { type: 'TAP_ORB' })
    expect(after2).toEqual({ kind: 'requesting-permission' })
  })
})

describe('reducer: listening transitions', () => {
  it('PARTIAL updates the partial transcript', () => {
    expect(
      reducer(
        { kind: 'listening', partial: '' },
        { type: 'PARTIAL', text: 'pain is' },
      ),
    ).toEqual({ kind: 'listening', partial: 'pain is' })
  })

  it('TAP_ORB during listening is a reducer no-op (hook fires provider.stop)', () => {
    const s: State = { kind: 'listening', partial: 'pain is 4' }
    expect(reducer(s, { type: 'TAP_ORB' })).toEqual(s)
  })

  it('PROVIDER_STOPPED → processing with transcript', () => {
    expect(
      reducer(
        { kind: 'listening', partial: 'pain is 4' },
        { type: 'PROVIDER_STOPPED', transcript },
      ),
    ).toEqual({ kind: 'processing', transcript })
  })

  it('VOICE_ERROR(network) → error(network)', () => {
    expect(
      reducer(
        { kind: 'listening', partial: '' },
        { type: 'VOICE_ERROR', error: voiceErr('network') },
      ),
    ).toEqual({ kind: 'error', error: { kind: 'network' } })
  })

  it('VOICE_ERROR(no-speech) → error(no-speech)', () => {
    expect(
      reducer(
        { kind: 'listening', partial: '' },
        { type: 'VOICE_ERROR', error: voiceErr('no-speech') },
      ),
    ).toEqual({ kind: 'error', error: { kind: 'no-speech' } })
  })
})

describe('reducer: processing transitions', () => {
  it('METRICS_READY → confirming with same transcript', () => {
    expect(
      reducer(
        { kind: 'processing', transcript },
        { type: 'METRICS_READY' },
      ),
    ).toEqual({ kind: 'confirming', transcript })
  })

  it('VOICE_ERROR during processing → error', () => {
    expect(
      reducer(
        { kind: 'processing', transcript },
        { type: 'VOICE_ERROR', error: voiceErr('aborted') },
      ),
    ).toEqual({ kind: 'error', error: { kind: 'aborted' } })
  })
})

describe('reducer: confirming → saving', () => {
  it('CONFIRM → saving', () => {
    expect(
      reducer({ kind: 'confirming', transcript }, { type: 'CONFIRM' }),
    ).toEqual({ kind: 'saving' })
  })
})

describe('reducer: saving transitions', () => {
  it('SAVE_OK → saved', () => {
    expect(reducer({ kind: 'saving' }, { type: 'SAVE_OK' })).toEqual({
      kind: 'saved',
    })
  })

  it('SAVE_ERROR → error(save-failed)', () => {
    expect(
      reducer({ kind: 'saving' }, { type: 'SAVE_ERROR', message: 'network' }),
    ).toEqual({
      kind: 'error',
      error: { kind: 'save-failed', message: 'network' },
    })
  })
})

describe('reducer: error transitions', () => {
  it('ignores non-RESET events in error', () => {
    const s: State = { kind: 'error', error: { kind: 'network' } }
    expect(reducer(s, { type: 'CONFIRM' })).toEqual(s)
    expect(reducer(s, { type: 'PARTIAL', text: 'x' })).toEqual(s)
  })
})

describe('reducer: RESET from every state returns to idle', () => {
  const states: State[] = [
    { kind: 'idle' },
    { kind: 'requesting-permission' },
    { kind: 'listening', partial: 'x' },
    { kind: 'processing', transcript },
    { kind: 'confirming', transcript },
    { kind: 'saving' },
    { kind: 'saved' },
    { kind: 'error', error: { kind: 'network' } },
    { kind: 'error', error: { kind: 'save-failed', message: 'x' } },
  ]
  it.each(states)('RESET from %j → idle', (s) => {
    expect(reducer(s, { type: 'RESET' })).toEqual({ kind: 'idle' })
  })
})

describe('R3-9: late event race — error state is terminal', () => {
  // When the provider errors mid-stream, VOICE_ERROR fires first. The
  // pending stop() may still resolve afterwards, dispatching a late
  // PROVIDER_STOPPED. The reducer must not clobber the error state.
  it('VOICE_ERROR during listening → error, late PROVIDER_STOPPED is ignored', () => {
    const afterError = reducer(
      { kind: 'listening', partial: 'halfway through' },
      { type: 'VOICE_ERROR', error: voiceErr('network') },
    )
    expect(afterError).toEqual({
      kind: 'error',
      error: { kind: 'network' },
    })

    // Late PROVIDER_STOPPED arrives after the adapter finally winds down.
    const afterLate = reducer(afterError, {
      type: 'PROVIDER_STOPPED',
      transcript,
    })
    expect(afterLate).toEqual(afterError)
  })

  it('VOICE_ERROR during processing → error, late events ignored', () => {
    const afterError = reducer(
      { kind: 'processing', transcript },
      { type: 'VOICE_ERROR', error: voiceErr('aborted') },
    )
    expect(afterError.kind).toBe('error')
    const afterLate = reducer(afterError, {
      type: 'PARTIAL',
      text: 'stragglers',
    })
    expect(afterLate).toBe(afterError)
  })
})

describe('toOrbState mapping', () => {
  it('maps machine states to visual states', () => {
    expect(toOrbState({ kind: 'idle' })).toBe('idle')
    expect(toOrbState({ kind: 'listening', partial: '' })).toBe('listening')
    expect(toOrbState({ kind: 'requesting-permission' })).toBe('processing')
    expect(toOrbState({ kind: 'processing', transcript })).toBe('processing')
    expect(toOrbState({ kind: 'confirming', transcript })).toBe('processing')
    expect(toOrbState({ kind: 'saving' })).toBe('processing')
    expect(toOrbState({ kind: 'saved' })).toBe('processing')
    expect(toOrbState({ kind: 'error', error: { kind: 'network' } })).toBe(
      'error',
    )
  })
})

// ---------------- C2 Wave 1 transitions ----------------

describe('reducer: extraction transitions (2.B)', () => {
  it('processing + EXTRACTION_START → extracting', () => {
    const next = reducer(
      { kind: 'processing', transcript },
      { type: 'EXTRACTION_START' },
    )
    expect(next).toEqual({ kind: 'extracting', transcript })
  })

  it('extracting + EXTRACTION_DONE with all 5 covered → confirming (ADR-005 skip)', () => {
    const metrics = {
      pain: 4,
      mood: 'okay' as const,
      adherenceTaken: true,
      flare: 'no' as const,
      energy: 6,
    }
    const next = reducer(
      { kind: 'extracting', transcript },
      {
        type: 'EXTRACTION_DONE',
        metrics,
        missing: [],
        stage: 'open',
      },
    )
    expect(next).toEqual({
      kind: 'confirming',
      transcript,
      metrics,
      declined: [],
      stage: 'open',
    })
  })

  it('extracting + EXTRACTION_DONE with some missing → stage-2', () => {
    const next = reducer(
      { kind: 'extracting', transcript },
      {
        type: 'EXTRACTION_DONE',
        metrics: { pain: 5, mood: 'flat' },
        missing: ['adherenceTaken', 'flare', 'energy'],
        stage: 'hybrid',
      },
    )
    expect(next).toMatchObject({
      kind: 'stage-2',
      transcript,
      metrics: { pain: 5, mood: 'flat' },
      missing: ['adherenceTaken', 'flare', 'energy'],
      declined: [],
    })
  })

  it('extracting + EXTRACTION_FAILED → stage-2 with all 5 missing', () => {
    const next = reducer(
      { kind: 'extracting', transcript },
      { type: 'EXTRACTION_FAILED' },
    )
    expect(next).toEqual({
      kind: 'stage-2',
      transcript,
      metrics: {},
      missing: ['pain', 'mood', 'adherenceTaken', 'flare', 'energy'],
      declined: [],
    })
  })
})

describe('reducer: stage-2 transitions (2.C)', () => {
  const baseStage2: State = {
    kind: 'stage-2',
    transcript,
    metrics: { pain: 5 },
    missing: ['mood', 'adherenceTaken', 'flare', 'energy'],
    declined: [],
  }

  it('METRIC_UPDATED sets the value and drops it from missing', () => {
    const next = reducer(baseStage2, {
      type: 'METRIC_UPDATED',
      metric: 'mood',
      value: 'okay',
    })
    expect(next).toMatchObject({
      kind: 'stage-2',
      metrics: { pain: 5, mood: 'okay' },
      missing: ['adherenceTaken', 'flare', 'energy'],
      declined: [],
    })
  })

  it('METRIC_DECLINED writes null, drops from missing, adds to declined', () => {
    const next = reducer(baseStage2, {
      type: 'METRIC_DECLINED',
      metric: 'mood',
    })
    expect(next).toMatchObject({
      kind: 'stage-2',
      metrics: { pain: 5, mood: null },
      missing: ['adherenceTaken', 'flare', 'energy'],
      declined: ['mood'],
    })
  })

  it('METRIC_UPDATED on a previously-declined metric clears the decline', () => {
    const declined: State = {
      ...baseStage2,
      metrics: { pain: 5, mood: null },
      missing: ['adherenceTaken', 'flare', 'energy'],
      declined: ['mood'],
    }
    const next = reducer(declined, {
      type: 'METRIC_UPDATED',
      metric: 'mood',
      value: 'bright',
    })
    expect(next).toMatchObject({
      metrics: { pain: 5, mood: 'bright' },
      declined: [],
    })
  })

  it('STAGE_2_CONTINUE → confirming, omitted metrics declined-by-omission', () => {
    const next = reducer(baseStage2, { type: 'STAGE_2_CONTINUE' })
    expect(next.kind).toBe('confirming')
    if (next.kind !== 'confirming') return
    expect(next.metrics).toEqual({
      pain: 5,
      mood: null,
      adherenceTaken: null,
      flare: null,
      energy: null,
    })
    expect(next.declined).toEqual(['mood', 'adherenceTaken', 'flare', 'energy'])
    expect(next.stage).toBe('hybrid')
  })

  it('STAGE_2_CONTINUE with all 5 declined → stage = scripted', () => {
    const allDeclined: State = {
      kind: 'stage-2',
      transcript,
      metrics: {
        pain: null,
        mood: null,
        adherenceTaken: null,
        flare: null,
        energy: null,
      },
      missing: [],
      declined: ['pain', 'mood', 'adherenceTaken', 'flare', 'energy'],
    }
    const next = reducer(allDeclined, { type: 'STAGE_2_CONTINUE' })
    if (next.kind !== 'confirming') throw new Error('expected confirming')
    expect(next.stage).toBe('scripted')
  })

  it('DISCARD_REQUEST from stage-2 → discarding, preserving previous', () => {
    const next = reducer(baseStage2, { type: 'DISCARD_REQUEST' })
    expect(next.kind).toBe('discarding')
    if (next.kind !== 'discarding') return
    expect(next.previous).toEqual(baseStage2)
  })
})

describe('reducer: confirming transitions (2.D)', () => {
  const baseConfirming: State = {
    kind: 'confirming',
    transcript,
    metrics: {
      pain: 4,
      mood: 'okay',
      adherenceTaken: true,
      flare: 'no',
      energy: 6,
    },
    declined: [],
    stage: 'open',
  }

  it('METRIC_UPDATED edits a value in confirming', () => {
    const next = reducer(baseConfirming, {
      type: 'METRIC_UPDATED',
      metric: 'pain',
      value: 7,
    })
    expect(next.kind).toBe('confirming')
    if (next.kind !== 'confirming' || !next.metrics) return
    expect(next.metrics.pain).toBe(7)
  })

  it('METRIC_DECLINED in confirming nulls the value + records the decline', () => {
    const next = reducer(baseConfirming, {
      type: 'METRIC_DECLINED',
      metric: 'pain',
    })
    expect(next.kind).toBe('confirming')
    if (next.kind !== 'confirming' || !next.metrics) return
    expect(next.metrics.pain).toBeNull()
    expect(next.declined).toEqual(['pain'])
  })

  it('CONFIRM → saving', () => {
    const next = reducer(baseConfirming, { type: 'CONFIRM' })
    expect(next).toEqual({ kind: 'saving' })
  })

  it('DISCARD_REQUEST from confirming → discarding, previous = full state', () => {
    const next = reducer(baseConfirming, { type: 'DISCARD_REQUEST' })
    if (next.kind !== 'discarding') throw new Error('expected discarding')
    expect(next.previous).toEqual(baseConfirming)
  })
})

describe('reducer: discarding transitions (2.D)', () => {
  const previous: State = {
    kind: 'stage-2',
    transcript,
    metrics: { pain: 5 },
    missing: ['mood', 'adherenceTaken', 'flare', 'energy'],
    declined: [],
  }

  it('DISCARD_CONFIRM → idle', () => {
    const next = reducer(
      { kind: 'discarding', previous: previous as never },
      { type: 'DISCARD_CONFIRM' },
    )
    expect(next).toEqual({ kind: 'idle' })
  })

  it('DISCARD_CANCEL → previous state restored verbatim', () => {
    const next = reducer(
      { kind: 'discarding', previous: previous as never },
      { type: 'DISCARD_CANCEL' },
    )
    expect(next).toEqual(previous)
  })
})

describe('reducer: milestone transitions (Wave 2 readiness)', () => {
  it('saved + MILESTONE_DETECTED → celebrating', () => {
    const next = reducer(
      { kind: 'saved' },
      { type: 'MILESTONE_DETECTED', milestone: 'day-7' },
    )
    expect(next).toEqual({ kind: 'celebrating', milestone: 'day-7' })
  })
})

describe('reducer: voice C1 dialog states (Wave 2 transitions)', () => {
  // Transitions implemented per ADR-026 + voice-cycle-1-plan
  // §State-machine extension protocol. The reducer remains pure — the page
  // is responsible for kicking TTS/STT and dispatching the lifecycle events
  // (OPENER_PLAYED, QUESTION_PLAYED, ANSWER_EXTRACTED, etc).
  const baseTranscript: Transcript = { text: 'hello', durationMs: 1000 }
  const ALL_MISSING: Array<
    'pain' | 'mood' | 'adherenceTaken' | 'flare' | 'energy'
  > = ['pain', 'mood', 'adherenceTaken', 'flare', 'energy']

  // ---- requesting-permission with conversational opener payload ----

  it('PERMISSION_GRANTED with opener payload → speaking-opener', () => {
    const next = reducer(
      { kind: 'requesting-permission' },
      {
        type: 'PERMISSION_GRANTED',
        opener: { text: 'Welcome back.', variantKey: 'first-ever' },
      },
    )
    expect(next).toEqual({
      kind: 'speaking-opener',
      text: 'Welcome back.',
      variantKey: 'first-ever',
    })
  })

  // ---- speaking-opener ----

  it('speaking-opener + OPENER_PLAYED → listening', () => {
    const s: State = {
      kind: 'speaking-opener',
      text: 'Welcome back.',
      variantKey: 'first-ever',
    }
    expect(reducer(s, { type: 'OPENER_PLAYED' })).toEqual({
      kind: 'listening',
      partial: '',
    })
  })

  it('speaking-opener + OPENER_FAILED → listening (silent fallback)', () => {
    const s: State = {
      kind: 'speaking-opener',
      text: 'Welcome back.',
      variantKey: 'first-ever',
    }
    expect(reducer(s, { type: 'OPENER_FAILED' })).toEqual({
      kind: 'listening',
      partial: '',
    })
  })

  it('speaking-opener + BAIL_TO_TAPS → empty stage-2', () => {
    const s: State = {
      kind: 'speaking-opener',
      text: 'Welcome back.',
      variantKey: 'first-ever',
    }
    expect(reducer(s, { type: 'BAIL_TO_TAPS' })).toEqual({
      kind: 'stage-2',
      transcript: { text: '', durationMs: 0 },
      metrics: {},
      missing: ALL_MISSING,
      declined: [],
    })
  })

  // ---- listening (freeform) bail-out ----

  it('listening + BAIL_TO_TAPS → empty stage-2', () => {
    const next = reducer(
      { kind: 'listening', partial: 'I had pain' },
      { type: 'BAIL_TO_TAPS' },
    )
    expect(next).toEqual({
      kind: 'stage-2',
      transcript: { text: '', durationMs: 0 },
      metrics: {},
      missing: ALL_MISSING,
      declined: [],
    })
  })

  // ---- extracting + ASK_QUESTION (entry into per-metric loop) ----

  it('extracting + ASK_QUESTION (with seed) → speaking-question', () => {
    const next = reducer(
      { kind: 'extracting', transcript: baseTranscript },
      {
        type: 'ASK_QUESTION',
        metric: 'mood',
        text: 'How was your mood today?',
        seed: {
          metrics: { pain: 4 },
          missing: ['mood', 'adherenceTaken'],
          declined: [],
        },
      },
    )
    expect(next).toEqual({
      kind: 'speaking-question',
      metric: 'mood',
      text: 'How was your mood today?',
      metrics: { pain: 4 },
      missing: ['mood', 'adherenceTaken'],
      declined: [],
      transcript: baseTranscript,
    })
  })

  it('extracting + BAIL_TO_TAPS → empty stage-2 (carries the freeform transcript)', () => {
    const next = reducer(
      { kind: 'extracting', transcript: baseTranscript },
      { type: 'BAIL_TO_TAPS' },
    )
    expect(next).toEqual({
      kind: 'stage-2',
      transcript: baseTranscript,
      metrics: {},
      missing: ALL_MISSING,
      declined: [],
    })
  })

  // ---- speaking-question ----

  it('speaking-question + QUESTION_PLAYED → listening-answer (carries payload)', () => {
    const s: State = {
      kind: 'speaking-question',
      metric: 'pain',
      text: 'How is your pain?',
      metrics: {},
      missing: ['pain', 'mood'],
      declined: [],
      transcript: baseTranscript,
    }
    expect(reducer(s, { type: 'QUESTION_PLAYED' })).toEqual({
      kind: 'listening-answer',
      metric: 'pain',
      partial: '',
      metrics: {},
      missing: ['pain', 'mood'],
      declined: [],
      transcript: baseTranscript,
    })
  })

  it('speaking-question + BAIL_TO_TAPS → stage-2 carrying loop payload', () => {
    const s: State = {
      kind: 'speaking-question',
      metric: 'pain',
      text: 'How is your pain?',
      metrics: { mood: 'okay' },
      missing: ['pain', 'adherenceTaken'],
      declined: ['flare'],
      transcript: baseTranscript,
    }
    expect(reducer(s, { type: 'BAIL_TO_TAPS' })).toEqual({
      kind: 'stage-2',
      transcript: baseTranscript,
      metrics: { mood: 'okay' },
      missing: ['pain', 'adherenceTaken'],
      declined: ['flare'],
    })
  })

  // ---- listening-answer ----

  it('listening-answer + PARTIAL → updates partial in place', () => {
    const s: State = {
      kind: 'listening-answer',
      metric: 'pain',
      partial: '',
      metrics: {},
      missing: ['pain'],
      declined: [],
      transcript: baseTranscript,
    }
    const next = reducer(s, { type: 'PARTIAL', text: 'about a four' })
    expect(next).toEqual({ ...s, partial: 'about a four' })
  })

  it('listening-answer + PROVIDER_STOPPED → extracting-answer', () => {
    const s: State = {
      kind: 'listening-answer',
      metric: 'pain',
      partial: 'about a four',
      metrics: {},
      missing: ['pain'],
      declined: [],
      transcript: baseTranscript,
    }
    const answerTranscript: Transcript = {
      text: 'about a four',
      durationMs: 2000,
    }
    expect(
      reducer(s, { type: 'PROVIDER_STOPPED', transcript: answerTranscript }),
    ).toEqual({
      kind: 'extracting-answer',
      metric: 'pain',
      answerTranscript,
      metrics: {},
      missing: ['pain'],
      declined: [],
      transcript: baseTranscript,
    })
  })

  it('listening-answer + BAIL_TO_TAPS → stage-2 carrying loop payload', () => {
    const s: State = {
      kind: 'listening-answer',
      metric: 'pain',
      partial: 'about a four',
      metrics: { mood: 'okay' },
      missing: ['pain'],
      declined: [],
      transcript: baseTranscript,
    }
    expect(reducer(s, { type: 'BAIL_TO_TAPS' })).toEqual({
      kind: 'stage-2',
      transcript: baseTranscript,
      metrics: { mood: 'okay' },
      missing: ['pain'],
      declined: [],
    })
  })

  // ---- extracting-answer ANSWER_EXTRACTED outcomes ----

  it('extracting-answer + ANSWER_EXTRACTED with metric → updates state, stays in extracting-answer when missing remains', () => {
    const s: State = {
      kind: 'extracting-answer',
      metric: 'pain',
      answerTranscript: { text: 'about a four', durationMs: 2000 },
      metrics: { mood: 'okay' },
      missing: ['pain', 'adherenceTaken'],
      declined: [],
      transcript: baseTranscript,
    }
    const next = reducer(s, {
      type: 'ANSWER_EXTRACTED',
      metrics: { pain: 4 },
      declined: false,
    })
    expect(next).toEqual({
      ...s,
      metrics: { mood: 'okay', pain: 4 },
      missing: ['adherenceTaken'],
      declined: [],
    })
  })

  it('extracting-answer + ANSWER_EXTRACTED declined → marks declined, drops from missing', () => {
    const s: State = {
      kind: 'extracting-answer',
      metric: 'pain',
      answerTranscript: { text: "I'd rather not say", durationMs: 2000 },
      metrics: {},
      missing: ['pain', 'mood'],
      declined: [],
      transcript: baseTranscript,
    }
    const next = reducer(s, {
      type: 'ANSWER_EXTRACTED',
      metrics: {},
      declined: true,
    })
    expect(next).toEqual({
      ...s,
      metrics: { pain: null },
      missing: ['mood'],
      declined: ['pain'],
    })
  })

  it('extracting-answer + ANSWER_EXTRACTED that empties missing → confirming(stage=hybrid)', () => {
    const s: State = {
      kind: 'extracting-answer',
      metric: 'energy',
      answerTranscript: { text: 'about a six', durationMs: 1500 },
      metrics: {
        pain: 4,
        mood: 'okay',
        adherenceTaken: true,
        flare: 'no',
      },
      missing: ['energy'],
      declined: [],
      transcript: baseTranscript,
    }
    const next = reducer(s, {
      type: 'ANSWER_EXTRACTED',
      metrics: { energy: 6 },
      declined: false,
    })
    expect(next).toEqual({
      kind: 'confirming',
      transcript: baseTranscript,
      metrics: {
        pain: 4,
        mood: 'okay',
        adherenceTaken: true,
        flare: 'no',
        energy: 6,
      },
      declined: [],
      stage: 'hybrid',
    })
  })

  it('extracting-answer + ANSWER_EXTRACTED with no extract and no decline → state unchanged (re-ask path)', () => {
    const s: State = {
      kind: 'extracting-answer',
      metric: 'pain',
      answerTranscript: { text: 'umm', durationMs: 800 },
      metrics: {},
      missing: ['pain', 'mood'],
      declined: [],
      transcript: baseTranscript,
    }
    expect(
      reducer(s, { type: 'ANSWER_EXTRACTED', metrics: {}, declined: false }),
    ).toEqual(s)
  })

  it('extracting-answer + ASK_QUESTION (no seed) → speaking-question with carried payload', () => {
    const s: State = {
      kind: 'extracting-answer',
      metric: 'pain',
      answerTranscript: { text: 'about a four', durationMs: 2000 },
      metrics: { pain: 4 },
      missing: ['mood'],
      declined: [],
      transcript: baseTranscript,
    }
    const next = reducer(s, {
      type: 'ASK_QUESTION',
      metric: 'mood',
      text: 'And your mood?',
    })
    expect(next).toEqual({
      kind: 'speaking-question',
      metric: 'mood',
      text: 'And your mood?',
      metrics: { pain: 4 },
      missing: ['mood'],
      declined: [],
      transcript: baseTranscript,
    })
  })

  it('extracting-answer + BAIL_TO_TAPS → stage-2 carrying loop payload', () => {
    const s: State = {
      kind: 'extracting-answer',
      metric: 'pain',
      answerTranscript: { text: 'about a four', durationMs: 2000 },
      metrics: { mood: 'okay' },
      missing: ['pain'],
      declined: ['flare'],
      transcript: baseTranscript,
    }
    expect(reducer(s, { type: 'BAIL_TO_TAPS' })).toEqual({
      kind: 'stage-2',
      transcript: baseTranscript,
      metrics: { mood: 'okay' },
      missing: ['pain'],
      declined: ['flare'],
    })
  })

  // ---- confirming with closer payload ----

  it('confirming + CONFIRM with closer payload → speaking-closer (carries metrics/declined/stage)', () => {
    const next = reducer(
      {
        kind: 'confirming',
        transcript: baseTranscript,
        metrics: {
          pain: 4,
          mood: 'okay',
          adherenceTaken: true,
          flare: 'no',
          energy: 6,
        },
        declined: ['flare'],
        stage: 'hybrid',
      },
      { type: 'CONFIRM', closer: { text: 'See you tomorrow.' } },
    )
    expect(next).toEqual({
      kind: 'speaking-closer',
      text: 'See you tomorrow.',
      metrics: {
        pain: 4,
        mood: 'okay',
        adherenceTaken: true,
        flare: 'no',
        energy: 6,
      },
      declined: ['flare'],
      stage: 'hybrid',
      transcript: baseTranscript,
    })
  })

  // ---- speaking-closer ----

  it('speaking-closer + CLOSER_PLAYED → saving', () => {
    const s: State = {
      kind: 'speaking-closer',
      text: 'See you tomorrow.',
      metrics: {
        pain: 4,
        mood: 'okay',
        adherenceTaken: true,
        flare: 'no',
        energy: 6,
      },
      declined: [],
      stage: 'open',
      transcript: baseTranscript,
    }
    expect(reducer(s, { type: 'CLOSER_PLAYED' })).toEqual({ kind: 'saving' })
  })

  it('speaking-closer + BAIL_TO_TAPS → confirming (cancel TTS, edit again)', () => {
    const s: State = {
      kind: 'speaking-closer',
      text: 'See you tomorrow.',
      metrics: {
        pain: 4,
        mood: 'okay',
        adherenceTaken: true,
        flare: 'no',
        energy: 6,
      },
      declined: ['flare'],
      stage: 'hybrid',
      transcript: baseTranscript,
    }
    expect(reducer(s, { type: 'BAIL_TO_TAPS' })).toEqual({
      kind: 'confirming',
      transcript: baseTranscript,
      metrics: {
        pain: 4,
        mood: 'okay',
        adherenceTaken: true,
        flare: 'no',
        energy: 6,
      },
      declined: ['flare'],
      stage: 'hybrid',
    })
  })

  it('union compiles: every new event type is assignable to Event', () => {
    // Type-level sentinel — if any new event type is missing from the
    // Event union, this file fails tsc.
    const events: Array<Parameters<typeof reducer>[1]> = [
      { type: 'OPENER_PLAYED' },
      { type: 'OPENER_FAILED' },
      { type: 'ASK_QUESTION', metric: 'pain', text: 'How is your pain?' },
      { type: 'QUESTION_PLAYED' },
      { type: 'ANSWER_TRANSCRIBED', transcript: baseTranscript },
      { type: 'ANSWER_EXTRACTED', metrics: { pain: 4 }, declined: false },
      { type: 'BAIL_TO_TAPS' },
      { type: 'CLOSER_PLAYED' },
    ]
    expect(events).toHaveLength(8)
  })
})

// --- Fix E hook tests ------------------------------------------------------

interface FakeProvider extends VoiceProvider {
  start: VoiceProvider['start'] & { mock: { calls: unknown[][] } }
  stop: VoiceProvider['stop'] & { mock: { calls: unknown[][] } }
  /** Test seam: fire the captured silence listener (Fix F.1). */
  fireSilence: () => void
}

function makeFakeProvider(): FakeProvider {
  const caps = {
    streaming: false,
    interim: false,
  } as unknown as VoiceCapabilities
  const start = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const stop = vi.fn<() => Promise<Transcript>>().mockResolvedValue({
    text: 'auto-stopped transcript',
    durationMs: 1500,
  } as Transcript)
  let silenceCb: (() => void) | null = null
  return {
    start: start as FakeProvider['start'],
    stop: stop as FakeProvider['stop'],
    onPartial: vi.fn(),
    onError: vi.fn(),
    onSilence: vi.fn((cb: () => void) => {
      silenceCb = cb
    }) as VoiceProvider['onSilence'],
    fireSilence: () => silenceCb?.(),
    capabilities: caps,
  }
}

describe('useCheckinMachine — Fix E auto-progress', () => {
  it('fires provider.start() on idle-greeting → requesting-permission (auto-progress)', async () => {
    const provider = makeFakeProvider()
    const { result } = renderHook(() =>
      useCheckinMachine(provider, vi.fn().mockResolvedValue(undefined)),
    )

    act(() => {
      result.current.dispatch({
        type: 'START_GREETING',
        text: 'Hi.',
        variantKey: 'first-ever',
      })
    })
    expect(provider.start).not.toHaveBeenCalled()

    act(() => {
      result.current.dispatch({ type: 'GREETING_PLAYED' })
    })

    await waitFor(() => {
      expect(provider.start).toHaveBeenCalledTimes(1)
    })
    // After start() resolves, the effect dispatches a payload-less
    // PERMISSION_GRANTED → reducer drops into freeform listening
    // (opener was already spoken so we don't replay it).
    await waitFor(() => {
      expect(result.current.state.kind).toBe('listening')
    })
  })

  it('cold TAP_ORB from idle still attaches opener payload (regression for priorStateRef)', async () => {
    const provider = makeFakeProvider()
    const getOpener = vi.fn(() => ({
      text: 'Hi there.',
      variantKey: 'first-ever' as const,
    }))
    const { result } = renderHook(() =>
      useCheckinMachine(provider, vi.fn().mockResolvedValue(undefined), {
        getOpener,
      }),
    )

    act(() => {
      result.current.dispatch({ type: 'TAP_ORB' })
    })

    await waitFor(() => {
      expect(provider.start).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.state.kind).toBe('speaking-opener')
    })
    expect(getOpener).toHaveBeenCalled()
  })

  it('does not double-fire start() on cold tap (interceptor + effect must not both call start)', async () => {
    const provider = makeFakeProvider()
    const { result } = renderHook(() =>
      useCheckinMachine(provider, vi.fn().mockResolvedValue(undefined)),
    )
    act(() => {
      result.current.dispatch({ type: 'TAP_ORB' })
    })
    await waitFor(() => {
      expect(provider.start).toHaveBeenCalledTimes(1)
    })
    // Allow the requesting-permission effect to run if it's going to.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(provider.start).toHaveBeenCalledTimes(1)
  })

  it('idle-ready TAP_ORB (greetingBlocked path) fires start() via effect', async () => {
    const provider = makeFakeProvider()
    const { result } = renderHook(() =>
      useCheckinMachine(provider, vi.fn().mockResolvedValue(undefined)),
    )
    act(() => {
      result.current.dispatch({
        type: 'START_GREETING',
        text: 'Hi.',
        variantKey: 'first-ever',
      })
    })
    act(() => {
      result.current.dispatch({ type: 'GREETING_FAILED' })
    })
    expect(result.current.state.kind).toBe('idle-ready')
    expect(provider.start).not.toHaveBeenCalled()

    act(() => {
      result.current.dispatch({ type: 'TAP_ORB' })
    })
    await waitFor(() => {
      expect(provider.start).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.state.kind).toBe('listening')
    })
  })
})

describe('useCheckinMachine — Fix F.1 silence VAD ownership', () => {
  it('silence VAD: provider fires onSilence → hook stops + dispatches PROVIDER_STOPPED', async () => {
    const provider = makeFakeProvider()
    const { result } = renderHook(() =>
      useCheckinMachine(provider, vi.fn().mockResolvedValue(undefined)),
    )
    // Drive idle → listening via the auto-progress path.
    act(() => {
      result.current.dispatch({
        type: 'START_GREETING',
        text: 'Hi.',
        variantKey: 'first-ever',
      })
    })
    act(() => {
      result.current.dispatch({ type: 'GREETING_PLAYED' })
    })
    await waitFor(() => {
      expect(provider.start).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.state.kind).toBe('listening')
    })

    // Fire silence VAD via the captured listener.
    act(() => {
      provider.fireSilence()
    })
    await waitFor(() => {
      expect(provider.stop).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(result.current.state.kind).toBe('processing')
    })
    // The transcript from the fake stop() resolution should have been
    // dispatched into the reducer via PROVIDER_STOPPED.
    if (result.current.state.kind === 'processing') {
      expect(result.current.state.transcript.text).toBe(
        'auto-stopped transcript',
      )
    }
  })

  it('silence-then-tap: a tap after silence does not fire a second stop()', async () => {
    const provider = makeFakeProvider()
    // Pin stop() so PROVIDER_STOPPED only dispatches when we resolve it,
    // letting us send the late TAP_ORB while the reducer is still in
    // `listening`.
    let resolveStop!: (t: Transcript) => void
    ;(provider.stop as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise<Transcript>((resolve) => {
          resolveStop = resolve
        }),
    )
    const { result } = renderHook(() =>
      useCheckinMachine(provider, vi.fn().mockResolvedValue(undefined)),
    )
    act(() => {
      result.current.dispatch({
        type: 'START_GREETING',
        text: 'Hi.',
        variantKey: 'first-ever',
      })
    })
    act(() => {
      result.current.dispatch({ type: 'GREETING_PLAYED' })
    })
    await waitFor(() => {
      expect(result.current.state.kind).toBe('listening')
    })

    act(() => {
      provider.fireSilence()
    })
    await waitFor(() => {
      expect(provider.stop).toHaveBeenCalledTimes(1)
    })

    // Late tap arrives while stop() is still in flight — guard swallows.
    act(() => {
      result.current.dispatch({ type: 'TAP_ORB' })
    })
    expect(provider.stop).toHaveBeenCalledTimes(1)

    // Resolve stop() — reducer transitions normally.
    act(() => {
      resolveStop({ text: 'late', durationMs: 1 } as Transcript)
    })
    await waitFor(() => {
      expect(result.current.state.kind).toBe('processing')
    })
  })
})

// F05 fix-pass — confirming-event additions: race-tolerant transitions.
describe('reducer: confirming-event fix-pass transitions', () => {
  const sampleVisit = {
    doctorName: 'Dr. Mehta',
    date: '2026-05-10',
    visitType: 'consultation' as const,
  }
  const sampleBloodWork = {
    date: '2026-05-10',
    markers: [{ name: 'CRP', value: 12, unit: 'mg/L' }],
  }
  const baseConfirmingEvent: State = {
    kind: 'confirming-event',
    transcript,
    metrics: {
      pain: 4,
      mood: 'okay',
      adherenceTaken: true,
      flare: 'no',
      energy: 6,
    },
    declined: [],
    stage: 'open',
    pendingVisits: [sampleVisit],
    pendingBloodWork: [],
    acceptedVisits: [],
    acceptedBloodWork: [],
  }

  it('EVENT_EXTRACTED merges new pending entries with existing ones', () => {
    const next = reducer(baseConfirmingEvent, {
      type: 'EVENT_EXTRACTED',
      visits: [],
      bloodWork: [sampleBloodWork],
    })
    if (next.kind !== 'confirming-event') throw new Error('expected confirming-event')
    expect(next.pendingVisits).toHaveLength(1)
    expect(next.pendingBloodWork).toHaveLength(1)
  })

  it('METRIC_UPDATED edits a metric without clearing event state', () => {
    const next = reducer(baseConfirmingEvent, {
      type: 'METRIC_UPDATED',
      metric: 'pain',
      value: 7,
    })
    if (next.kind !== 'confirming-event') throw new Error('expected confirming-event')
    expect(next.metrics.pain).toBe(7)
    expect(next.pendingVisits).toEqual(baseConfirmingEvent.pendingVisits)
  })

  it('METRIC_DECLINED records the decline + nulls the value', () => {
    const next = reducer(baseConfirmingEvent, {
      type: 'METRIC_DECLINED',
      metric: 'pain',
    })
    if (next.kind !== 'confirming-event') throw new Error('expected confirming-event')
    expect(next.metrics.pain).toBeNull()
    expect(next.declined).toEqual(['pain'])
  })

  it('CONFIRM (no closer) routes to saving — same as EVENT_CONFIRM_DONE', () => {
    const next = reducer(baseConfirmingEvent, { type: 'CONFIRM' })
    expect(next).toEqual({ kind: 'saving' })
  })

  it('CONFIRM with closer routes through speaking-closer', () => {
    const next = reducer(baseConfirmingEvent, {
      type: 'CONFIRM',
      closer: { text: 'Take care.' },
    })
    if (next.kind !== 'speaking-closer') throw new Error('expected speaking-closer')
    expect(next.text).toBe('Take care.')
    expect(next.metrics).toEqual(baseConfirmingEvent.metrics)
  })

  it('speaking-closer EVENT_EXTRACTED routes back into confirming-event', () => {
    const speakingCloser: State = {
      kind: 'speaking-closer',
      text: 'Take care.',
      metrics: baseConfirmingEvent.metrics,
      declined: [],
      stage: 'open',
      transcript,
    }
    const next = reducer(speakingCloser, {
      type: 'EVENT_EXTRACTED',
      visits: [sampleVisit],
      bloodWork: [],
    })
    if (next.kind !== 'confirming-event') throw new Error('expected confirming-event')
    expect(next.pendingVisits).toEqual([sampleVisit])
  })

  it('saving drops late EVENT_EXTRACTED on the floor', () => {
    const next = reducer(
      { kind: 'saving' },
      { type: 'EVENT_EXTRACTED', visits: [sampleVisit], bloodWork: [] },
    )
    expect(next).toEqual({ kind: 'saving' })
  })
})
