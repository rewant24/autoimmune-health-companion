/**
 * Milestone detection — pure rules engine.
 *
 * Feature 01, Cycle 2, Chunk 2.F, story Milestone.US-1.J.3.
 *
 * Called by the page after `SAVE_OK` to decide whether to render the
 * ring-celebration overlay. The result is fed into the state-machine
 * `MILESTONE_DETECTED` event (or skipped — straight to `saved` — when null).
 *
 * Rules (locked in scoping):
 *   - First-ever check-in always celebrates with `day-1` (regardless of
 *     numeric streak).
 *   - Otherwise, only the canonical thresholds {7, 30, 90, 180, 365} fire.
 *   - Day-2 / day-8 / day-31 / etc. quietly route straight to `saved`.
 */

import type { MilestoneKind } from './types'

const MILESTONE_THRESHOLDS: ReadonlySet<number> = new Set([7, 30, 90, 180, 365])

export function detectMilestone(
  streakDaysAfterSave: number,
  isFirstEver: boolean,
): MilestoneKind | null {
  // Defensive guards run BEFORE the isFirstEver short-circuit so a
  // garbage `streakDaysAfterSave` (NaN, ±Infinity, 0, negative) doesn't
  // get masked by the first-ever path. Callers that pass `isFirstEver:
  // true` should always pair it with `streakDaysAfterSave: 1`; if they
  // don't, refusing to celebrate is safer than celebrating on bad data.
  if (!Number.isFinite(streakDaysAfterSave)) return null
  if (streakDaysAfterSave <= 0) return null
  if (isFirstEver) return 'day-1'
  if (!MILESTONE_THRESHOLDS.has(streakDaysAfterSave)) return null
  return `day-${streakDaysAfterSave}` as MilestoneKind
}
