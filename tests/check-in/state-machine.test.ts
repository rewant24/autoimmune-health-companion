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

import { describe, expect, it } from 'vitest'
import type { Transcript, VoiceError } from '@/lib/voice/types'
import {
  initialState,
  reducer,
  toOrbState,
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
