/**
 * PostHog adapter for the voice-pipeline logger (`lib/voice/log.ts`).
 *
 * Implements `VoiceLogSink` so any future telemetry provider can swap in
 * via `setVoiceLogSink(otherSink)` — no call sites in
 * `sarvam-adapter.ts`, `state-machine.ts`, or anywhere else change. See
 * `docs/features/voice-telemetry-posthog.md` for the decision context
 * + swap-friendliness contract.
 *
 * Design notes:
 *  - PostHog instance is passed in (not imported here) so the adapter is
 *    trivially unit-testable with a mock and so the bootstrap module
 *    owns the init lifecycle.
 *  - Event-name shape: `voice_${fields.event}`. PostHog's UI groups on
 *    event-name prefixes, so the `voice_*` namespace separates voice
 *    pipeline events from any future product-analytics events without
 *    a per-event taxonomy refactor.
 *  - `category` rides along as a property so a single PostHog insight
 *    can split lifecycle vs guard vs error vs state without parsing
 *    event names.
 */
import type { VoiceLogFields, VoiceLogSink, VoiceLogCategory } from './log'

/**
 * Minimal shape the adapter needs from the PostHog client.
 *
 * Avoiding a direct `posthog-js` import here keeps this file free of a
 * heavy SDK dependency and lets the test pass a plain object without
 * standing up a real PostHog client.
 */
export interface PosthogCaptureClient {
  capture(eventName: string, properties: Record<string, unknown>): void
}

/**
 * Build a `VoiceLogSink` backed by the given PostHog client.
 *
 * The returned sink installs cleanly via:
 *   setVoiceLogSink(makePosthogVoiceSink(posthog))
 */
export function makePosthogVoiceSink(
  client: PosthogCaptureClient,
): VoiceLogSink {
  return {
    log(category: VoiceLogCategory, fields: VoiceLogFields): void {
      const { event, ...rest } = fields
      // PostHog's `capture` API accepts arbitrary key-values. We forward
      // the structured fields directly so insight filters can pick any
      // of them up. `category` is hoisted to its own column for the
      // dominant "split by kind" query.
      client.capture(`voice_${event}`, {
        category,
        ...rest,
      })
    },
  }
}
