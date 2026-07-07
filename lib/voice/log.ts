/**
 * Minimal structured logger for voice-pipeline observability.
 *
 * Voice is the primary input modality and historically races (stop/start
 * lifecycle, silence-VAD-vs-tap, re-arm timing) only surface as user-
 * reported errors because the pipeline has no instrumentation. This
 * module is the first thin layer: prefix `[voice]`, structured fields,
 * cheap enough to call on every adapter/hook seam.
 *
 * Output today is `console` so it lands in browser DevTools + Vercel
 * server logs without a vendor dependency. The next iteration (Layer 2
 * in the voice-first observability plan) replaces the `sink` with a
 * real telemetry transport (Sentry / PostHog / Vercel Analytics
 * custom events) without changing call sites.
 *
 * Categories: 'lifecycle' (start/stop), 'guard' (skipped operations),
 * 'error' (caught failures), 'state' (reducer transitions of interest).
 * Keep field shapes stable across categories so downstream filters /
 * dashboards can group on a single key.
 */

export type VoiceLogCategory = 'lifecycle' | 'guard' | 'error' | 'state'

export interface VoiceLogFields {
  /** Fixed event name. Stable across versions; treat as the primary key. */
  event: string
  /** Optional adapter/component the event came from. */
  source?: string
  /** Free-form structured payload — no PII, no transcripts. */
  [k: string]: unknown
}

export interface VoiceLogSink {
  log(category: VoiceLogCategory, fields: VoiceLogFields): void
}

const defaultSink: VoiceLogSink = {
  log(category, fields) {
    if (typeof console === 'undefined') return
    const method =
      category === 'error'
        ? 'error'
        : category === 'guard'
          ? 'warn'
          : 'log'
    console[method](`[voice]`, category, fields)
  },
}

let sink: VoiceLogSink = defaultSink

/** Replace the sink. Test seam + Layer-2 telemetry swap. */
export function setVoiceLogSink(next: VoiceLogSink): void {
  sink = next
}

/** Reset the sink to the default console-based implementation. */
export function resetVoiceLogSink(): void {
  sink = defaultSink
}

export function voiceLog(
  category: VoiceLogCategory,
  fields: VoiceLogFields,
): void {
  try {
    sink.log(category, fields)
  } catch {
    // Logger must never throw into the voice pipeline.
  }
}
