/**
 * Unit tests for `lib/voice/sink-posthog.ts`.
 *
 * The PostHog SDK itself is not under test — these tests pin the
 * adapter contract (category + fields → posthog.capture shape). When a
 * future provider needs the same swap pattern, mirror this file.
 */
import { describe, it, expect, vi } from 'vitest'

import { makePosthogVoiceSink } from '@/lib/voice/sink-posthog'

describe('makePosthogVoiceSink', () => {
  it('forwards lifecycle events as voice_<event> with category property', () => {
    const capture = vi.fn()
    const sink = makePosthogVoiceSink({ capture })

    sink.log('lifecycle', {
      event: 'start_called',
      source: 'sarvam-adapter',
      providerVersion: 1,
    })

    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith('voice_start_called', {
      category: 'lifecycle',
      source: 'sarvam-adapter',
      providerVersion: 1,
    })
  })

  it('hoists category for guard events while preserving structured fields', () => {
    const capture = vi.fn()
    const sink = makePosthogVoiceSink({ capture })

    sink.log('guard', {
      event: 'tap_stop_skipped_not_started',
      source: 'sarvam-adapter',
      reason: 'adapter not started',
    })

    expect(capture).toHaveBeenCalledWith(
      'voice_tap_stop_skipped_not_started',
      {
        category: 'guard',
        source: 'sarvam-adapter',
        reason: 'adapter not started',
      },
    )
  })

  it('forwards error category cleanly so PostHog exceptions surface', () => {
    const capture = vi.fn()
    const sink = makePosthogVoiceSink({ capture })

    sink.log('error', {
      event: 'tap_stop_threw',
      source: 'sarvam-adapter',
      message: 'fake error',
    })

    expect(capture).toHaveBeenCalledWith('voice_tap_stop_threw', {
      category: 'error',
      source: 'sarvam-adapter',
      message: 'fake error',
    })
  })

  it('handles fields with only the required event name', () => {
    const capture = vi.fn()
    const sink = makePosthogVoiceSink({ capture })

    sink.log('state', { event: 'reducer_transition' })

    expect(capture).toHaveBeenCalledWith('voice_reducer_transition', {
      category: 'state',
    })
  })

  it('drops the event field from properties (event-name owns it)', () => {
    const capture = vi.fn()
    const sink = makePosthogVoiceSink({ capture })

    sink.log('lifecycle', {
      event: 'stop_called',
      extra: 'value',
    })

    const propsArg = capture.mock.calls[0]?.[1] as Record<string, unknown>
    expect(propsArg).not.toHaveProperty('event')
    expect(propsArg.extra).toBe('value')
  })
})
