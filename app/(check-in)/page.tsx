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
 * The voice provider is resolved by `getVoiceProvider()` by default, but
 * the page accepts `providerOverride` so tests can inject a fake without
 * vi.mock acrobatics.
 *
 * Cycle 1 `onSave` is a logging no-op — Chunk 1.F wires the Convex
 * `createCheckin` mutation in Cycle 2. Do NOT import from `convex/_generated`
 * here yet.
 */

import { useMemo, useState } from 'react'
import type { VoiceProvider } from '@/lib/voice/types'
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

export default function CheckinPage({
  providerOverride,
}: CheckinPageProps = {}): React.JSX.Element {
  // One provider instance per mount — adapters hold event subscribers and
  // a live recognition handle, so they must not be recreated on every render.
  const provider = useMemo<VoiceProvider>(
    () => providerOverride ?? getVoiceProvider(),
    [providerOverride],
  )

  // Remember the last transcript we processed so the saved screen can
  // reference it once Cycle 2 wires the summary card. In Cycle 1 we just
  // hold it for the logging no-op.
  const [lastState, setLastState] = useState<State | null>(null)

  const onSave = async (): Promise<void> => {
    // Cycle 1: onSave is a logging no-op. Cycle 2 / Chunk 1.F wires the
    // Convex createCheckin mutation here and returns its promise.
    // eslint-disable-next-line no-console
    console.log('Cycle 1: onSave placeholder', lastState)
  }

  const { state, dispatch } = useCheckinMachine(provider, onSave)

  // Stash the latest state so onSave can read it without taking a React
  // dependency on state inside the hook.
  if (lastState !== state) setLastState(state)

  return (
    <ScreenShell>
      {state.kind === 'error' ? (
        <ErrorSlot
          kind={state.error.kind}
          message={'message' in state.error ? state.error.message : undefined}
          onRetry={() => dispatch({ type: 'RESET' })}
        />
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
        </>
      )}
    </ScreenShell>
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
