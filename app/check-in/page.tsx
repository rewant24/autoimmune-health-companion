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
import type { TtsProvider, VoiceProvider, Transcript } from '@/lib/voice/types'
import { getTtsProvider, getVoiceProvider } from '@/lib/voice/provider'
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
import { SwitchToTapsButton } from '@/components/check-in/SwitchToTapsButton'
import { StopButton } from '@/components/check-in/StopButton'
import { selectOpener } from '@/lib/saha/opener-engine'
import { selectCloser } from '@/lib/saha/closer-engine'
import { readProfile } from '@/lib/profile/storage'
import {
  selectFollowUpQuestion,
  selectDeclineAcknowledgement,
} from '@/lib/saha/follow-up-engine'
import { detectDecline } from '@/lib/saha/decline-detector'
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
  /**
   * Test seam — inject a fake TTS provider instead of pulling the real
   * adapter via `getTtsProvider()`. Production callers omit this.
   */
  ttsProviderOverride?: TtsProvider
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
  ttsProviderOverride,
}: CheckinPageProps = {}): React.JSX.Element {
  const provider = useMemo<VoiceProvider>(
    () => providerOverride ?? getVoiceProvider(),
    [providerOverride],
  )
  const tts = useMemo<TtsProvider>(
    () => ttsProviderOverride ?? getTtsProvider(),
    [ttsProviderOverride],
  )
  // Snapshot once per mount — both adapters report stable availability
  // (Web Speech reads `globalThis.speechSynthesis`; Sarvam returns true).
  // Voice mode = TTS available. When false the page renders the C1
  // freeform-then-Stage-2 flow without any opener / question / closer
  // playback so jsdom + browsers without speechSynthesis still work.
  const ttsAvailable = useMemo(() => tts.isAvailable(), [tts])

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
  // Profile-name read is deferred to post-mount for the same reason as
  // userId/todayIso above — `readProfile` touches localStorage and would
  // diverge between SSR and the client's first render. SSR + first paint
  // see `null` (no name → name-less opener); the post-mount swap to the
  // real value is a single re-render.
  const [profileName, setProfileName] = useState<string | null>(null)
  useEffect(() => {
    setUserId(getOrCreateTestUserId())
    setTodayIso(todayIsoDate())
    setProfileName(readProfile()?.name ?? null)
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

  // Recompute opener + closer whenever continuity (or the profile name)
  // changes. Pure functions — safe under the React 19 strict-mode
  // double-invoke.
  const openerSelection = useMemo(
    () => selectOpener(continuityState, profileName),
    [continuityState, profileName],
  )
  const closerSelection = useMemo(
    () => selectCloser(continuityState, profileName),
    [continuityState, profileName],
  )
  // Post-save closer — reflects state AFTER this save. Only differs
  // from `closerSelection` when the +1 lands on a milestone threshold
  // (streak in {7,30,90,180,365}). Used by the milestone overlay and
  // the /check-in/saved redirect so a day-7 save shows "Seven days.
  // That's real." instead of the pre-save neutral default.
  const postSaveCloser = useMemo(
    () =>
      selectCloser(
        {
          ...continuityState,
          streakDays: continuityState.streakDays + 1,
          // First-ever check-in is no longer "first-ever" once it saves.
          isFirstEverCheckin: false,
        },
        profileName,
      ),
    [continuityState, profileName],
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
  // Token for the in-flight per-metric answer extraction. Same purpose
  // as `extractionRunIdRef` — keeps a superseded answer turn from
  // dispatching ANSWER_EXTRACTED into a state that has moved on.
  const answerExtractionRunIdRef = useRef(0)
  // Voice C1 re-ask counter — bumped each time an answer turn produces
  // neither a value nor a decline. After two attempts the page treats
  // the metric as declined and advances the loop. Keyed per metric so
  // the counter resets when the next missing metric is asked.
  const reaskCountRef = useRef<Partial<Record<Metric, number>>>({})

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

  // Voice-mode opener selector — gated on `ttsAvailable` so the C1
  // freeform path keeps working without TTS. The hook calls this when
  // `start()` resolves; an `undefined` return makes it dispatch a
  // payload-less PERMISSION_GRANTED, preserving the C1 → listening
  // transition the existing tests rely on.
  //
  // NOTE: same-day re-entry deliberately keeps voice mode active for the
  // opener turn even though the page short-circuits the multi-turn loop
  // — the `re-entry-same-day` opener variant carries the right "Hey, you
  // already saved one — anything to add?" framing.
  const openerSelectionRef = useRef(openerSelection)
  useEffect(() => {
    openerSelectionRef.current = openerSelection
  }, [openerSelection])

  const getOpenerForGrant = useMemo(
    () => () => {
      if (!ttsAvailable) return undefined
      const sel = openerSelectionRef.current
      return { text: sel.text, variantKey: sel.key }
    },
    [ttsAvailable],
  )

  const { state, dispatch } = useCheckinMachine(provider, onSave, {
    getOpener: getOpenerForGrant,
  })

  // Voice C1 fix-pass — cold-mount greeting trigger.
  // Dispatch START_GREETING exactly once per page lifetime when:
  //   - state is `idle` (the cold mount entry point)
  //   - TTS is available (otherwise the greeting won't be heard and we
  //     leave the user in `idle` so SpokenOpener still renders the text)
  //   - openerSelection has resolved (always non-empty in practice; the
  //     guard avoids race conditions on the very first render where
  //     continuityState may still be the FALLBACK)
  // The flag is a ref so the effect doesn't re-fire if the user RESETs
  // back to idle later — once they've heard the greeting in this session
  // they don't need to hear it again.
  const coldGreetingDispatchedRef = useRef(false)
  useEffect(() => {
    if (coldGreetingDispatchedRef.current) return
    if (state.kind !== 'idle') return
    if (!ttsAvailable) return
    if (!openerSelection.text) return
    coldGreetingDispatchedRef.current = true
    dispatch({
      type: 'START_GREETING',
      text: openerSelection.text,
      variantKey: openerSelection.key,
    })
  }, [state.kind, ttsAvailable, openerSelection, dispatch])

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
  //
  //    Snapshot the ref synchronously DURING render when we're in
  //    `confirming` — a useEffect-only mirror runs after commit, so the
  //    first render of `confirming` would otherwise see `ref.current ===
  //    null`, fail the conditional render guard below, and fall through
  //    to the bottom orb branch (with no header, since header is gated
  //    on `idle`). The user sees just a teal orb — exactly the "green
  //    circle" symptom reported. Writing a ref during render is safe
  //    when it's idempotent (same state → same ref), which it is here.
  if (state.kind === 'confirming' && state.metrics) {
    confirmingRef.current = {
      metrics: state.metrics,
      declined: state.declined ?? [],
      stage: state.stage ?? 'open',
      transcript: state.transcript,
    }
  }
  // Effect mirror handles the `idle` → clear path. Splitting out keeps
  // the render-time write narrow (only cache, never clear).
  useEffect(() => {
    if (state.kind === 'idle') {
      confirmingRef.current = null
      lastPayloadRef.current = null
    }
  }, [state.kind])

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
    // Reset per-turn re-ask counter — a fresh extraction starts a new
    // voice-loop attempt for each metric.
    reaskCountRef.current = {}
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
        // Same-day re-entry quick path: if today's row already exists
        // and the freeform extraction yielded nothing new, jump straight
        // to confirming so the user can edit the prior values without
        // sitting through the follow-up loop they already completed.
        const everyMetricEmpty =
          metrics.pain == null &&
          metrics.mood == null &&
          metrics.adherenceTaken == null &&
          metrics.flare == null &&
          metrics.energy == null
        if (existingTodayRow !== null && everyMetricEmpty) {
          // Pre-fill ConfirmSummary with the prior row's values so the
          // user sees what they saved earlier and can edit, instead of
          // an "all skipped" review card.
          const prior: CheckinMetrics = {
            pain: existingTodayRow.pain ?? null,
            mood: existingTodayRow.mood ?? null,
            adherenceTaken: existingTodayRow.adherenceTaken ?? null,
            flare: existingTodayRow.flare ?? null,
            energy: existingTodayRow.energy ?? null,
          }
          dispatch({
            type: 'EXTRACTION_DONE',
            metrics: prior,
            missing: [],
            stage: 'open',
          })
          return
        }
        // Voice mode + still-missing metrics: dispatch ASK_QUESTION with
        // seed so the reducer routes extracting → speaking-question
        // (skips Stage 2 entirely until the user bails).
        if (ttsAvailable && cov.missing.length > 0) {
          const next = cov.missing[0]
          if (next === undefined) return
          const q = selectFollowUpQuestion(next, 1, continuityState)
          dispatch({
            type: 'ASK_QUESTION',
            metric: next,
            text: q.text,
            seed: { metrics, missing: cov.missing, declined: [] },
          })
          return
        }
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
  }, [
    state,
    dispatch,
    userId,
    todayIso,
    ttsAvailable,
    continuityState,
    existingTodayRow,
  ])

  // 3a. Speaking-opener TTS playback. On speaking-opener entry, kick
  //     `tts.speak(text)` and dispatch OPENER_PLAYED on resolve;
  //     OPENER_FAILED on reject so the reducer still drops into
  //     listening (failure degrades silently — opener text is on screen).
  useEffect(() => {
    if (state.kind !== 'speaking-opener') return
    let cancelled = false
    const text = state.text
    void tts.speak(text).then(
      () => {
        if (!cancelled) dispatch({ type: 'OPENER_PLAYED' })
      },
      () => {
        if (!cancelled) dispatch({ type: 'OPENER_FAILED' })
      },
    )
    return () => {
      cancelled = true
      tts.cancel()
    }
  }, [state.kind, state.kind === 'speaking-opener' ? state.text : '', tts, dispatch])

  // 3a-greeting. Cold-mount greeting playback (Voice C1 fix-pass). Mirrors
  //     3a but for the new `idle-greeting` state — fires on entry, dispatches
  //     GREETING_PLAYED on resolve / GREETING_FAILED on reject. Both routes
  //     land in `idle-ready` per the reducer; the user then taps the orb
  //     to start listening.
  useEffect(() => {
    if (state.kind !== 'idle-greeting') return
    let cancelled = false
    const text = state.text
    void tts.speak(text).then(
      () => {
        if (!cancelled) dispatch({ type: 'GREETING_PLAYED' })
      },
      () => {
        if (!cancelled) dispatch({ type: 'GREETING_FAILED' })
      },
    )
    return () => {
      cancelled = true
      tts.cancel()
    }
  }, [state.kind, state.kind === 'idle-greeting' ? state.text : '', tts, dispatch])

  // 3b. Speaking-question TTS playback for each follow-up turn.
  useEffect(() => {
    if (state.kind !== 'speaking-question') return
    let cancelled = false
    const text = state.text
    void tts.speak(text).then(
      () => {
        if (!cancelled) dispatch({ type: 'QUESTION_PLAYED' })
      },
      () => {
        // TTS failure on a follow-up shouldn't trap the loop — treat as
        // played so the user can still answer. The question text is also
        // captioned in the UI so they have it visually either way.
        if (!cancelled) dispatch({ type: 'QUESTION_PLAYED' })
      },
    )
    return () => {
      cancelled = true
      tts.cancel()
    }
  }, [state.kind, state.kind === 'speaking-question' ? state.text : '', tts, dispatch])

  // 3c. Speaking-closer TTS — kicks on `confirming → speaking-closer`
  //     transition (driven by the page passing a closer payload to
  //     CONFIRM). On resolve dispatches CLOSER_PLAYED, which the reducer
  //     routes to `saving`.
  useEffect(() => {
    if (state.kind !== 'speaking-closer') return
    let cancelled = false
    const text = state.text
    void tts.speak(text).then(
      () => {
        if (!cancelled) dispatch({ type: 'CLOSER_PLAYED' })
      },
      () => {
        // Closer TTS failure shouldn't block save — fall through to
        // saving so the data persists either way.
        if (!cancelled) dispatch({ type: 'CLOSER_PLAYED' })
      },
    )
    return () => {
      cancelled = true
      tts.cancel()
    }
  }, [state.kind, state.kind === 'speaking-closer' ? state.text : '', tts, dispatch])

  // 3d. Extracting-answer — extract the per-metric value from the user's
  //     answer transcript and dispatch ANSWER_EXTRACTED. Decline detector
  //     piggybacks: if the transcript matches a decline phrase, mark the
  //     metric as declined regardless of what extractMetrics returned.
  //     Re-ask: when neither extracted nor declined, bump the per-metric
  //     counter; first miss → re-ask with attempt-2 copy; second miss →
  //     give up + treat as declined to keep the loop forward-only.
  useEffect(() => {
    if (state.kind !== 'extracting-answer') return
    if (userId === null || todayIso === null) return
    answerExtractionRunIdRef.current += 1
    const runId = answerExtractionRunIdRef.current
    const metric = state.metric
    const answerText = state.answerTranscript.text
    void (async () => {
      let extracted: Partial<CheckinMetrics> = {}
      try {
        extracted = await extractMetrics({
          transcript: answerText,
          userId,
          date: todayIso,
        })
      } catch {
        // Treat extract failure as no value — falls through to re-ask /
        // decline path below. No state change to error here; the user is
        // mid-loop and we'd rather degrade gracefully than throw them
        // out of voice mode.
      }
      if (runId !== answerExtractionRunIdRef.current) return
      const captured = extracted[metric]
      const isDecline =
        captured == null && detectDecline(answerText)
      if (isDecline) {
        // Acknowledge the decline aloud (best-effort; ignore failures).
        const ack = selectDeclineAcknowledgement(metric)
        void tts.speak(ack.text).catch(() => {})
        dispatch({
          type: 'ANSWER_EXTRACTED',
          metrics: {},
          declined: true,
        })
        // After ANSWER_EXTRACTED, the page's answer-loop effect (below)
        // picks the next missing metric and dispatches ASK_QUESTION.
        return
      }
      if (captured !== undefined) {
        dispatch({
          type: 'ANSWER_EXTRACTED',
          metrics: { [metric]: captured } as Partial<CheckinMetrics>,
          declined: false,
        })
        return
      }
      // Re-ask path: bump counter; if we've already re-asked once, give
      // up and treat as declined so the loop progresses.
      const prev = reaskCountRef.current[metric] ?? 0
      reaskCountRef.current[metric] = prev + 1
      if (prev >= 1) {
        dispatch({
          type: 'ANSWER_EXTRACTED',
          metrics: {},
          declined: true,
        })
        return
      }
      // First re-ask: dispatch ASK_QUESTION with attempt-2 copy directly.
      // The reducer routes extracting-answer → speaking-question.
      const reask = selectFollowUpQuestion(metric, 2, continuityState)
      dispatch({
        type: 'ASK_QUESTION',
        metric,
        text: reask.text,
      })
    })()
  }, [
    state,
    userId,
    todayIso,
    tts,
    dispatch,
    continuityState,
  ])

  // 3e. Answer loop driver — when ANSWER_EXTRACTED has folded a metric
  //     and the reducer has stayed in extracting-answer with new
  //     `missing`, pick the next metric and dispatch ASK_QUESTION.
  useEffect(() => {
    if (state.kind !== 'extracting-answer') return
    // After ANSWER_EXTRACTED, the reducer either moves to confirming
    // (no missing left) or stays in extracting-answer with the next
    // missing metric to ask. We listen to the carried `missing` and the
    // current metric — when current metric is no longer first in
    // missing, advance the loop.
    const next = state.missing[0]
    if (next === undefined || next === state.metric) return
    const q = selectFollowUpQuestion(next, 1, continuityState)
    dispatch({
      type: 'ASK_QUESTION',
      metric: next,
      text: q.text,
    })
  }, [
    state.kind,
    state.kind === 'extracting-answer' ? state.metric : null,
    state.kind === 'extracting-answer' ? state.missing : null,
    continuityState,
    dispatch,
  ])

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
          onSave={() =>
            dispatch(
              ttsAvailable
                ? { type: 'CONFIRM', closer: { text: closerSelection.text } }
                : { type: 'CONFIRM' },
            )
          }
          onRetry={() =>
            dispatch(
              ttsAvailable
                ? { type: 'CONFIRM', closer: { text: closerSelection.text } }
                : { type: 'CONFIRM' },
            )
          }
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

  // Render ConfirmSummary for `confirming`, `saving`, AND `speaking-closer`
  // (voice-mode closer playback happens on the confirm screen — UI stays
  // visible while TTS plays). `saved` is handled by the router push above;
  // this branch is briefly visible during the transition.
  if (
    (state.kind === 'confirming' ||
      state.kind === 'saving' ||
      state.kind === 'speaking-closer') &&
    confirmingRef.current
  ) {
    const snapshot = confirmingRef.current
    const onSaveTap = (): void => {
      // Voice mode: route through speaking-closer for the spoken closer.
      // Taps mode: payload-less CONFIRM goes straight to saving.
      if (ttsAvailable) {
        dispatch({
          type: 'CONFIRM',
          closer: { text: closerSelection.text },
        })
      } else {
        dispatch({ type: 'CONFIRM' })
      }
    }
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
          onSave={onSaveTap}
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

  // idle / requesting-permission / listening / processing / extracting +
  // voice-mode dialog states (speaking-opener, speaking-question,
  // listening-answer, extracting-answer). The Switch-to-Taps button is
  // mounted whenever the user is inside the voice loop so they always
  // have a forward-only escape into Stage 2.
  const showBailButton = isVoiceDialogState(state)
  return (
    <ScreenShell>
      {state.kind === 'idle' ||
      state.kind === 'idle-greeting' ||
      state.kind === 'idle-ready' ? (
        <header className="flex flex-col gap-3">
          <SpokenOpener
            text={
              state.kind === 'idle' ? openerSelection.text : state.text
            }
            variantKey={
              state.kind === 'idle' ? openerSelection.key : state.variantKey
            }
            // When TTS is available the page-level greeting effect owns
            // playback (idle → idle-greeting → idle-ready). Disable
            // SpokenOpener's internal auto-speak so the same utterance
            // doesn't fire twice and cancel itself.
            autoSpeak={!ttsAvailable}
            // Fix C — pulse the speaker icon when Chrome blocked autoplay
            // on cold-mount so the user notices the way to hear what they
            // missed. State only carries `greetingBlocked` on the
            // GREETING_FAILED path.
            highlightSpeaker={
              state.kind === 'idle-ready' && state.greetingBlocked === true
            }
          />
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            {state.kind === 'idle-ready' && state.greetingBlocked === true
              ? 'Tap the speaker to hear how Saha greets you, then tap the orb to begin.'
              : 'Tap the orb and tell me in your own words.'}
          </p>
        </header>
      ) : null}

      {state.kind === 'speaking-opener' ? (
        <header className="flex flex-col gap-3">
          <h1 className="text-center text-base font-normal text-zinc-800 dark:text-zinc-100">
            {state.text}
          </h1>
        </header>
      ) : null}

      {state.kind === 'speaking-question' ? (
        <header className="flex flex-col gap-3">
          <h2 className="text-center text-base font-normal text-zinc-800 dark:text-zinc-100">
            {state.text}
          </h2>
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

      {state.kind === 'listening' || state.kind === 'listening-answer' ? (
        // Voice C1 fix-pass: explicit "Tap when done" button. Same
        // intent as a second orb tap (the hook intercepts TAP_ORB from
        // listening + listening-answer and calls provider.stop()), but
        // visible. The recorder's silence VAD also triggers stop()
        // automatically after trailing silence; this button is the
        // deterministic fallback for noisy environments.
        <StopButton onStop={() => dispatch({ type: 'TAP_ORB' })} />
      ) : null}

      {showBailButton ? (
        <SwitchToTapsButton
          onBail={() => {
            // Cancel any in-flight TTS so the playback doesn't keep
            // running over the Stage 2 grid the reducer is about to render.
            tts.cancel()
            dispatch({ type: 'BAIL_TO_TAPS' })
          }}
        />
      ) : null}
    </ScreenShell>
  )
}

/**
 * Whether the page is inside the voice-mode dialog loop and should
 * mount the Switch-to-Taps bail-out affordance. Excludes `listening`
 * (the C1 freeform turn already has a tap-orb stop affordance) and the
 * cold extraction states (no voice-loop state to bail out of yet).
 */
function isVoiceDialogState(state: State): boolean {
  return (
    state.kind === 'speaking-opener' ||
    state.kind === 'speaking-question' ||
    state.kind === 'listening-answer' ||
    state.kind === 'extracting-answer'
  )
}

/** Short text rendered inside the orb. */
function orbLabelFor(state: State): string | undefined {
  if (state.kind === 'listening' || state.kind === 'listening-answer') {
    return 'Listening'
  }
  if (
    state.kind === 'processing' ||
    state.kind === 'extracting' ||
    state.kind === 'extracting-answer'
  ) {
    return 'Thinking...'
  }
  if (
    state.kind === 'speaking-opener' ||
    state.kind === 'speaking-question' ||
    state.kind === 'speaking-closer'
  ) {
    return 'Saha...'
  }
  return undefined
}

/** Transient status copy rendered below the orb. */
function transientCopyFor(state: State): string {
  switch (state.kind) {
    case 'listening':
      return state.partial || 'I\u2019m listening.'
    case 'listening-answer':
      return state.partial || 'I\u2019m listening.'
    // Voice C1 fix-pass: echo back what we heard during the brief
    // post-stop window so the user has feedback that their speech
    // landed before extraction kicks in. Falls back to "Thinking..."
    // when the transcript is empty (no-speech, empty STT).
    case 'processing':
      return state.transcript.text
        ? `I heard: \u201C${state.transcript.text}\u201D`
        : 'Thinking...'
    case 'extracting':
      return state.transcript.text
        ? `I heard: \u201C${state.transcript.text}\u201D`
        : 'Thinking...'
    case 'extracting-answer':
      return state.answerTranscript.text
        ? `I heard: \u201C${state.answerTranscript.text}\u201D`
        : 'Thinking...'
    case 'requesting-permission':
      return 'Asking for the mic...'
    case 'speaking-opener':
    case 'speaking-question':
    case 'speaking-closer':
      return ''
    case 'saving':
      return 'Saving...'
    default:
      return ''
  }
}
