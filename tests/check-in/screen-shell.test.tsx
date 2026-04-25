/**
 * Check-in screen shell tests (US-1.C.3).
 *
 * Renders the /check-in page with a fake VoiceProvider so we can drive
 * state transitions without real mic access. Asserts:
 *   - idle copy renders (first-ever opener variant + subcopy — Convex
 *     query is mocked to return undefined in tests/setup.ts, so the
 *     page falls back to FALLBACK_CONTINUITY which has
 *     `isFirstEverCheckin: true`)
 *   - tap transitions to listening (orb aria-label flips to "Stop check-in")
 *   - error state renders <ErrorSlot>
 *   - ScreenShell wrapper is present
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type {
  Transcript,
  VoiceError,
  VoiceProvider,
} from '@/lib/voice/types'
import CheckinPage from '@/app/check-in/page'

/**
 * Test-only stub that satisfies the VoiceProvider contract. Captures
 * registered callbacks so tests can push partials / errors directly.
 */
class FakeVoiceProvider implements VoiceProvider {
  capabilities = { partials: true, vad: false }
  partialCb: ((p: string) => void) | null = null
  errorCb: ((e: VoiceError) => void) | null = null
  startResult: 'resolve' | VoiceError = 'resolve'
  stopResult: Transcript = { text: 'test transcript', durationMs: 1000 }

  async start(): Promise<void> {
    if (this.startResult === 'resolve') return
    throw this.startResult
  }
  async stop(): Promise<Transcript> {
    return this.stopResult
  }
  onPartial(cb: (p: string) => void): void {
    this.partialCb = cb
  }
  onError(cb: (e: VoiceError) => void): void {
    this.errorCb = cb
  }
}

describe('/check-in page', () => {
  it('renders idle copy on first mount', () => {
    const provider = new FakeVoiceProvider()
    render(<CheckinPage providerOverride={provider} />)

    expect(
      screen.getByText("Hey Sonakshi — glad you're here. How are you feeling today?"),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Tap the orb and tell me in your own words.'),
    ).toBeInTheDocument()
    // Idle orb aria-label.
    expect(
      screen.getByRole('button', { name: 'Start daily check-in' }),
    ).toBeInTheDocument()
  })

  it('wraps content in the ScreenShell container', () => {
    const provider = new FakeVoiceProvider()
    render(<CheckinPage providerOverride={provider} />)
    expect(screen.getByTestId('checkin-screen')).toBeInTheDocument()
  })

  it('tap on idle orb transitions to listening', async () => {
    const provider = new FakeVoiceProvider()
    render(<CheckinPage providerOverride={provider} />)

    const orb = screen.getByRole('button', { name: 'Start daily check-in' })
    await userEvent.click(orb)

    // After start() resolves + PERMISSION_GRANTED dispatches, the orb's
    // aria-label flips to "Stop check-in".
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Stop check-in' }),
      ).toBeInTheDocument()
    })
  })

  it('renders ErrorSlot when provider rejects start() with permission-denied', async () => {
    const provider = new FakeVoiceProvider()
    provider.startResult = { kind: 'permission-denied' }
    render(<CheckinPage providerOverride={provider} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Start daily check-in' }),
    )

    await waitFor(() => {
      const slot = screen.getByTestId('error-slot')
      expect(slot).toHaveAttribute('data-error-kind', 'permission-denied')
    })
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('renders ErrorSlot when provider emits onError while listening', async () => {
    const provider = new FakeVoiceProvider()
    render(<CheckinPage providerOverride={provider} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Start daily check-in' }),
    )
    await waitFor(() =>
      screen.getByRole('button', { name: 'Stop check-in' }),
    )

    // Simulate the provider firing onError mid-session.
    act(() => {
      provider.errorCb?.({ kind: 'network' })
    })

    await waitFor(() => {
      const slot = screen.getByTestId('error-slot')
      expect(slot).toHaveAttribute('data-error-kind', 'network')
    })
  })

  it('retry button resets the machine back to idle', async () => {
    const provider = new FakeVoiceProvider()
    provider.startResult = { kind: 'permission-denied' }
    render(<CheckinPage providerOverride={provider} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Start daily check-in' }),
    )
    await waitFor(() => screen.getByTestId('error-slot'))

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start daily check-in' }),
      ).toBeInTheDocument()
    })
  })
})
