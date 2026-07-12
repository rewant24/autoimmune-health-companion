/**
 * Tests for `lib/checkin/voice-telemetry.ts` (2026-07-12 telemetry
 * completion — assessment gap: "telemetry instruments only STT arming").
 *
 * Pure builders only. The page-level wiring (which effect calls which
 * builder, once-per-session bookkeeping) is exercised end-to-end by the
 * A2 harness in `e2e/voice-telemetry-smoke.spec.ts`.
 */
import { describe, it, expect } from 'vitest'

import {
  deriveSessionOutcome,
  isIdleKind,
  ttsFailureFields,
} from '@/lib/checkin/voice-telemetry'
import type { State } from '@/lib/checkin/state-machine'
import type { Transcript } from '@/lib/voice/types'

const TRANSCRIPT: Transcript = { text: '', durationMs: 0 }

const STAGE_2: State = {
  kind: 'stage-2',
  transcript: TRANSCRIPT,
  metrics: {},
  missing: ['pain', 'mood', 'adherenceTaken', 'flare', 'energy'],
  declined: [],
}

const SAVED: State = { kind: 'saved' }

function errorState(kind: 'no-speech' | 'network' | 'permission-denied'): State {
  return { kind: 'error', error: { kind } }
}

const VOICE_OPTS = { conversational: true, extractFailureKind: null } as const

describe('ttsFailureFields', () => {
  it('shapes a Sarvam adapter rejection with kind + status', () => {
    expect(
      ttsFailureFields('question', {
        kind: 'tts_failed',
        status: 500,
        message: 'Sarvam TTS responded with 500',
      }),
    ).toEqual({
      event: 'tts_speak_failed',
      source: 'CheckinPage',
      context: 'question',
      kind: 'tts_failed',
      status: 500,
    })
  })

  it('omits status when the rejection carries none (playback failure)', () => {
    expect(
      ttsFailureFields('greeting', { kind: 'playback_failed' }),
    ).toEqual({
      event: 'tts_speak_failed',
      source: 'CheckinPage',
      context: 'greeting',
      kind: 'playback_failed',
    })
  })

  it('collapses non-adapter rejections (Web Speech plain Error) to kind unknown', () => {
    const fields = ttsFailureFields('closer', new Error('speechSynthesis error'))
    expect(fields).toMatchObject({
      event: 'tts_speak_failed',
      context: 'closer',
      kind: 'unknown',
    })
  })

  it('tolerates null/undefined rejections', () => {
    expect(ttsFailureFields('opener', undefined)).toMatchObject({
      kind: 'unknown',
    })
    expect(ttsFailureFields('opener', null)).toMatchObject({
      kind: 'unknown',
    })
  })

  it('returns null for aborted — cancel() is a normal path, not a failure', () => {
    expect(ttsFailureFields('question', { kind: 'aborted' })).toBeNull()
  })
})

describe('isIdleKind', () => {
  it('treats the idle family as idle and everything else as active', () => {
    expect(isIdleKind('idle')).toBe(true)
    expect(isIdleKind('idle-greeting')).toBe(true)
    expect(isIdleKind('idle-ready')).toBe(true)
    expect(isIdleKind('requesting-permission')).toBe(false)
    expect(isIdleKind('listening')).toBe(false)
    expect(isIdleKind('stage-2')).toBe(false)
    expect(isIdleKind('saved')).toBe(false)
  })
})

describe('deriveSessionOutcome', () => {
  it('saved entry → completed (voice and taps modes)', () => {
    expect(deriveSessionOutcome('saving', SAVED, VOICE_OPTS)).toEqual({
      outcome: 'completed',
    })
    expect(
      deriveSessionOutcome('saving', SAVED, {
        conversational: false,
        extractFailureKind: null,
      }),
    ).toEqual({ outcome: 'completed' })
  })

  it('terminal error entry → error with the error kind', () => {
    expect(
      deriveSessionOutcome('listening', errorState('no-speech'), VOICE_OPTS),
    ).toEqual({ outcome: 'error', errorKind: 'no-speech' })
    expect(
      deriveSessionOutcome(
        'requesting-permission',
        errorState('permission-denied'),
        VOICE_OPTS,
      ),
    ).toEqual({ outcome: 'error', errorKind: 'permission-denied' })
  })

  it('save-failed error is NOT terminal — ConfirmSummary retries in place', () => {
    const saveFailed: State = {
      kind: 'error',
      error: { kind: 'save-failed', message: 'boom' },
    }
    expect(deriveSessionOutcome('saving', saveFailed, VOICE_OPTS)).toBeNull()
  })

  it('voice mode: any voice-loop → stage-2 transition is a user bail by default', () => {
    for (const prev of [
      'listening',
      'extracting',
      'speaking-opener',
      'speaking-question',
      'listening-answer',
      'extracting-answer',
    ] as const) {
      expect(deriveSessionOutcome(prev, STAGE_2, VOICE_OPTS)).toEqual({
        outcome: 'bailed_to_taps',
        reason: 'user',
      })
    }
  })

  it('voice mode: extraction-failure bails carry the failure kind as reason', () => {
    for (const kind of ['daily-cap', 'rate-limited', 'transient'] as const) {
      expect(
        deriveSessionOutcome('extracting-answer', STAGE_2, {
          conversational: true,
          extractFailureKind: kind,
        }),
      ).toEqual({ outcome: 'bailed_to_taps', reason: kind })
    }
  })

  it('taps mode: stage-2 entry is the normal second step, not a bail', () => {
    expect(
      deriveSessionOutcome('extracting', STAGE_2, {
        conversational: false,
        extractFailureKind: null,
      }),
    ).toBeNull()
  })

  it('discard-cancel restoring stage-2 is not a bail', () => {
    expect(deriveSessionOutcome('discarding', STAGE_2, VOICE_OPTS)).toBeNull()
  })

  it('non-terminal transitions derive nothing', () => {
    const listening: State = { kind: 'listening', partial: '' }
    expect(
      deriveSessionOutcome('requesting-permission', listening, VOICE_OPTS),
    ).toBeNull()
    const confirming: State = { kind: 'confirming', transcript: TRANSCRIPT }
    expect(
      deriveSessionOutcome('extracting-answer', confirming, VOICE_OPTS),
    ).toBeNull()
    const saving: State = { kind: 'saving' }
    expect(deriveSessionOutcome('confirming', saving, VOICE_OPTS)).toBeNull()
  })
})
