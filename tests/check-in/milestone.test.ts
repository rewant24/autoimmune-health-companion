/**
 * Tests for `lib/checkin/milestone.ts` — pure milestone detection.
 *
 * Feature 01, Cycle 2, Chunk 2.F, story Milestone.US-1.J.3.
 *
 * Contract:
 *   detectMilestone(streakDaysAfterSave, isFirstEver):
 *     - returns 'day-1' when isFirstEver === true (regardless of streak input)
 *     - else returns `day-${N}` iff streakDaysAfterSave ∈ {7, 30, 90, 180, 365}
 *     - else returns null
 */

import { describe, expect, it } from 'vitest'

import { detectMilestone } from '@/lib/checkin/milestone'

describe('detectMilestone', () => {
  it("returns 'day-1' when isFirstEver === true", () => {
    expect(detectMilestone(1, true)).toBe('day-1')
  })

  it("returns 'day-1' when isFirstEver === true even if streakDaysAfterSave is a later threshold", () => {
    // First-ever wins even if the streak math implies a different threshold.
    expect(detectMilestone(7, true)).toBe('day-1')
    expect(detectMilestone(30, true)).toBe('day-1')
  })

  it("returns 'day-7' on streakDaysAfterSave=7 (not first ever)", () => {
    expect(detectMilestone(7, false)).toBe('day-7')
  })

  it("returns 'day-30' on streakDaysAfterSave=30", () => {
    expect(detectMilestone(30, false)).toBe('day-30')
  })

  it("returns 'day-90' on streakDaysAfterSave=90", () => {
    expect(detectMilestone(90, false)).toBe('day-90')
  })

  it("returns 'day-180' on streakDaysAfterSave=180", () => {
    expect(detectMilestone(180, false)).toBe('day-180')
  })

  it("returns 'day-365' on streakDaysAfterSave=365", () => {
    expect(detectMilestone(365, false)).toBe('day-365')
  })

  it('returns null on streakDaysAfterSave=2 (non-threshold)', () => {
    expect(detectMilestone(2, false)).toBeNull()
  })

  it('returns null on streakDaysAfterSave=8 (just past day-7)', () => {
    expect(detectMilestone(8, false)).toBeNull()
  })

  it('returns null on streakDaysAfterSave=31 (just past day-30)', () => {
    expect(detectMilestone(31, false)).toBeNull()
  })

  it('returns null on streakDaysAfterSave=1 when not first ever (a re-streak day-1 is not a milestone)', () => {
    expect(detectMilestone(1, false)).toBeNull()
  })

  it('returns null on streakDaysAfterSave=0', () => {
    expect(detectMilestone(0, false)).toBeNull()
  })

  it('returns null on negative streakDaysAfterSave (defensive)', () => {
    expect(detectMilestone(-1, false)).toBeNull()
  })
})
