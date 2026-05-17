/**
 * Decide which event to dispatch when the check-in extract call fails
 * (daily-cap 429, gateway 429, network error, malformed body).
 *
 * Voice mode (ttsAvailable=true): keep the spoken loop alive by asking
 * the first metric out loud. Without this branch, every extract failure
 * cliff-edges into a silent Stage 2 form — the user spoke, the assistant
 * fell mute, and a tap form appeared.
 *
 * Tap-only (ttsAvailable=false): fall through to the scripted Stage 2
 * form so every control renders. No data loss — transcript is still
 * attached upstream.
 *
 * Extracted from the inline catch block in `app/check-in/page.tsx` so
 * the contract can be unit-tested without standing up a full page-render
 * harness. See PR #21 (voice-loop silent-fallthrough regression).
 */
import type { Metric } from './types'
import type { ContinuityState } from './types'
import type { Event } from './state-machine'
import { selectFollowUpQuestion } from '@/lib/saha/follow-up-engine'

const ALL_METRICS: readonly Metric[] = [
  'pain',
  'mood',
  'adherenceTaken',
  'flare',
  'energy',
] as const

export function extractFailureFallback(
  ttsAvailable: boolean,
  continuityState: ContinuityState,
): Event {
  if (!ttsAvailable) {
    return { type: 'EXTRACTION_FAILED' }
  }
  const next = ALL_METRICS[0]
  if (next === undefined) {
    return { type: 'EXTRACTION_FAILED' }
  }
  const q = selectFollowUpQuestion(next, 1, continuityState)
  return {
    type: 'ASK_QUESTION',
    metric: next,
    text: q.text,
    seed: {
      metrics: {},
      missing: [...ALL_METRICS],
      declined: [],
    },
  }
}
