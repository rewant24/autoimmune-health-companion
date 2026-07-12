/**
 * Voice-telemetry field builders for the check-in page (2026-07-12).
 *
 * Closes the 2026-07-04 voice-humanness assessment gap: "telemetry
 * instruments only STT arming". Two pure builders live here so the
 * page-level effects stay thin and the decision logic is unit-testable
 * without rendering the page:
 *
 *  - `ttsFailureFields` — shapes a `tts_speak_failed` event from any
 *    `tts.speak()` rejection, tagged with the utterance context
 *    (greeting / opener / question / closer / ack). Returns null for
 *    `aborted` rejections: `cancel()` is a normal path (effect cleanup,
 *    bail-to-taps, orb-tap greeting skip), not a failure.
 *  - `deriveSessionOutcome` — maps a state transition to the voice
 *    session's terminal outcome (completed / bailed_to_taps / error),
 *    or null when the transition isn't terminal. The page owns the
 *    once-per-session bookkeeping plus the two `abandoned` paths
 *    (reset-to-idle, unmount) — those need refs, not derivation.
 *
 * No PII: fields carry event names, error kinds/codes, and metric NAMES
 * only — never transcripts or captured health values.
 */
import type { VoiceLogFields } from '@/lib/voice/log'
import type { State } from './state-machine'
import type { ExtractFailureKind } from './extract-failure'

/** Which utterance a failed `tts.speak()` belonged to. */
export type TtsSpeakContext =
  | 'greeting'
  | 'opener'
  | 'question'
  | 'closer'
  | 'decline-ack'
  | 'give-up-ack'

/**
 * Build the `tts_speak_failed` fields for a `tts.speak()` rejection.
 *
 * The Sarvam adapter rejects with `{ kind, message, status? }`
 * (`SarvamTtsAdapterError`); the Web Speech adapter rejects with a plain
 * `Error` — anything without a string `kind` collapses to `'unknown'`.
 * Returns null when the rejection is an `aborted` (deliberate cancel).
 */
export function ttsFailureFields(
  context: TtsSpeakContext,
  err: unknown,
): VoiceLogFields | null {
  const e = (err ?? {}) as { kind?: unknown; status?: unknown }
  const kind = typeof e.kind === 'string' ? e.kind : 'unknown'
  if (kind === 'aborted') return null
  return {
    event: 'tts_speak_failed',
    source: 'CheckinPage',
    context,
    kind,
    ...(typeof e.status === 'number' ? { status: e.status } : {}),
  }
}

/** How a voice check-in session ended. */
export type SessionOutcome =
  | 'completed'
  | 'bailed_to_taps'
  | 'error'
  | 'abandoned'

export interface SessionOutcomeSignal {
  outcome: SessionOutcome
  /** `bailed_to_taps` only: what pushed the user out of voice. */
  reason?: ExtractFailureKind | 'user'
  /** `error` only: the error kind that ended the session. */
  errorKind?: string
}

const IDLE_KINDS: ReadonlySet<State['kind']> = new Set([
  'idle',
  'idle-greeting',
  'idle-ready',
])

/**
 * The idle family — resting states before the session starts (and after
 * a RESET). A session begins on the first transition out of this set.
 */
export function isIdleKind(kind: State['kind']): boolean {
  return IDLE_KINDS.has(kind)
}

/**
 * Terminal-outcome derivation for a state transition. Returns null when
 * the transition doesn't end the session.
 *
 * - `saved` → completed (milestone `celebrating` follows `saved`, so
 *   `saved` entry is the single completion point).
 * - `error` → error, EXCEPT `save-failed`: that renders ConfirmSummary
 *   with Try again / Keep for later, so the session is still live.
 * - `stage-2` in conversational mode → bailed_to_taps. In voice mode
 *   Stage 2 is only ever entered by leaving the voice loop (user bail
 *   or extraction-failure bail) — with one exception: DISCARD_CANCEL
 *   restoring a previous stage-2 snapshot. In taps mode (no TTS)
 *   stage-2 is the normal second step, not a bail. Matching on "any
 *   non-discarding entry" instead of an explicit prev-state list keeps
 *   this correct when new voice states are added upstream of the bail.
 */
export function deriveSessionOutcome(
  prevKind: State['kind'],
  next: State,
  opts: {
    conversational: boolean
    extractFailureKind: ExtractFailureKind | null
  },
): SessionOutcomeSignal | null {
  if (next.kind === 'saved') {
    return { outcome: 'completed' }
  }
  if (next.kind === 'error') {
    if (next.error.kind === 'save-failed') return null
    return { outcome: 'error', errorKind: next.error.kind }
  }
  if (next.kind === 'stage-2') {
    if (!opts.conversational) return null
    if (prevKind === 'discarding') return null
    if (isIdleKind(prevKind)) return null
    return {
      outcome: 'bailed_to_taps',
      reason: opts.extractFailureKind ?? 'user',
    }
  }
  return null
}
