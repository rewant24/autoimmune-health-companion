/**
 * Same-day re-entry payload builder.
 *
 * Feature 01, Cycle 2, Chunk 2.F, story Reentry.US-1.J.2.
 *
 * When the user lands on `/check-in` and an existing check-in for today
 * already exists (detected via the new Convex `getTodayCheckin` query),
 * the page picks the `re-entry-same-day` opener and — on save — calls
 * `buildAppendPayload` to produce a `CreateCheckinArgs` that points at the
 * prior row via `appendedTo`. The original row is *not* modified; a new
 * row is appended. The pattern engine reads the latest row per
 * `(userId, date)` per metric, so values in this payload override the
 * prior ones for downstream views.
 *
 * Convex schema already accepts `appendedTo` (pre-flight migration).
 *
 * Stage default = `'open'`: the re-entry transcript is treated as fresh
 * voice input. Callers can override (e.g. `'hybrid'` when Stage 2 ran).
 */

import type { CheckinRow, CreateCheckinArgs } from '@/convex/checkIns'
import type { CheckinMetrics, Metric, StageEnum } from './types'

export interface BuildAppendPayloadOptions {
  clientRequestId: string
  durationMs: number
  /** Defaults to the prior row's `providerUsed`. */
  providerUsed?: string
  /** Defaults to `'open'`. */
  stage?: StageEnum
}

export function buildAppendPayload(
  prior: CheckinRow,
  newMetrics: CheckinMetrics,
  transcript: string,
  declined: Metric[],
  opts: BuildAppendPayloadOptions,
): CreateCheckinArgs {
  // Convex `v.optional()` distinguishes undefined ("not captured / declined")
  // from a present value. Translate `null` → `undefined` so the row's
  // optional columns stay unset.
  const args: CreateCheckinArgs = {
    userId: prior.userId,
    date: prior.date,
    transcript,
    stage: opts.stage ?? 'open',
    durationMs: opts.durationMs,
    providerUsed: opts.providerUsed ?? prior.providerUsed,
    clientRequestId: opts.clientRequestId,
    appendedTo: prior._id,
    declined: [...declined],
  }

  if (newMetrics.pain !== null) args.pain = newMetrics.pain
  if (newMetrics.mood !== null) args.mood = newMetrics.mood
  if (newMetrics.adherenceTaken !== null) {
    args.adherenceTaken = newMetrics.adherenceTaken
  }
  if (newMetrics.flare !== null) args.flare = newMetrics.flare
  if (newMetrics.energy !== null) args.energy = newMetrics.energy

  return args
}
