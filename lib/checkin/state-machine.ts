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
  // 2.D — modal-overlay state when the user requests discard.
  | { kind: 'discarding'; from: 'confirming' | 'stage-2' }
  | { kind: 'saving' }
  // 2.F — `milestone` carries the celebration kind (or null when the
  // save isn't a milestone day). Optional for the same C1-compatibility
  // reason as `confirming`; chunk 2.F tightens.
  | { kind: 'saved'; milestone?: MilestoneKind | null }
  // 2.F — milestone celebration overlay; entered from `saved` when
  // `saved.milestone !== null`.
  | { kind: 'celebrating'; milestone: MilestoneKind }
  | { kind: 'error'; error: VoiceError | SaveFailedError }

export type Event =
  | { type: 'TAP_ORB' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'PARTIAL'; text: string }
  | { type: 'PROVIDER_STOPPED'; transcript: Transcript }
  | { type: 'VOICE_ERROR'; error: VoiceError }
  // C1 legacy event — kept so existing tests still pass. Chunk 2.B
  // re-points the production path at EXTRACTION_DONE.
  | { type: 'METRICS_READY' }
  // 2.B — fires when the AI Gateway returns. `missing.length === 0`
  // is the ADR-005 skip-Stage-2 signal (chunk 2.B owns the routing).
  | {
      type: 'EXTRACTION_DONE'
      metrics: Partial<CheckinMetrics>
      missing: Metric[]
    }
  // 2.C — Stage 2 user actions.
  | { type: 'METRIC_UPDATED'; metric: Metric; value: unknown }
  | { type: 'METRIC_DECLINED'; metric: Metric }
  | { type: 'STAGE_2_CONTINUE' }
  | { type: 'CONFIRM' }
  // 2.D — discard flow (request → confirm/cancel).
  | { type: 'DISCARD_REQUEST' }
  | { type: 'DISCARD_CONFIRM' }
  | { type: 'DISCARD_CANCEL' }
  | { type: 'SAVE_OK' }
  | { type: 'SAVE_ERROR'; message?: string }
  // 2.F — milestone celebration trigger; dispatched after SAVE_OK when
  // the user hits a day-1/7/30/90/180/365 marker.
  | { type: 'MILESTONE_DETECTED'; milestone: MilestoneKind }
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
      if (event.type === 'VOICE_ERROR') {
        return { kind: 'error', error: event.error }
      }
      return state
    }
    case 'processing': {
      if (event.type === 'METRICS_READY') {
        return { kind: 'confirming', transcript: state.transcript }
      }
      if (event.type === 'VOICE_ERROR') {
        return { kind: 'error', error: event.error }
      }
      return state
    }
    case 'extracting': {
      // 2.B owns transitions out of `extracting` (EXTRACTION_DONE → either
      // `stage-2` when missing.length > 0, or `confirming` per ADR-005 skip
      // rule). Pre-flight commits the state; lane 2.B implements the routing.
      return state
    }
    case 'stage-2': {
      // 2.C owns transitions: METRIC_UPDATED, METRIC_DECLINED, and
      // STAGE_2_CONTINUE (→ confirming). DISCARD_REQUEST → discarding.
      // Pre-flight commits the state; lane 2.C implements the logic.
      return state
    }
    case 'confirming': {
      if (event.type === 'CONFIRM') return { kind: 'saving' }
      // 2.D owns DISCARD_REQUEST → discarding. Pre-flight no-op.
      return state
    }
    case 'discarding': {
      // 2.D owns DISCARD_CONFIRM (→ idle via RESET semantics) and
      // DISCARD_CANCEL (→ back to state.from). Pre-flight no-op.
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
      // 2.F owns MILESTONE_DETECTED → celebrating. Pre-flight no-op.
      return state
    }
    case 'celebrating': {
      // 2.F owns the celebration dismiss path. Pre-flight no-op.
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
