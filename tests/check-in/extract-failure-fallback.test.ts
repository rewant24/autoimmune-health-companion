/**
 * Tests for `lib/checkin/extract-failure-fallback.ts`.
 *
 * Pins the voice-loop-survives-extract-failure contract introduced in
 * PR #21. The helper is the dispatch decision made inside the page-level
 * extract catch block; testing it directly avoids standing up a full
 * page-render harness while still catching regressions to either branch.
 *
 * Two branches:
 *  - ttsAvailable=true  → ASK_QUESTION for the first metric, seed = all 5 missing
 *  - ttsAvailable=false → EXTRACTION_FAILED (tap-only Stage 2 fallthrough)
 */
import { describe, it, expect } from 'vitest'

import { extractFailureFallback } from '@/lib/checkin/extract-failure-fallback'
import type { ContinuityState } from '@/lib/checkin/types'

// Mirrors FALLBACK_CONTINUITY in app/check-in/page.tsx (the production
// default when the Convex continuity query is still resolving). Inlined
// here so the test doesn't require exporting it from the page module.
const FALLBACK_CONTINUITY: ContinuityState = {
  yesterday: null,
  streakDays: 0,
  lastCheckinDaysAgo: Number.POSITIVE_INFINITY,
  upcomingEvent: null,
  flareOngoingDays: 0,
  isFirstEverCheckin: true,
}

describe('extractFailureFallback', () => {
  it('voice mode → ASK_QUESTION with all 5 metrics missing', () => {
    const event = extractFailureFallback(true, FALLBACK_CONTINUITY)

    expect(event.type).toBe('ASK_QUESTION')
    if (event.type !== 'ASK_QUESTION') return // narrow for TS

    expect(event.metric).toBe('pain')
    expect(typeof event.text).toBe('string')
    expect(event.text.length).toBeGreaterThan(0)
    expect(event.seed).toBeDefined()
    expect(event.seed?.metrics).toEqual({})
    expect(event.seed?.declined).toEqual([])
    expect(event.seed?.missing).toEqual([
      'pain',
      'mood',
      'adherenceTaken',
      'flare',
      'energy',
    ])
  })

  it('tap-only mode → EXTRACTION_FAILED (no voice loop)', () => {
    const event = extractFailureFallback(false, FALLBACK_CONTINUITY)

    expect(event).toEqual({ type: 'EXTRACTION_FAILED' })
  })

  it('voice mode produces a fresh seed.missing array (not shared)', () => {
    const a = extractFailureFallback(true, FALLBACK_CONTINUITY)
    const b = extractFailureFallback(true, FALLBACK_CONTINUITY)

    if (a.type !== 'ASK_QUESTION' || b.type !== 'ASK_QUESTION') {
      throw new Error('expected ASK_QUESTION')
    }
    // Independent arrays so downstream reducers can mutate without
    // accidentally leaking across dispatches.
    expect(a.seed?.missing).not.toBe(b.seed?.missing)
  })
})
