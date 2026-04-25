'use client'

/**
 * /check-in — daily voice check-in screen.
 *
 * Feature 01, Cycle 2 — Wave 1 + Wave 2 integration.
 *
 * Composes:
 *   - ScreenShell + Orb + ErrorSlot (C1 layout)
 *   - useCheckinMachine (state + provider wiring, extended for C2 events)
 *   - selectOpener / selectCloser  (Chunk 2.A — deterministic rules engine)
 *   - getContinuityState query     (Chunk 2.A — feeds the engines)
 *   - extractMetrics + coverage    (Chunk 2.B — LLM extract + ADR-005 split)
 *   - <Stage2>                     (Chunk 2.C — recap + missing controls)
 *   - <ConfirmSummary>             (Chunk 2.D — review card + save flow)
 *   - save-later queue             (Chunk 2.D — drained on mount, refilled on
 *                                   save-fail when user picks "Keep for later")
 *   - <SpokenOpener>               (Chunk 2.E — Web Speech TTS opener)
 *   - <Day1Tutorial>               (Chunk 2.F — Day-1 tap-to-edit ribbon
 *                                   wrapping Stage 2)
 *   - getTodayCheckin + buildAppendPayload (Chunk 2.F — same-day re-entry
 *                                   produces an append-block save with
 *                                   `appendedTo` referencing the original)
 *   - detectMilestone + <MilestoneCelebration> (Chunk 2.F — Whoop-style
 *                                   ring overlay on day-1/7/30/90/180/365)
 *
 * Flow:
 *   idle (SpokenOpener)
 *     → tap orb → requesting-permission → listening → processing
 *     → EXTRACTION_START → extracting → EXTRACTION_DONE / EXTRACTION_FAILED
 *     → coverage(metrics).missing.length === 0 ? confirming : stage-2
 *     → STAGE_2_CONTINUE → confirming
 *     → CONFIRM → saving → saved
 *     → milestone? → celebrating → /check-in/saved
 *     → no milestone → /check-in/saved
 *
 * Same-day re-entry: when `getTodayCheckin` returns a row, opener becomes
 * `re-entry-same-day` (driven by continuity.lastCheckinDaysAgo === 0) and
 * onSave builds an append payload via `buildAppendPayload`. The original
 * row is unchanged; a new row is inserted with `appendedTo = original._id`.
 *
 * Discard: ConfirmSummary owns the modal state (DiscardConfirm). When the
 * user confirms discard, `onDiscard` fires here and we RESET to idle —
 * skipping the `discarding` state, since the modal already collected the
 * confirmation. The reducer keeps the `discarding` state for completeness
 * but the page never enters it through this flow.
 *
 * Day-1 ribbon deviation: Build-F shipped `Day1Tutorial` as a wrapper that
 * renders the ribbon below children. The orchestrator wraps the whole
 * `<Stage2>` once instead of every TapInput — single ribbon below the
 * Stage 2 view. UX-equivalent for v1; per-control wrapping is a future
 * polish if needed.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import type { VoiceProvider, Transcript } from '@/lib/voice/types'
import { getVoiceProvider } from '@/lib/voice/provider'
import {
  toOrbState,
  useCheckinMachine,
  type State,
} from '@/lib/checkin/state-machine'
import { Orb } from '@/components/check-in/Orb'
import { ScreenShell } from '@/components/check-in/ScreenShell'
import { ErrorSlot } from '@/components/check-in/ErrorSlot'
import { Stage2 } from '@/components/check-in/Stage2'
import { ConfirmSummary } from '@/components/check-in/ConfirmSummary'
import { SpokenOpener } from '@/components/check-in/SpokenOpener'
import { Day1Tutorial } from '@/components/check-in/Day1Tutorial'
import { MilestoneCelebration } from '@/components/check-in/MilestoneCelebration'
import { selectOpener } from '@/lib/saha/opener-engine'
import { selectCloser } from '@/lib/saha/closer-engine'
import {
  extractMetrics,
  ExtractDailyCapError,
} from '@/lib/checkin/extract-metrics'
import { coverage } from '@/lib/checkin/coverage'
import { detectMilestone } from '@/lib/checkin/milestone'
import { buildAppendPayload } from '@/lib/checkin/same-day-reentry'
import { drain, enqueue, type SaveLaterPayload } from '@/lib/checkin/save-later'
import type { Id } from '@/convex/_generated/dataModel'
import type { CheckinRow } from '@/convex/checkIns'
import type {
  CheckinMetrics,
  ContinuityState,
  Metric,
  StageEnum,
} from '@/lib/checkin/types'

/**
 * Bridge `SaveLaterPayload` (plain-string `appendedTo`) to Convex's
 * branded `Id<"checkIns">` so the typed `createCheckin` mutation
 * accepts the payload. The string round-trips losslessly through Convex
 * — the brand is a TS-only nominal tag — so casting is safe. Wave 2
 * (same-day re-entry) will set `appendedTo`; Wave 1 never does.
 */
type ConvexCreateCheckinArgs = Omit<SaveLaterPayload, 'appendedTo'> & {
  appendedTo?: Id<'checkIns'>
}

function toConvexArgs(payload: SaveLaterPayload): ConvexCreateCheckinArgs {
  if (payload.appendedTo === undefined) {
    const { appendedTo: _omit, ...rest } = payload
    return rest
  }
  return {
    ...payload,
    appendedTo: payload.appendedTo as Id<'checkIns'>,
  }
}

export interface CheckinPageProps {
  /**
   * Test seam — inject a fake provider instead of pulling the real
   * adapter via `getVoiceProvider()`. Production callers omit this.
   */
  providerOverride?: VoiceProvider
}

const TEST_USER_KEY = 'saha.testUser.v1'

function getOrCreateTestUserId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder'
  const existing = window.localStorage.getItem(TEST_USER_KEY)
  if (existing) return existing
  const fresh =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(36).slice(2)}_${Date.now()}`
  window.localStorage.setItem(TEST_USER_KEY, fresh)
  return fresh
}

function todayIsoDate(): string {
  // YYYY-MM-DD in user's local timezone
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/**
 * Fallback used when the Convex query is still loading — opener engine
 * is pure and tolerates this shape, so the orb screen renders an opener
 * string from the very first paint instead of a spinner.
 */
const FALLBACK_CONTINUITY: ContinuityState = {
  yesterday: null,
  streakDays: 0,
  lastCheckinDaysAgo: Number.POSITIVE_INFINITY,
  upcomingEvent: null,
  flareOngoingDays: 0,
  isFirstEverCheckin: true,
}

/**
 * Convert reducer's `CheckinMetrics` (null = declined) into the shape
 * Convex `createCheckin` accepts (undefined = declined). Strips nulls
 * so the validator's `v.optional(...)` accepts the doc.
 */
function metricsToCreateArgs(
  metrics: CheckinMetrics,
): Pick<
  SaveLaterPayload,
  'pain' | 'mood' | 'adherenceTaken' | 'flare' | 'energy'
> {
  return {
    ...(metrics.pain !== null ? { pain: metrics.pain } : {}),
    ...(metrics.mood !== null ? { mood: metrics.mood } : {}),
    ...(metrics.adherenceTaken !== null
      ? { adherenceTaken: metrics.adherenceTaken }
      : {}),
    ...(metrics.flare !== null ? { flare: metrics.flare } : {}),
    ...(metrics.energy !== null ? { energy: metrics.energy } : {}),
  }
}

/**
 * State-machine `confirming` state shape we cache for use across
 * `confirming → saving → error(save-failed)` transitions, since
 * `saving` and the save-failed error don't carry the metrics/declined
 * payload but ConfirmSummary still needs to render with them.
 */
interface ConfirmingSnapshot {
  metrics: CheckinMetrics
  declined: Metric[]
  stage: StageEnum
  transcript: Transcript
}

export default function CheckinPage({
  providerOverride,
}: CheckinPageProps = {}): React.JSX.Element {
  const provider = useMemo<VoiceProvider>(
    () => providerOverride ?? getVoiceProvider(),
    [providerOverride],
  )

  const router = useRouter()
  // SSR-safe identity + date.
  //
  // `getOrCreateTestUserId` reads `localStorage`; `todayIsoDate` reads
  // the device clock. Both can return different values on the server
  // (where `localStorage` is undefined and the clock is the deploy
  // host's clock) than on the client. Calling them inside `useMemo`
  // ran them during the SSR pre-render AND during the client's first
  // render, producing divergent HTML and a React #418 hydration
  // mismatch — visible in production once Convex queries started
  // throwing on top of it. Defer both to a post-mount `useEffect`,
  // and skip the dependent Convex queries until we have the real
  // values. First render on server and on client now both see
  // `null` → identical HTML → no mismatch.
  const [userId, setUserId] = useState<string | null>(null)
  const [todayIso, setTodayIso] = useState<string | null>(null)
  useEffect(() => {
    setUserId(getOrCreateTestUserId())
    setTodayIso(todayIsoDate())
  }, [])

  const continuityQuery = useQuery(
    api.continuity.getContinuityState,
    userId !== null && todayIso !== null ? { userId, todayIso } : 'skip',
  )
  // FALLBACK is for first-paint only (orb screen renders an opener
  // string immediately). Save-time effects MUST gate on
  // `continuityResolved` — the fallback's `isFirstEverCheckin: true`
  // would otherwise trigger a Day-1 milestone for every save while the
  // query is still in flight (or while it's skipped pre-mount).
  const continuityResolved = continuityQuery !== undefined
  const continuityState: ContinuityState = continuityQuery ?? FALLBACK_CONTINUITY

  // Same-day re-entry detection (chunk 2.F). When non-null, an open
  // check-in already exists for today — opener variant becomes
  // `re-entry-same-day` (driven by continuity.lastCheckinDaysAgo === 0)
  // and `onSave` builds an `appendedTo` payload via `buildAppendPayload`
  // instead of a fresh row. We track the resolved/loading distinction
  // explicitly: a save before the query resolves would race into a
  // fresh-row write that the server would then reject as
  // `checkin.duplicate`. Skipped until `userId`/`todayIso` are set
  // post-mount, same as the continuity query above.
  const todayCheckinQuery = useQuery(
    api.checkIns.getTodayCheckin,
    userId !== null && todayIso !== null ? { userId, date: todayIso } : 'skip',
  )
  const todayCheckinResolved = todayCheckinQuery !== undefined
  const existingTodayRow: CheckinRow | null = todayCheckinQuery ?? null

  // Day-1 mode: `Stage2` shows all 5 controls + we wrap it in
  // `<Day1Tutorial>` to render the tap-to-edit ribbon below it.
  // Gated on `continuityResolved` so the FALLBACK's true value doesn't
  // briefly force Day-1 mode for repeat users mid-load.
  const isDay1 = continuityResolved && continuityState.isFirstEverCheckin

  // `prefers-reduced-motion` snapshot — deferred to post-mount for the
  // same reason as `userId`/`todayIso` above. SSR + first client render
  // see `false`; useEffect upgrades to the user's actual setting on the
  // second render. Only consumed by `<MilestoneCelebration>` (post-save
  // overlay), so the second-render swap is invisible to the initial
  // orb screen.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    setPrefersReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
  }, [])

  // Recompute opener + closer whenever continuity changes. Pure functions —
  // safe under the React 19 strict-mode double-invoke.
  const openerSelection = useMemo(
    () => selectOpener(continuityState),
    [continuityState],
  )
  const closerSelection = useMemo(
    () => selectCloser(continuityState),
    [continuityState],
  )
  // Post-save closer — reflects state AFTER this save. Only differs
  // from `closerSelection` when the +1 lands on a milestone threshold
  // (streak in {7,30,90,180,365}). Used by the milestone overlay and
  // the /check-in/saved redirect so a day-7 save shows "Seven days.
  // That's real." instead of the pre-save neutral default.
  const postSaveCloser = useMemo(
    () =>
      selectCloser({
        ...continuityState,
        streakDays: continuityState.streakDays + 1,
        // First-ever check-in is no longer "first-ever" once it saves.
        isFirstEverCheckin: false,
      }),
    [continuityState],
  )

  const createCheckin = useMutation(api.checkIns.createCheckin)

  // Cache the confirming snapshot so the page can keep rendering
  // ConfirmSummary during `saving` and on `error(save-failed)`.
  const confirmingRef = useRef<ConfirmingSnapshot | null>(null)
  // Cache the last save payload so "Keep this for later" can re-enqueue it.
  const lastPayloadRef = useRef<SaveLaterPayload | null>(null)
  // Token for the in-flight LLM extraction call. Incremented when a new
  // `processing` entry kicks extraction; the async resolver checks the
  // token against the latest before dispatching, so a superseded run is
  // ignored. This replaces the older `let cancelled = false` pattern,
  // which was set to `true` by the effect's own cleanup as soon as
  // `EXTRACTION_START` flipped state from `processing → extracting`,
  // suppressing the eventual `EXTRACTION_DONE` / `EXTRACTION_FAILED`
  // dispatch and stranding the orb on the thinking spinner.
  const extractionRunIdRef = useRef(0)

  const onSave = async (): Promise<void> => {
    const snapshot = confirmingRef.current
    if (!snapshot) {
      throw new Error('No confirming snapshot — cannot save.')
    }
    // Block until `getTodayCheckin` resolves — without this gate, a save
    // fired during the loading window writes a fresh row that the server
    // then rejects with `checkin.duplicate` because today's row already
    // exists. The state machine surfaces this as a save-failure, which
    // is exactly the wrong UX for a same-day re-entry.
    if (!todayCheckinResolved) {
      throw new Error('Today-row query still loading — retry pending.')
    }
    // `userId` and `todayIso` are populated in the post-mount effect.
    // A user can only reach `onSave` after tapping the orb, listening,
    // and confirming — all of which require a mounted page — so these
    // are guaranteed non-null in practice. The check is for TS and
    // belt-and-braces against a future code path that calls onSave
    // earlier.
    if (userId === null || todayIso === null) {
      throw new Error('Page not yet mounted — userId/todayIso missing.')
    }
    const clientRequestId = newRequestId()
    const durationMs = snapshot.transcript.durationMs ?? 0

    let payload: SaveLaterPayload
    if (existingTodayRow !== null) {
      // Same-day re-entry — append a new block referencing the original.
      const appendArgs = buildAppendPayload(
        existingTodayRow,
        snapshot.metrics,
        snapshot.transcript.text,
        snapshot.declined,
        {
          clientRequestId,
          durationMs,
          providerUsed: 'web-speech',
          stage: snapshot.stage,
        },
      )
      // `CreateCheckinArgs` is structurally compatible with
      // `SaveLaterPayload`; both use `string` for `appendedTo`.
      payload = appendArgs as SaveLaterPayload
    } else {
      payload = {
        userId,
        date: todayIso,
        ...metricsToCreateArgs(snapshot.metrics),
        declined: snapshot.declined,
        transcript: snapshot.transcript.text,
        stage: snapshot.stage,
        durationMs,
        providerUsed: 'web-speech',
        clientRequestId,
      }
    }
    lastPayloadRef.current = payload
    await createCheckin(toConvexArgs(payload))
  }

  const { state, dispatch } = useCheckinMachine(provider, onSave)

  // 1. Drain save-later queue once on mount. Retries reuse the original
  //    `clientRequestId` so any item the server already saw is a no-op.
  useEffect(() => {
    const queued = drain()
    if (queued.length === 0) return
    queued.forEach((payload) => {
      createCheckin(toConvexArgs(payload)).catch(() => enqueue(payload))
    })
  }, [createCheckin])

  // 2. Cache confirming snapshot so we can render ConfirmSummary across
  //    saving / error transitions.
  useEffect(() => {
    if (state.kind === 'confirming' && state.metrics) {
      confirmingRef.current = {
        metrics: state.metrics,
        declined: state.declined ?? [],
        stage: state.stage ?? 'open',
        transcript: state.transcript,
      }
    }
    if (state.kind === 'idle') {
      confirmingRef.current = null
      lastPayloadRef.current = null
    }
  }, [state])

  // 3. Kick extraction when the machine enters `processing`. ADR-005:
  //    coverage().missing.length === 0 → ConfirmSummary; else → Stage 2.
  //    Gated on `userId`/`todayIso` being populated (post-mount); the
  //    state machine can't reach `processing` without orb interaction,
  //    which requires a mounted page, so this is belt-and-braces.
  useEffect(() => {
    if (state.kind !== 'processing') return
    if (userId === null || todayIso === null) return
    const transcriptText = state.transcript.text
    // Increment-and-capture: the resolver checks `runId` against the
    // current ref before dispatching, so any *newer* extraction (or a
    // RESET to idle that bumps the counter) supersedes this run. We
    // deliberately do NOT cancel via cleanup, because dispatching
    // EXTRACTION_START flips state→extracting which re-runs this very
    // effect and used to clobber the in-flight call.
    extractionRunIdRef.current += 1
    const runId = extractionRunIdRef.current
    dispatch({ type: 'EXTRACTION_START' })
    void (async () => {
      try {
        const metrics = await extractMetrics({
          transcript: transcriptText,
          userId,
          date: todayIso,
        })
        if (runId !== extractionRunIdRef.current) return
        const cov = coverage(metrics)
        const stage: StageEnum =
          cov.missing.length === 0
            ? 'open'
            : cov.missing.length === 5
              ? 'scripted'
              : 'hybrid'
        dispatch({
          type: 'EXTRACTION_DONE',
          metrics,
          missing: cov.missing,
          stage,
        })
      } catch (err) {
        if (runId !== extractionRunIdRef.current) return
        // ExtractDailyCapError + ExtractFailedError both fall through to
        // a fully-scripted Stage 2 — user can still complete the check-in.
        if (err instanceof ExtractDailyCapError) {
          // No-op marker; future telemetry hook can land here.
        }
        dispatch({ type: 'EXTRACTION_FAILED' })
      }
    })()
  }, [state, dispatch, userId, todayIso])

  // 4. On save success: detect milestone first (chunk 2.F). When the
  //    save completes a streak day worth celebrating (or it was the
  //    user's first-ever check-in), dispatch `MILESTONE_DETECTED` so the
  //    state machine moves to `celebrating` and the page renders the
  //    Whoop-style ring overlay. Otherwise, route straight to /saved.
  //
  //    Gated on `continuityResolved` — the FALLBACK has
  //    `isFirstEverCheckin: true`, which would otherwise fire a Day-1
  //    celebration on every save during the query's loading window.
  useEffect(() => {
    if (state.kind !== 'saved') return
    if (!continuityResolved) return
    const milestone = detectMilestone(
      continuityState.streakDays + 1,
      continuityState.isFirstEverCheckin,
    )
    if (milestone !== null) {
      dispatch({ type: 'MILESTONE_DETECTED', milestone })
      return
    }
    const url = `/check-in/saved?closer=${encodeURIComponent(postSaveCloser.text)}`
    router.push(url)
  }, [
    state.kind,
    router,
    postSaveCloser.text,
    continuityResolved,
    continuityState.streakDays,
    continuityState.isFirstEverCheckin,
    dispatch,
  ])

  // ---- Render ----

  // Save-failed branch: re-render ConfirmSummary with `saveError` so the
  // user gets the "Try again" + "Keep this for later" affordances.
  if (
    state.kind === 'error' &&
    state.error.kind === 'save-failed' &&
    confirmingRef.current
  ) {
    const snapshot = confirmingRef.current
    return (
      <ScreenShell>
        <ConfirmSummary
          metrics={snapshot.metrics}
          declined={snapshot.declined}
          transcript={snapshot.transcript}
          closerText={closerSelection.text}
          onMetricUpdate={(metric, value) =>
            dispatch({ type: 'METRIC_UPDATED', metric, value })
          }
          onMetricDeclined={(metric) =>
            dispatch({ type: 'METRIC_DECLINED', metric })
          }
          onSave={() => dispatch({ type: 'CONFIRM' })}
          onRetry={() => dispatch({ type: 'CONFIRM' })}
          onDiscard={() => dispatch({ type: 'RESET' })}
          onSaveLater={() => {
            const payload = lastPayloadRef.current
            if (payload) enqueue(payload)
            router.push(
              `/check-in/saved?queued=true&closer=${encodeURIComponent(closerSelection.text)}`,
            )
          }}
          isSaving={false}
          saveError={state.error.message ?? 'save-failed'}
        />
      </ScreenShell>
    )
  }

  if (state.kind === 'error') {
    return (
      <ScreenShell>
        <ErrorSlot
          kind={state.error.kind}
          message={'message' in state.error ? state.error.message : undefined}
          onRetry={() => dispatch({ type: 'RESET' })}
        />
      </ScreenShell>
    )
  }

  // Milestone celebration overlay (chunk 2.F). User taps "Keep going" →
  // we route to /check-in/saved like the non-milestone path. Closer text
  // surfaces inside the overlay as the heading.
  if (state.kind === 'celebrating') {
    return (
      <ScreenShell>
        <MilestoneCelebration
          kind={state.milestone}
          closerText={postSaveCloser.text}
          prefersReducedMotion={prefersReducedMotion}
          onContinue={() => {
            const url = `/check-in/saved?closer=${encodeURIComponent(postSaveCloser.text)}`
            router.push(url)
          }}
        />
      </ScreenShell>
    )
  }

  if (state.kind === 'stage-2') {
    return (
      <ScreenShell>
        <Day1Tutorial forceTooltip={isDay1}>
          <Stage2
            transcript={state.transcript}
            metrics={state.metrics}
            missing={state.missing}
            declined={state.declined}
            forceAllControls={isDay1}
            onMetricUpdate={(metric, value) =>
              dispatch({ type: 'METRIC_UPDATED', metric, value })
            }
            onMetricDeclined={(metric) =>
              dispatch({ type: 'METRIC_DECLINED', metric })
            }
            onContinue={() => dispatch({ type: 'STAGE_2_CONTINUE' })}
          />
        </Day1Tutorial>
      </ScreenShell>
    )
  }

  // Render ConfirmSummary for both `confirming` AND `saving` so the
  // user sees the "Saving…" state. `saved` is handled by the router
  // push above; this branch is briefly visible during the transition.
  if (
    (state.kind === 'confirming' || state.kind === 'saving') &&
    confirmingRef.current
  ) {
    const snapshot = confirmingRef.current
    return (
      <ScreenShell>
        <ConfirmSummary
          metrics={snapshot.metrics}
          declined={snapshot.declined}
          transcript={snapshot.transcript}
          closerText={closerSelection.text}
          onMetricUpdate={(metric, value) =>
            dispatch({ type: 'METRIC_UPDATED', metric, value })
          }
          onMetricDeclined={(metric) =>
            dispatch({ type: 'METRIC_DECLINED', metric })
          }
          onSave={() => dispatch({ type: 'CONFIRM' })}
          onDiscard={() => dispatch({ type: 'RESET' })}
          onSaveLater={() => {
            const payload = lastPayloadRef.current
            if (payload) enqueue(payload)
            router.push(
              `/check-in/saved?queued=true&closer=${encodeURIComponent(closerSelection.text)}`,
            )
          }}
          isSaving={state.kind === 'saving'}
          saveError={null}
        />
      </ScreenShell>
    )
  }

  // idle / requesting-permission / listening / processing / extracting
  return (
    <ScreenShell>
      {state.kind === 'idle' ? (
        <header className="flex flex-col gap-3">
          <SpokenOpener
            text={openerSelection.text}
            variantKey={openerSelection.key}
          />
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Tap the orb and tell me in your own words.
          </p>
        </header>
      ) : null}

      <Orb
        orbState={toOrbState(state)}
        onTap={() => dispatch({ type: 'TAP_ORB' })}
        label={orbLabelFor(state)}
      />

      <p
        aria-live="polite"
        className="min-h-6 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {transientCopyFor(state)}
      </p>
    </ScreenShell>
  )
}

/** Short text rendered inside the orb. */
function orbLabelFor(state: State): string | undefined {
  if (state.kind === 'listening') return 'Listening'
  if (state.kind === 'processing' || state.kind === 'extracting') {
    return 'Thinking...'
  }
  return undefined
}

/** Transient status copy rendered below the orb. */
function transientCopyFor(state: State): string {
  switch (state.kind) {
    case 'listening':
      return state.partial || 'I\u2019m listening.'
    case 'processing':
    case 'extracting':
      return 'Thinking...'
    case 'requesting-permission':
      return 'Asking for the mic...'
    case 'saving':
      return 'Saving...'
    default:
      return ''
  }
}
