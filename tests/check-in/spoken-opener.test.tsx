/**
 * Tests for `<SpokenOpener>` (Feature 01, Cycle 2, Chunk 2.E).
 *
 * Stories:
 *   TTS.US-1.H.2 — auto-speaks the opener text on mount unless TTS is
 *     unavailable, the user prefers reduced motion, or the
 *     `saha.ttsDisabled` localStorage flag is set; renders a speaker
 *     icon button (replay) that calls `speak(text)` on click; cancels
 *     on unmount; speaker icon is hidden when TTS is unavailable.
 *
 *   TTS.US-1.H.3 — long-pressing the speaker icon for 1s opens a small
 *     "Mute Saha's voice" popover; confirming sets the
 *     `saha.ttsDisabled` localStorage flag.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SpokenOpener } from '@/components/check-in/SpokenOpener'

// --- Hoisted mock spies ----------------------------------------------------

const { speakMock, cancelMock, isAvailableMock } = vi.hoisted(() => ({
  speakMock: vi.fn().mockResolvedValue(undefined),
  cancelMock: vi.fn(),
  isAvailableMock: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/voice/provider', () => ({
  getTtsProvider: () => ({
    speak: speakMock,
    cancel: cancelMock,
    isAvailable: () => isAvailableMock(),
  }),
}))

// --- Helpers ---------------------------------------------------------------

interface MatchMediaResult {
  matches: boolean
  media: string
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  addListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  onchange: null
  dispatchEvent: () => boolean
}

function setReducedMotion(preferred: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MatchMediaResult => ({
      matches: preferred && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: (): boolean => true,
    }),
  })
}

beforeEach(() => {
  speakMock.mockClear()
  cancelMock.mockClear()
  isAvailableMock.mockReturnValue(true)
  setReducedMotion(false)
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// --- Tests -----------------------------------------------------------------

describe('<SpokenOpener /> rendering', () => {
  it('renders the opener text in a paragraph', () => {
    render(<SpokenOpener text="Good to see you." variantKey="cold-start" />)
    expect(screen.getByText('Good to see you.')).toBeInTheDocument()
  })

  it('shows the replay button when TTS is available', () => {
    render(<SpokenOpener text="Good to see you." variantKey="cold-start" />)
    expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument()
  })

  it('hides the replay button when TTS is unavailable', () => {
    isAvailableMock.mockReturnValue(false)
    render(<SpokenOpener text="Silent." variantKey="cold-start" />)
    expect(
      screen.queryByRole('button', { name: 'Replay' }),
    ).not.toBeInTheDocument()
  })
})

describe('<SpokenOpener /> auto-speak behaviour', () => {
  it('auto-speaks the opener text on mount when TTS is available', async () => {
    render(<SpokenOpener text="Welcome back." variantKey="cold-start" />)
    await waitFor(() => {
      expect(speakMock).toHaveBeenCalledWith('Welcome back.')
    })
  })

  it('does not auto-speak when TTS is unavailable', async () => {
    isAvailableMock.mockReturnValue(false)
    render(<SpokenOpener text="Welcome back." variantKey="cold-start" />)
    // Allow effects to flush.
    await Promise.resolve()
    expect(speakMock).not.toHaveBeenCalled()
  })

  it('does not auto-speak when prefers-reduced-motion is set', async () => {
    setReducedMotion(true)
    render(<SpokenOpener text="Welcome back." variantKey="cold-start" />)
    await Promise.resolve()
    expect(speakMock).not.toHaveBeenCalled()
  })

  it('does not auto-speak when saha.ttsDisabled is "true" in localStorage', async () => {
    window.localStorage.setItem('saha.ttsDisabled', 'true')
    render(<SpokenOpener text="Welcome back." variantKey="cold-start" />)
    await Promise.resolve()
    expect(speakMock).not.toHaveBeenCalled()
  })

  it('cancels any in-flight utterance on unmount', async () => {
    const { unmount } = render(
      <SpokenOpener text="Welcome back." variantKey="cold-start" />,
    )
    await waitFor(() => expect(speakMock).toHaveBeenCalled())
    unmount()
    expect(cancelMock).toHaveBeenCalled()
  })

  it('re-runs auto-speak when variantKey changes', async () => {
    const { rerender } = render(
      <SpokenOpener text="Welcome back." variantKey="cold-start" />,
    )
    await waitFor(() => expect(speakMock).toHaveBeenCalledTimes(1))
    rerender(<SpokenOpener text="Day 7 — nice." variantKey="streak-7" />)
    await waitFor(() => expect(speakMock).toHaveBeenCalledTimes(2))
    expect(speakMock).toHaveBeenLastCalledWith('Day 7 — nice.')
  })
})

describe('<SpokenOpener /> replay button', () => {
  it('clicking the replay button calls speak with the current text', async () => {
    render(<SpokenOpener text="Hello." variantKey="cold-start" />)
    await waitFor(() => expect(speakMock).toHaveBeenCalled())
    speakMock.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Replay' }))
    expect(speakMock).toHaveBeenCalledWith('Hello.')
  })
})

describe('<SpokenOpener /> mute long-press (TTS.US-1.H.3)', () => {
  it('long-pressing the speaker icon for 1s opens the mute popover', () => {
    vi.useFakeTimers()
    render(<SpokenOpener text="Hello." variantKey="cold-start" />)
    const button = screen.getByRole('button', { name: 'Replay' })

    act(() => {
      fireEvent.pointerDown(button)
    })
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS)
    })

    expect(
      screen.getByRole('button', { name: "Mute Saha's voice" }),
    ).toBeInTheDocument()
  })

  it('confirming the mute popover sets saha.ttsDisabled = "true" in localStorage', () => {
    vi.useFakeTimers()
    render(<SpokenOpener text="Hello." variantKey="cold-start" />)
    const button = screen.getByRole('button', { name: 'Replay' })

    act(() => {
      fireEvent.pointerDown(button)
    })
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS)
    })
    act(() => {
      fireEvent.pointerUp(button)
    })

    const confirm = screen.getByRole('button', {
      name: "Mute Saha's voice",
    })
    act(() => {
      fireEvent.click(confirm)
    })

    expect(window.localStorage.getItem('saha.ttsDisabled')).toBe('true')
  })

  it('the popover closes after confirming mute', () => {
    vi.useFakeTimers()
    render(<SpokenOpener text="Hello." variantKey="cold-start" />)
    const button = screen.getByRole('button', { name: 'Replay' })

    act(() => {
      fireEvent.pointerDown(button)
    })
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS)
    })
    act(() => {
      fireEvent.pointerUp(button)
    })

    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: "Mute Saha's voice" }),
      )
    })

    expect(
      screen.queryByRole('button', { name: "Mute Saha's voice" }),
    ).not.toBeInTheDocument()
  })

  it('a short tap (under 1s) does not open the popover', () => {
    vi.useFakeTimers()
    render(<SpokenOpener text="Hello." variantKey="cold-start" />)
    const button = screen.getByRole('button', { name: 'Replay' })

    act(() => {
      fireEvent.pointerDown(button)
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      fireEvent.pointerUp(button)
      fireEvent.click(button)
    })

    expect(
      screen.queryByRole('button', { name: "Mute Saha's voice" }),
    ).not.toBeInTheDocument()
  })
})

const LONG_PRESS_MS = 1000
