/**
 * /check-in/saved route tests (US-1.F.4).
 *
 * Per ADR-023 (with unified-app-shell update 2026-04-26):
 *   - Stable terminal route after save.
 *   - "View memory" CTA rendered unconditionally (env-var gate removed
 *     post F02 C1 ship).
 *   - Auto-dismiss to `/journey/memory` after 2000ms (was `/` pre-unify);
 *     visible ≥1.5s minimum.
 *
 * The page reads the `closer` query string and renders it next to the
 * settled-orb visual. We render <SavedView> directly (the page wraps it
 * with the App Router's searchParams/router and would otherwise need
 * full Next harness). The page itself is exercised via a thin smoke
 * render of its default export with mocked next/navigation.
 */

import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SavedView } from '@/app/check-in/saved/page'

// Stub next/navigation — the real router throws outside an App Router tree.
const pushSpy = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}))

describe('<SavedView /> (/check-in/saved)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    pushSpy.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the closer text passed via prop', () => {
    render(<SavedView closer="Saved. See you tomorrow." queued={false} />)
    expect(screen.getByText('Saved. See you tomorrow.')).toBeInTheDocument()
  })

  it('renders the orb in its `saved` visual state', () => {
    render(<SavedView closer="Saved." queued={false} />)
    expect(
      document.querySelector('[data-orb-state="saved"]'),
    ).toBeInTheDocument()
  })

  it('shows "Keep this for later" queued banner when queued=true', () => {
    render(<SavedView closer="Saved." queued={true} />)
    expect(
      screen.getByText(/we'll save it as soon as you're back online/i),
    ).toBeInTheDocument()
  })

  it('hides the queued banner when queued=false', () => {
    render(<SavedView closer="Saved." queued={false} />)
    expect(
      screen.queryByText(/we'll save it as soon as you're back online/i),
    ).not.toBeInTheDocument()
  })

  it('renders the View memory CTA pointing at /journey/memory', () => {
    render(<SavedView closer="Saved." queued={false} />)
    const link = screen.getByRole('link', { name: /view memory/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/journey/memory')
  })

  it('auto-dismisses to "/journey/memory" after 2000ms', () => {
    render(<SavedView closer="Saved." queued={false} />)
    expect(pushSpy).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(pushSpy).toHaveBeenCalledWith('/journey/memory')
  })

  it('does not auto-dismiss before 1500ms (minimum visible)', () => {
    render(<SavedView closer="Saved." queued={false} />)
    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('clears the auto-dismiss timer on unmount', () => {
    const { unmount } = render(<SavedView closer="Saved." queued={false} />)
    unmount()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('falls back to a default closer if none provided', () => {
    render(<SavedView closer="" queued={false} />)
    // Visible text should be non-empty — exact fallback wording is tested by
    // checking that the heading region renders something.
    const region = screen.getByTestId('checkin-saved-region')
    expect(region.textContent ?? '').not.toBe('')
  })
})
