// Profile storage — thin pre-flight starter.
//
// Stamped by orchestrator alongside `lib/profile/types.ts` so all three Wave-1
// agents have working `readProfile` / `writeProfile` from day one. **Build-B
// owns this file** and may extend (e.g. richer error handling, telemetry,
// the `clearProfile` / `markOnboarded` helpers per the plan) — but the
// exported function *signatures* and the `PROFILE_KEY` re-export are part of
// the locked seam and must not change.
//
// Plan reference: docs/features/00-onboarding-shell-cycle-plan.md
//   §"Profile state contract (locked seam — chunk B owns this file)"

import {
  PROFILE_KEY,
  PROFILE_VERSION,
  type Profile,
} from './types'

export { PROFILE_KEY }

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

let warnedCorrupt = false

/**
 * Returns the persisted profile if present, valid, and matches the current
 * schema version. Returns null on:
 *   - missing key
 *   - server/SSR (no `window.localStorage`)
 *   - malformed JSON (logs once)
 *   - wrong `v` (treated as opaque legacy data — logs once)
 */
export function readProfile(): Profile | null {
  if (!isBrowser) return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(PROFILE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    if (!warnedCorrupt) {
      // eslint-disable-next-line no-console
      console.warn(`[profile] corrupted JSON at ${PROFILE_KEY}; treating as missing`)
      warnedCorrupt = true
    }
    return null
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    (parsed as { v?: unknown }).v !== PROFILE_VERSION
  ) {
    if (!warnedCorrupt) {
      // eslint-disable-next-line no-console
      console.warn(`[profile] payload at ${PROFILE_KEY} missing or wrong schema version`)
      warnedCorrupt = true
    }
    return null
  }
  return parsed as Profile
}

/**
 * Merges `patch` over the persisted profile (or a fresh shape if none exists),
 * stamps `updatedAtMs`, and stamps `createdAtMs` once on first write. Returns
 * the resulting Profile.
 *
 * Build-B will likely add quota-exceeded handling here. Pre-flight starter
 * lets writes throw, which surfaces issues early in tests.
 */
export function writeProfile(patch: Partial<Profile>): Profile {
  const now = Date.now()
  const prior = readProfile()
  const defaults: Profile = {
    v: PROFILE_VERSION,
    name: null,
    dobIso: null,
    email: null,
    condition: null,
    conditionOther: null,
    onboarded: false,
    createdAtMs: prior?.createdAtMs ?? now,
    updatedAtMs: now,
  }
  // Re-stamp `v` + `updatedAtMs` after the spreads so a stale patch can't
  // downgrade either field.
  const next: Profile = {
    ...defaults,
    ...prior,
    ...patch,
    v: PROFILE_VERSION,
    updatedAtMs: now,
  }
  if (isBrowser) {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  }
  return next
}

/** Test/dev helper. Build-B may keep as-is. */
export function clearProfile(): void {
  if (isBrowser) {
    window.localStorage.removeItem(PROFILE_KEY)
  }
  warnedCorrupt = false
}

/** Marks the profile as onboarded. Called from the /welcome screen on mount. */
export function markOnboarded(): Profile {
  return writeProfile({ onboarded: true })
}
