'use client'

/**
 * /check-in — daily voice check-in screen.
 *
 * Feature 01, Chunk 1.C, US-1.C.3.
 *
 * Composes:
 *   - ScreenShell (layout)
 *   - Orb (tap target + 4 visual states)
 *   - ErrorSlot (Feature 10 stub — rendered when state is `error`)
 *   - useCheckinMachine (state + provider wiring)
 *
 * Pre-Cycle-2 testability wiring (2026-04-25):
 *   - `onSave` calls Convex `createCheckin` with sensible defaults so the
 *     check-in actually persists. Real metric extraction (US-1.D) and
 *     auth (US-1.F) still pending; until then we use a stable browser-
 *     local userId and middle-of-range pain/mood/energy defaults.
 *   - `processing` auto-advances to `confirming` because 1.D is not
 *     wired yet; on `confirming` the user reviews the transcript and
 *     taps Save to dispatch CONFIRM.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useMutation } from 'convex/react'
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

export interface CheckinPageProps {
  /**
   * Test seam — inject a fake provider instead of pulling the real
   * adapter via `getVoiceProvider()`. Production callers omit this.
   */
  providerOverride?: VoiceProvider
}

const TEST_USER_KEY = 'saumya.testUser.v1'

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

export default function CheckinPage({
  providerOverride,
}: CheckinPageProps = {}): React.JSX.Element {
  const provider = useMemo<VoiceProvider>(
    () => providerOverride ?? getVoiceProvider(),
    [providerOverride],
  )

  const createCheckin = useMutation(api.checkIns.createCheckin)

  // Hold the last transcript out-of-band — the state machine drops it
  // after `confirming` so we need our own copy for `onSave` to use.
  const [latestTranscript, setLatestTranscript] = useState<Transcript | null>(
    null,
  )

  const onSave = async (): Promise<void> => {
    const transcript = latestTranscript
    if (!transcript) {
      throw new Error('No transcript captured')
    }
    await createCheckin({
      userId: getOrCreateTestUserId(),
      date: todayIsoDate(),
      // Defaults — US-1.D will replace these with extracted metrics.
      pain: 5,
      mood: 'okay',
      adherenceTaken: false,
      flare: 'no',
      energy: 5,
      transcript: transcript.text,
      stage: 'open',
      durationMs: 0,
      providerUsed: 'web-speech',
      clientRequestId:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `req_${Date.now()}`,
    })
  }

  const { state, dispatch } = useCheckinMachine(provider, onSave)

  // Capture the transcript when we have one, then auto-advance through
  // `processing` (1.D not wired — there's nothing to extract yet).
  useEffect(() => {
    if (state.kind === 'processing') {
      setLatestTranscript(state.transcript)
      dispatch({ type: 'METRICS_READY' })
    } else if (state.kind === 'confirming') {
      setLatestTranscript(state.transcript)
    }
  }, [state, dispatch])

  return (
    <ScreenShell>
      {state.kind === 'error' ? (
        <ErrorSlot
          kind={state.error.kind}
          message={'message' in state.error ? state.error.message : undefined}
          onRetry={() => dispatch({ type: 'RESET' })}
        />
      ) : state.kind === 'saved' ? (
        <SavedView />
      ) : (
        <>
          {state.kind === 'idle' ? (
            <header className="flex flex-col gap-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                How&apos;s today feeling?
              </h2>
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

          {state.kind === 'confirming' ? (
            <ConfirmPanel
              transcript={state.transcript.text}
              onSave={() => dispatch({ type: 'CONFIRM' })}
              onRetry={() => dispatch({ type: 'RESET' })}
            />
          ) : null}
        </>
      )}
    </ScreenShell>
  )
}

function ConfirmPanel({
  transcript,
  onSave,
  onRetry,
}: {
  transcript: string
  onSave: () => void
  onRetry: () => void
}): React.JSX.Element {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <blockquote className="rounded-xl border border-zinc-200 bg-white p-4 text-left text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {transcript || <em className="text-zinc-400">Nothing was captured.</em>}
      </blockquote>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Save check-in
        </button>
      </div>
    </div>
  )
}

function SavedView(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <svg
          aria-hidden
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Got it. See you tomorrow.
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your check-in is saved.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/memory"
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          View memory
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Home
        </Link>
      </div>
    </div>
  )
}

/** Short text rendered inside the orb. */
function orbLabelFor(state: State): string | undefined {
  if (state.kind === 'listening') return 'Listening'
  if (state.kind === 'processing') return 'Thinking...'
  return undefined
}

/** Transient status copy rendered below the orb. */
function transientCopyFor(state: State): string {
  switch (state.kind) {
    case 'listening':
      return state.partial || 'I\u2019m listening.'
    case 'processing':
      return 'Thinking...'
    case 'requesting-permission':
      return 'Asking for the mic...'
    case 'confirming':
      return 'Review and save.'
    case 'saving':
      return 'Saving...'
    case 'saved':
      return 'Got it. See you tomorrow.'
    default:
      return ''
  }
}
