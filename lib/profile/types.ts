// Profile state contract — Onboarding Shell cycle locked seam.
//
// Stamped by orchestrator in pre-flight (tag `onboarding-shell/pre-flight-done`)
// so all three Wave-1 build agents (A: onboarding screens, B: setup + storage,
// C: welcome + home + nav) import a stable shape from day one.
//
// Build-B owns `lib/profile/storage.ts` and may extend its implementation, but
// the exported types here are locked: Build-B may not modify this file.
// Future migrations bump `v` and add a migrator alongside.
//
// Plan reference: docs/features/00-onboarding-shell-cycle-plan.md
//   §"Profile state contract (locked seam — chunk B owns this file)"

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
 * - `onboarded` flips to true on the /welcome screen mount.
 * - `createdAtMs` is set once on the first write; `updatedAtMs` refreshes on
 *   every write.
 */
export interface Profile {
  v: 1
  name: string | null
  dobIso: string | null // YYYY-MM-DD
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
export const PROFILE_VERSION = 1 as const
