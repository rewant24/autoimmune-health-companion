// Profile state contract — Onboarding Shell cycle locked seam.
//
// Stamped by orchestrator in pre-flight (tag `onboarding-shell/pre-flight-done`)
// so all three Wave-1 build agents (A: onboarding screens, B: setup + storage,
// C: welcome + home + nav) import a stable shape from day one.
//
// 2026-04-29 tweak: DOB became optional and lost the day component; `dobIso`
// was replaced by separate `dobMonth` + `dobYear` nullable fields. Schema
// version bumped 1 → 2 (no migrator; pre-launch, v1 payloads are dropped by
// `readProfile` per the version-mismatch path).
//
// Plan reference: docs/features/00-onboarding-shell-cycle-plan.md
//   §"Profile state contract (locked seam — chunk B owns this file)"
// ADR reference: docs/architecture-decisions.md ADR-029 (DOB-optional v1→v2).

/**
 * The 10 conditions surfaced on the marketing landing page, plus an "Other"
 * escape hatch (free text captured in `Profile.conditionOther`). Locked
 * decision Q2 in the cycle plan.
 */
export type Condition =
  | 'lupus'
  | 'rheumatoid-arthritis'
  | 'hashimotos'
  | 'multiple-sclerosis'
  | 'crohns'
  | 'psoriasis'
  | 'sjogrens'
  | 'ankylosing-spondylitis'
  | 'type-1-diabetes'
  | 'celiac'
  | 'other'

/**
 * The profile shape persisted to localStorage under PROFILE_KEY.
 *
 * - `v` is the version tag — readers reject any payload whose `v` does not
 *   match the current literal (treat as null + log once).
 * - All field-level data starts null and fills in across Setup B's four steps.
 * - `dobMonth` / `dobYear` are independent + optional. Valid combinations:
 *     (null, null) — unassigned · (null, year) — year only ·
 *     (month, year) — both. The (month, null) "orphan-month" case is
 *     coerced to (null, null) at the write site (see /setup/dob page).
 * - `onboarded` flips to true on the /welcome screen mount.
 * - `createdAtMs` is set once on the first write; `updatedAtMs` refreshes on
 *   every write.
 */
export interface Profile {
  v: 2
  name: string | null
  dobMonth: number | null // 1..12 inclusive; null when unassigned or orphan-month coerced
  dobYear: number | null // 4-digit year; null when unassigned
  email: string | null
  condition: Condition | null
  conditionOther: string | null // free text iff condition === 'other'; else null
  onboarded: boolean
  createdAtMs: number
  updatedAtMs: number
}

/** localStorage namespace. Locked: matches `saha.testUser.v1` / `saha.saveLater.v1` family. */
export const PROFILE_KEY = 'saha.profile.v1'

/** Current schema version literal. Bump when introducing a migrator. */
export const PROFILE_VERSION = 2 as const
