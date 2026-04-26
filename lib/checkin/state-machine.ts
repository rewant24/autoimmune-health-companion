/**
 * Check-in state machine (Feature 01, Chunks 1.C → 1.F).
 *
 * Pure reducer + React hook. Drives the daily check-in screen:
 *   idle → requesting-permission → listening → processing
 *        → extracting (2.B)
 *        → stage-2 (2.C, only when missing.length > 0 — ADR-005 skip rule)
 *        → confirming (2.D)
 *        → saving → saved → celebrating (2.F, milestone path)
 *        | error | discarding (2.D)
 *
 * Contract with voice provider (Chunk 1.A) is types-only — we import
 * `VoiceProvider`, `Transcript`, `VoiceError` from `lib/voice/types`. The
 * provider is injected into the hook so tests can pass fakes and adapters
 * can swap without touching this file.
 *
 * Cycle 2 pre-flight extension protocol: orchestrator commits the
 * `State` and `Event` unions plus no-op transitions for new events.
 * Subagents (chunks 2.B, 2.C, 2.D, 2.F) implement transition logic for
 * their chunk's events only — no other lane touches this file. The
 * `confirming` and `saved` states keep their C1-shipped fields with
 * the new C2 fields marked optional so existing tests keep passing
 * during transition; chunk 2.D/2.F tighten them when they wire up.
 *
 * See `docs/features/01-daily-checkin.md` US-1.C.1 for acceptance.
 */

import { useEffect, useReducer, useRef } from 'react'
import type { Transcript, VoiceError, VoiceProvider } from '@/lib/voice/types'
import type {
  CheckinMetrics,
  Metric,
  MilestoneKind,
  OpenerVariantKey,
  StageEnum,
} from './types'

// ---------------- State + Event shapes ----------------

export type SaveFailedError = { kind: 'save-failed'; message?: string }

export type State =
  | { kind: 'idle' }
  | { kind: 'requesting-permission' }
  | { kind: 'listening'; partial: string }
  | { kind: 'processing'; transcript: Transcript }
  // 2.B — between PROVIDER_STOPPED and EXTRACTION_DONE while the AI
  // Gateway extracts metrics from the transcript. Distinct from
  // `processing` so the orb can render a different label if needed.
  | { kind: 'extracting'; transcript: Transcript }
  // 2.C — Stage 2 prompts the user to fill in missing metrics. `metrics`
  // accumulates user-entered values; `missing` is the remaining list;
  // `declined` is the metrics the user explicitly skipped.
  | {
      kind: 'stage-2'
      transcript: Transcript
      metrics: Partial<CheckinMetrics>
      missing: Metric[]
      declined: Metric[]
    }
  // 2.D — final review before save. The new fields (metrics/declined/stage)
  // are optional during pre-flight so the C1 reducer's existing
  // `processing → confirming` transition still type-checks; chunk 2.D
  // tightens the legacy METRICS_READY transition to populate them.
  | {
      kind: 'confirming'
      transcript: Transcript
      metrics?: CheckinMetrics
      declined?: Metric[]
      stage?: StageEnum
    }
  // 2.D — modal-overlay state when the user requests discard. `previous`
  // carries the full state to restore on DISCARD_CANCEL — we'd lose
  // metrics/missing/declined otherwise.
  | {
      kind: 'discarding'
      previous:
        | Extract<State, { kind: 'stage-2' }>
        | Extract<State, { kind: 'confirming' }>
    }
  | { kind: 'saving' }
  // 2.F — `milestone` carries the celebration kind (or null when the
  // save isn't a milestone day). Optional for the same C1-compatibility
  // reason as `confirming`; chunk 2.F tightens.
  | { kind: 'saved'; milestone?: MilestoneKind | null }
  // 2.F — milestone celebration overlay; entered from `saved` when
  // `saved.milestone !== null`.
  | { kind: 'celebrating'; milestone: MilestoneKind }
  // Voice C1 (ADR-026) — multi-turn dialog states. Pre-flight only adds
  // the union shapes + no-op transition cases so the parallel build
  // chunks see the seam. Wave 2 (orchestrator integration) implements
  // the actual transitions per the protocol in the cycle plan.
  //
  // `speaking-opener`: TTS plays the opener line before listening starts.
  // `text` is the rendered string (so the screen can mirror it
  // captioned); `variantKey` lets Wave-2 telemetry know which
  // opener-engine variant is being spoken.
  | { kind: 'speaking-opener'; text: string; variantKey: OpenerVariantKey }
  // `speaking-question`: per-metric follow-up question. Page selects the
  // next missing metric, kicks TTS, reducer parks here while playback
  // runs. `transcript` is the original freeform-turn transcript carried
  // through so `confirming` still sees it.
  | {
      kind: 'speaking-question'
      metric: Metric
      text: string
      metrics: Partial<CheckinMetrics>
      missing: Metric[]
      declined: Metric[]
      transcript: Transcript
    }
  // `listening-answer`: per-metric STT for the current question.
  | {
      kind: 'listening-answer'
      metric: Metric
      partial: string
      metrics: Partial<CheckinMetrics>
      missing: Metric[]
      declined: Metric[]
      transcript: Transcript
    }
  // `extracting-answer`: page extracts the metric value (or detects a
  // decline phrase) from `answerTranscript`. Reducer stays here until
  // ANSWER_EXTRACTED arrives.
  | {
      kind: 'extracting-answer'
      metric: Metric
      answerTranscript: Transcript
      metrics: Partial<CheckinMetrics>
      missing: Metric[]
      declined: Metric[]
      transcript: Transcript
    }
  // `speaking-closer`: TTS plays the closer line before save commits.
  // Wave 2 bridges this to `saving` on `CLOSER_PLAYED`.
  | {
      kind: 'speaking-closer'
      text: string
      metrics: CheckinMetrics
      declined: Metric[]
      stage: StageEnum
      transcript: Transcript
    }
  | { kind: 'error'; error: VoiceError | SaveFailedError }

export type Event =
  | { type: 'TAP_ORB' }
  // Voice C1 (ADR-026): conversational mode supplies an `opener` payload so
  // the reducer can route to `speaking-opener` instead of `listening`. The
  // payload-less form preserves the C1 freeform path used by tests and the
  // taps fallback, so callers who don't want the dialog don't pay for it.
  | {
      type: 'PERMISSION_GRANTED'
      opener?: { text: string; variantKey: OpenerVariantKey }
    }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'PARTIAL'; text: string }
  | { type: 'PROVIDER_STOPPED'; transcript: Transcript }
  | { type: 'VOICE_ERROR'; error: VoiceError }
  // C1 legacy event — kept so existing tests still pass. Chunk 2.B
  // re-points the production path at EXTRACTION_DONE.
  | { type: 'METRICS_READY' }
  // 2.B — page kicks extraction once it sees `processing`. Reducer
  // moves to `extracting` so the orb can render a distinct label.
  | { type: 'EXTRACTION_START' }
  // 2.B — fires when the AI Gateway returns. `missing.length === 0`
  // is the ADR-005 skip-Stage-2 signal — reducer routes to `confirming`
  // (stage='open') vs `stage-2` (stage='hybrid' or 'scripted').
  | {
      type: 'EXTRACTION_DONE'
      metrics: Partial<CheckinMetrics>
      missing: Metric[]
      stage: StageEnum
    }
  // 2.B — extraction failure path (route 429, schema parse fail, network).
  // Treated as "all 5 missing, scripted" so user falls into Stage 2 with
  // every control rendered. No data lost — transcript is still attached.
  | { type: 'EXTRACTION_FAILED' }
  // 2.C — Stage 2 user actions.
  | { type: 'METRIC_UPDATED'; metric: Metric; value: unknown }
  | { type: 'METRIC_DECLINED'; metric: Metric }
  | { type: 'STAGE_2_CONTINUE' }
  // Voice C1 (ADR-026): conversational mode supplies a `closer` payload so
  // the reducer can route to `speaking-closer` instead of straight to
  // `saving`. Payload-less form preserves the C1 path used by existing tests.
  | { type: 'CONFIRM'; closer?: { text: string } }
  // 2.D — discard flow (request → confirm/cancel).
  | { type: 'DISCARD_REQUEST' }
  | { type: 'DISCARD_CONFIRM' }
  | { type: 'DISCARD_CANCEL' }
  | { type: 'SAVE_OK' }
  | { type: 'SAVE_ERROR'; message?: string }
  // 2.F — milestone celebration trigger; dispatched after SAVE_OK when
  // the user hits a day-1/7/30/90/180/365 marker.
  | { type: 'MILESTONE_DETECTED'; milestone: MilestoneKind }
  // Voice C1 (ADR-026) — multi-turn dialog events. Pre-flight only adds
  // the union members + no-op cases; Wave 2 implements transitions.
  | { type: 'OPENER_PLAYED' }
  | { type: 'OPENER_FAILED' }
  // ASK_QUESTION carries the question text + an optional `seed`. The seed
  // is required when transitioning from `extracting` (the reducer has no
  // metrics/missing/declined to inherit from that state). When dispatched
  // from `extracting-answer` the seed is omitted and the carried payload
  // is used. See voice-cycle-1-plan §State-machine extension protocol.
  | {
      type: 'ASK_QUESTION'
      metric: Metric
      text: string
      seed?: {
        metrics: Partial<CheckinMetrics>
        missing: Metric[]
        declined: Metric[]
      }
    }
  | { type: 'QUESTION_PLAYED' }
  | { type: 'ANSWER_TRANSCRIBED'; transcript: Transcript }
  | {
      type: 'ANSWER_EXTRACTED'
      metrics: Partial<CheckinMetrics>
      declined: boolean
    }
  | { type: 'BAIL_TO_TAPS' }
  | { type: 'CLOSER_PLAYED' }
  | { type: 'RESET' }

export const initialState: State = { kind: 'idle' }

// ---------------- Reducer ----------------

/**
 * Pure reducer. Unknown transitions return the current state unchanged
 * (ignore stray events rather than crash). `RESET` is a universal escape
 * hatch from any state back to `idle`.
 */
export function reducer(state: State, event: Event): State {
  // Universal escape hatch first.
  if (event.type === 'RESET') {
    return { kind: 'idle' }
  }

  switch (state.kind) {
    case 'idle': {
      if (event.type === 'TAP_ORB') return { kind: 'requesting-permission' }
      return state
    }
    case 'requesting-permission': {
      if (event.type === 'PERMISSION_GRANTED') {
        // Voice C1: opener payload routes to speaking-opener. Without it,
        // we fall through to the C1 freeform listening path so existing
        // tests + the taps fallback still work.
        if (event.opener) {
          return {
            kind: 'speaking-opener',
            text: event.opener.text,
            variantKey: event.opener.variantKey,
          }
        }
        return { kind: 'listening', partial: '' }
      }
      if (event.type === 'PERMISSION_DENIED') {
        return { kind: 'error', error: { kind: 'permission-denied' } }
      }
      if (event.type === 'VOICE_ERROR') {
        return { kind: 'error', error: event.error }
      }
      return state
    }
    case 'listening': {
      if (event.type === 'PARTIAL') {
        return { kind: 'listening', partial: event.text }
      }
      if (event.type === 'TAP_ORB') {
        // Intent: user wants to stop. The hook fires provider.stop() and
        // dispatches PROVIDER_STOPPED with the final transcript. We hold
        // the listening state until that arrives so partials keep rendering.
        return state
      }
      if (event.type === 'PROVIDER_STOPPED') {
        return { kind: 'processing', transcript: event.transcript }
      }
      if (event.type === 'BAIL_TO_TAPS') {
        return emptyStage2()
      }
      if (event.type === 'VOICE_ERROR') {
        return { kind: 'error', error: event.error }
      }
      return state
    }
    case 'processing': {
      // Legacy C1 path — kept so existing tests still pass.
      if (event.type === 'METRICS_READY') {
        return {
          kind: 'confirming',
          transcript: state.transcript,
        }
      }
      if (event.type === 'EXTRACTION_START') {
        return { kind: 'extracting', transcript: state.transcript }
      }
      if (event.type === 'VOICE_ERROR') {
        return { kind: 'error', error: event.error }
      }
      return state
    }
    case 'extracting': {
      if (event.type === 'EXTRACTION_DONE') {
        // ADR-005 skip rule: zero missing → straight to confirming.
        if (event.missing.length === 0) {
          return {
            kind: 'confirming',
            transcript: state.transcript,
            metrics: event.metrics as CheckinMetrics,
            declined: [],
            stage: event.stage,
          }
        }
        return {
          kind: 'stage-2',
          transcript: state.transcript,
          metrics: event.metrics,
          missing: event.missing,
          declined: [],
        }
      }
      if (event.type === 'EXTRACTION_FAILED') {
        // Fall-through: treat as no metrics extracted, all 5 missing,
        // user falls into a fully scripted Stage 2.
        return {
          kind: 'stage-2',
          transcript: state.transcript,
          metrics: {},
          missing: ['pain', 'mood', 'adherenceTaken', 'flare', 'energy'],
          declined: [],
        }
      }
      // Voice C1: in conversational mode the page bypasses EXTRACTION_DONE
      // and dispatches ASK_QUESTION with the extraction result as `seed`,
      // routing the user into the per-metric voice loop.
      if (event.type === 'ASK_QUESTION' && event.seed) {
        return {
          kind: 'speaking-question',
          metric: event.metric,
          text: event.text,
          metrics: event.seed.metrics,
          missing: event.seed.missing,
          declined: event.seed.declined,
          transcript: state.transcript,
        }
      }
      if (event.type === 'BAIL_TO_TAPS') {
        return emptyStage2(state.transcript)
      }
      return state
    }
    case 'stage-2': {
      if (event.type === 'METRIC_UPDATED') {
        // Set the value, drop the metric from missing + declined (a tap
        // overrides a prior skip).
        return {
          ...state,
          metrics: { ...state.metrics, [event.metric]: event.value },
          missing: state.missing.filter((m) => m !== event.metric),
          declined: state.declined.filter((m) => m !== event.metric),
        }
      }
      if (event.type === 'METRIC_DECLINED') {
        // Skip-today: write null to the metric, mark declined, drop from
        // missing. Pattern engine reads `declined` to render distinctly.
        if (state.declined.includes(event.metric)) return state
        return {
          ...state,
          metrics: { ...state.metrics, [event.metric]: null },
          missing: state.missing.filter((m) => m !== event.metric),
          declined: [...state.declined, event.metric],
        }
      }
      if (event.type === 'STAGE_2_CONTINUE') {
        // Treat anything still in `missing` as declined-by-omission so
        // confirming gets a fully-formed `CheckinMetrics` (nulls included).
        const filledMetrics: CheckinMetrics = {
          pain: state.metrics.pain ?? null,
          mood: state.metrics.mood ?? null,
          adherenceTaken: state.metrics.adherenceTaken ?? null,
          flare: state.metrics.flare ?? null,
          energy: state.metrics.energy ?? null,
        }
        const finalDeclined = [
          ...state.declined,
          ...state.missing.filter((m) => !state.declined.includes(m)),
        ]
        const stage: StageEnum =
          state.declined.length === 5 || state.missing.length === 5
            ? 'scripted'
            : 'hybrid'
        return {
          kind: 'confirming',
          transcript: state.transcript,
          metrics: filledMetrics,
          declined: finalDeclined,
          stage,
        }
      }
      if (event.type === 'DISCARD_REQUEST') {
        return { kind: 'discarding', previous: state }
      }
      return state
    }
    case 'confirming': {
      if (event.type === 'METRIC_UPDATED' && state.metrics) {
        return {
          ...state,
          metrics: { ...state.metrics, [event.metric]: event.value },
          declined: (state.declined ?? []).filter((m) => m !== event.metric),
        }
      }
      if (event.type === 'METRIC_DECLINED' && state.metrics) {
        const declined = state.declined ?? []
        if (declined.includes(event.metric)) return state
        return {
          ...state,
          metrics: { ...state.metrics, [event.metric]: null },
          declined: [...declined, event.metric],
        }
      }
      if (event.type === 'CONFIRM') {
        // Voice C1: closer payload routes through speaking-closer → saving;
        // payload-less form preserves the C1 direct-to-saving path.
        if (event.closer && state.metrics && state.stage) {
          return {
            kind: 'speaking-closer',
            text: event.closer.text,
            metrics: state.metrics,
            declined: state.declined ?? [],
            stage: state.stage,
            transcript: state.transcript,
          }
        }
        return { kind: 'saving' }
      }
      if (event.type === 'DISCARD_REQUEST') {
        return { kind: 'discarding', previous: state }
      }
      return state
    }
    case 'discarding': {
      if (event.type === 'DISCARD_CONFIRM') {
        return { kind: 'idle' }
      }
      if (event.type === 'DISCARD_CANCEL') {
        return state.previous
      }
      return state
    }
    case 'saving': {
      if (event.type === 'SAVE_OK') return { kind: 'saved' }
      if (event.type === 'SAVE_ERROR') {
        return {
          kind: 'error',
          error: { kind: 'save-failed', message: event.message },
        }
      }
      return state
    }
    case 'saved': {
      if (event.type === 'MILESTONE_DETECTED') {
        return { kind: 'celebrating', milestone: event.milestone }
      }
      return state
    }
    case 'celebrating': {
      // 2.F owns the celebration dismiss path. Pre-flight no-op.
      return state
    }
    case 'speaking-opener': {
      if (event.type === 'OPENER_PLAYED' || event.type === 'OPENER_FAILED') {
        // Both routes drop into the freeform listening state. OPENER_FAILED
        // degrades silently — the opener text is already on screen so the
        // user can read what Saha would have said.
        return { kind: 'listening', partial: '' }
      }
      if (event.type === 'BAIL_TO_TAPS') {
        return emptyStage2()
      }
      return state
    }
    case 'speaking-question': {
      if (event.type === 'QUESTION_PLAYED') {
        return {
          kind: 'listening-answer',
          metric: state.metric,
          partial: '',
          metrics: state.metrics,
          missing: state.missing,
          declined: state.declined,
          transcript: state.transcript,
        }
      }
      if (event.type === 'BAIL_TO_TAPS') {
        return carryToStage2(state)
      }
      return state
    }
    case 'listening-answer': {
      if (event.type === 'PARTIAL') {
        return { ...state, partial: event.text }
      }
      if (event.type === 'PROVIDER_STOPPED') {
        return {
          kind: 'extracting-answer',
          metric: state.metric,
          answerTranscript: event.transcript,
          metrics: state.metrics,
          missing: state.missing,
          declined: state.declined,
          transcript: state.transcript,
        }
      }
      if (event.type === 'BAIL_TO_TAPS') {
        return carryToStage2(state)
      }
      if (event.type === 'VOICE_ERROR') {
        return { kind: 'error', error: event.error }
      }
      return state
    }
    case 'extracting-answer': {
      if (event.type === 'ANSWER_EXTRACTED') {
        // Three outcomes per protocol:
        //   1. metric extracted (event.metrics has a value for state.metric)
        //      → fold into metrics, drop from missing
        //   2. user declined (event.declined === true)
        //      → write null, drop from missing, append to declined
        //   3. neither (no extract, no decline) → leave state alone so the
        //      page can re-ask via ASK_QUESTION with re-ask copy
        const captured = event.metrics[state.metric]
        const wasDeclined = event.declined === true
        if (captured === undefined && !wasDeclined) {
          return state
        }
        const nextMetrics: Partial<CheckinMetrics> = wasDeclined
          ? { ...state.metrics, [state.metric]: null }
          : { ...state.metrics, [state.metric]: captured }
        const nextMissing = state.missing.filter((m) => m !== state.metric)
        const nextDeclined = wasDeclined
          ? state.declined.includes(state.metric)
            ? state.declined
            : [...state.declined, state.metric]
          : state.declined
        if (nextMissing.length === 0) {
          // All metrics covered — collapse to confirming. Stage is always
          // 'hybrid' because some answers came through the voice loop
          // rather than the cold extract.
          const filledMetrics: CheckinMetrics = {
            pain: nextMetrics.pain ?? null,
            mood: nextMetrics.mood ?? null,
            adherenceTaken: nextMetrics.adherenceTaken ?? null,
            flare: nextMetrics.flare ?? null,
            energy: nextMetrics.energy ?? null,
          }
          return {
            kind: 'confirming',
            transcript: state.transcript,
            metrics: filledMetrics,
            declined: nextDeclined,
            stage: 'hybrid',
          }
        }
        // More to ask — stay in extracting-answer with updated payload so
        // the page sees the new missing list and dispatches ASK_QUESTION.
        return {
          ...state,
          metrics: nextMetrics,
          missing: nextMissing,
          declined: nextDeclined,
        }
      }
      if (event.type === 'ASK_QUESTION') {
        // Page picks the next missing metric (or re-asks the current one).
        // Inherit carried payload; `seed` is ignored from this state since
        // we already have the loop's running state.
        return {
          kind: 'speaking-question',
          metric: event.metric,
          text: event.text,
          metrics: state.metrics,
          missing: state.missing,
          declined: state.declined,
          transcript: state.transcript,
        }
      }
      if (event.type === 'BAIL_TO_TAPS') {
        return carryToStage2(state)
      }
      return state
    }
    case 'speaking-closer': {
      if (event.type === 'CLOSER_PLAYED') {
        return { kind: 'saving' }
      }
      if (event.type === 'BAIL_TO_TAPS') {
        // User cancelled the closer — drop back to confirming so they can
        // edit before the (now-cancelled) save. Page is responsible for
        // calling tts.cancel() to silence playback.
        return {
          kind: 'confirming',
          transcript: state.transcript,
          metrics: state.metrics,
          declined: state.declined,
          stage: state.stage,
        }
      }
      return state
    }
    case 'error': {
      // Only RESET escapes error (handled at top of function).
      return state
    }
  }
}

// ---------------- Derived helpers ----------------

export type OrbVisualState = 'idle' | 'listening' | 'processing' | 'error'

/**
 * Map a machine state to the orb's 4-visual-state enum.
 * `requesting-permission`, `saving`, `saved`, and the transient
 * transcript-holding states all collapse to `processing` visually.
 */
export function toOrbState(state: State): OrbVisualState {
  switch (state.kind) {
    case 'idle':
      return 'idle'
    case 'listening':
    case 'listening-answer':
      return 'listening'
    case 'requesting-permission':
    case 'processing':
    case 'extracting':
    case 'stage-2':
    case 'confirming':
    case 'discarding':
    case 'saving':
    case 'saved':
    case 'celebrating':
    case 'speaking-opener':
    case 'speaking-question':
    case 'extracting-answer':
    case 'speaking-closer':
      return 'processing'
    case 'error':
      return 'error'
  }
}

// ---------------- Hook ----------------

export interface CheckinMachine {
  state: State
  dispatch: (event: Event) => void
}

/**
 * React hook wiring the reducer to a voice provider.
 *
 * - On `TAP_ORB` from `idle` → the reducer moves to `requesting-permission`.
 *   The hook then calls `provider.start()`. Resolution → PERMISSION_GRANTED;
 *   rejection shaped like a VoiceError → PERMISSION_DENIED / VOICE_ERROR.
 * - On `TAP_ORB` from `listening` → hook calls `provider.stop()`, then
 *   dispatches `PROVIDER_STOPPED` with the returned transcript.
 * - Provider `onPartial` → dispatches `PARTIAL`.
 * - Provider `onError` → dispatches `VOICE_ERROR`.
 *
 * `onSave` is called when the state enters `saving`. Success →
 * `SAVE_OK`; throw/reject → `SAVE_ERROR`.
 *
 * Cycle 1 note: callers pass a logging no-op for `onSave`. Cycle 2 wires
 * the Convex `createCheckin` mutation here.
 */
export function useCheckinMachine(
  provider: VoiceProvider,
  onSave: () => Promise<void>,
): CheckinMachine {
  const [state, dispatch] = useReducer(reducer, initialState)
  const providerRef = useRef(provider)
  const onSaveRef = useRef(onSave)
  const stateRef = useRef(state)

  useEffect(() => {
    providerRef.current = provider
  }, [provider])

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Wire provider callbacks once per provider instance.
  useEffect(() => {
    const p = providerRef.current
    p.onPartial((text) => dispatch({ type: 'PARTIAL', text }))
    p.onError((error) => dispatch({ type: 'VOICE_ERROR', error }))
  }, [])

  // R3-7: Haptic feedback lives on the Orb component (closer to the tap
  // event and present even when this hook isn't wired). Don't duplicate it
  // here or each tap vibrates twice.

  const wrappedDispatch = (event: Event): void => {
    const current = stateRef.current

    // Intent interception for TAP_ORB — fire side effects, then dispatch.
    if (event.type === 'TAP_ORB') {
      if (current.kind === 'idle') {
        dispatch({ type: 'TAP_ORB' })
        // Kick off provider.start; resolve → PERMISSION_GRANTED.
        providerRef.current
          .start()
          .then(() => dispatch({ type: 'PERMISSION_GRANTED' }))
          .catch((err: unknown) => {
            const ve = normaliseVoiceError(err)
            if (ve.kind === 'permission-denied') {
              dispatch({ type: 'PERMISSION_DENIED' })
            } else {
              dispatch({ type: 'VOICE_ERROR', error: ve })
            }
          })
        return
      }
      if (current.kind === 'listening') {
        providerRef.current
          .stop()
          .then((transcript) =>
            dispatch({ type: 'PROVIDER_STOPPED', transcript }),
          )
          .catch((err: unknown) => {
            const ve = normaliseVoiceError(err)
            dispatch({ type: 'VOICE_ERROR', error: ve })
          })
        return
      }
      // Any other state: tap is a no-op (reducer ignores it).
      dispatch({ type: 'TAP_ORB' })
      return
    }

    dispatch(event)
  }

  // Trigger onSave when we enter `saving`.
  useEffect(() => {
    if (state.kind !== 'saving') return
    let cancelled = false
    onSaveRef
      .current()
      .then(() => {
        if (!cancelled) dispatch({ type: 'SAVE_OK' })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : undefined
        dispatch({ type: 'SAVE_ERROR', message })
      })
    return () => {
      cancelled = true
    }
  }, [state.kind])

  return { state, dispatch: wrappedDispatch }
}

// ---------------- Error normalisation ----------------

/**
 * Coerce an unknown throw into a `VoiceError`. Adapters are expected to
 * throw VoiceError-shaped objects; anything else collapses to `aborted`.
 */
function normaliseVoiceError(err: unknown): VoiceError {
  if (isVoiceError(err)) return err
  const message = err instanceof Error ? err.message : undefined
  return { kind: 'aborted', message }
}

// ---------------- Voice C1 bail-out helpers ----------------

const ALL_METRICS: Metric[] = [
  'pain',
  'mood',
  'adherenceTaken',
  'flare',
  'energy',
]

/**
 * Construct the empty `stage-2` state used when the user bails out of voice
 * before any extraction has produced metrics (i.e. from `speaking-opener` or
 * `listening`). All five metrics land in `missing` so Stage 2 renders a full
 * scripted fallback. The optional `transcript` lets `extracting + BAIL` keep
 * the freeform transcript already captured.
 */
function emptyStage2(transcript?: Transcript): Extract<State, { kind: 'stage-2' }> {
  return {
    kind: 'stage-2',
    transcript: transcript ?? { text: '', durationMs: 0 },
    metrics: {},
    missing: [...ALL_METRICS],
    declined: [],
  }
}

/**
 * Construct the `stage-2` state from a voice loop's running payload. Used
 * when the user bails from `speaking-question`, `listening-answer`, or
 * `extracting-answer` — Stage 2 picks up exactly where the loop left off.
 */
function carryToStage2(
  state:
    | Extract<State, { kind: 'speaking-question' }>
    | Extract<State, { kind: 'listening-answer' }>
    | Extract<State, { kind: 'extracting-answer' }>,
): Extract<State, { kind: 'stage-2' }> {
  return {
    kind: 'stage-2',
    transcript: state.transcript,
    metrics: state.metrics,
    missing: state.missing,
    declined: state.declined,
  }
}

function isVoiceError(err: unknown): err is VoiceError {
  if (typeof err !== 'object' || err === null) return false
  const kind = (err as { kind?: unknown }).kind
  return (
    kind === 'permission-denied' ||
    kind === 'no-speech' ||
    kind === 'network' ||
    kind === 'unsupported' ||
    kind === 'aborted'
  )
}
