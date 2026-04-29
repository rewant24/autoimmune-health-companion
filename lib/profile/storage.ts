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

let warnedQuota = false

/**
 * Merges `patch` over the persisted profile (or a fresh shape if none exists),
 * stamps `updatedAtMs`, and stamps `createdAtMs` once on first write. Returns
 * the resulting Profile.
 *
 * Build-B extension: quota-exceeded errors are caught and logged once, the
 * in-memory next shape is still returned so callers can keep going (the user
 * can retry; a non-blocking surfacing is the caller's responsibility). Other
 * unexpected storage errors are also swallowed once-warned — the contract
 * stays "writes never throw" so route handlers stay simple.
 */
export function writeProfile(patch: Partial<Profile>): Profile {
  const now = Date.now()
  const prior = readProfile()
  const defaults: Profile = {
    v: PROFILE_VERSION,
    name: null,
    dobMonth: null,
    dobYear: null,
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
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    } catch (err) {
      if (!warnedQuota) {
        // eslint-disable-next-line no-console
        console.warn(
          `[profile] failed to persist to ${PROFILE_KEY}; in-memory shape returned`,
          err,
        )
        warnedQuota = true
      }
    }
  }
  return next
}

/** Test/dev helper. */
export function clearProfile(): void {
  if (isBrowser) {
    try {
      window.localStorage.removeItem(PROFILE_KEY)
    } catch {
      // best-effort
    }
  }
  warnedCorrupt = false
  warnedQuota = false
}

/** Marks the profile as onboarded. Called from the /welcome screen on mount. */
export function markOnboarded(): Profile {
  return writeProfile({ onboarded: true })
}

/**
 * Setup B step ordering. Pure helper (no signature in the locked seam) used by
 * the /setup/* direct-link guards: a step page calls
 * `firstMissingSetupStep(readProfile())` and redirects there if the user
 * skipped ahead. Keeping it in storage.ts so the four Setup pages don't each
 * re-derive ordering.
 */
export type SetupStep = 'name' | 'dob' | 'email' | 'condition'

export const SETUP_STEP_ORDER: readonly SetupStep[] = [
  'name',
  'dob',
  'email',
  'condition',
] as const

/**
 * Returns the first incomplete Setup B step given a profile (or "name" if
 * it's missing entirely — caller treats that as "start at name").
 *
 * DOB is OPTIONAL (2026-04-29 tweak): it is intentionally NOT checked here,
 * so a user who skipped /setup/dob is not redirected back to it.
 *
 * Returns null when every required field is filled.
 */
export function firstMissingSetupStep(
  profile: Profile | null,
): SetupStep | null {
  if (profile === null) return 'name'
  if (profile.name === null || profile.name.trim().length === 0) return 'name'
  if (profile.email === null || profile.email.trim().length === 0) return 'email'
  if (profile.condition === null) return 'condition'
  if (
    profile.condition === 'other' &&
    (profile.conditionOther === null ||
      profile.conditionOther.trim().length === 0)
  ) {
    return 'condition'
  }
  return null
}

/**
 * Direct-link guard helper for Setup B step pages.
 *
 * Given the current step and a profile, returns the redirect target if a
 * strictly-prior step is unfilled, or null when the user is allowed to stay
 * on the current step (either it's their first time on it, or they've come
 * back to edit).
 *
 * Caller usage in a page useEffect:
 *   const target = redirectTargetForSetup('email', readProfile())
 *   if (target) router.replace(`/setup/${target}`)
 */
export function redirectTargetForSetup(
  current: SetupStep,
  profile: Profile | null,
): SetupStep | null {
  const missing = firstMissingSetupStep(profile)
  if (missing === null) return null
  const order = { name: 0, dob: 1, email: 2, condition: 3 } as const
  return order[missing] < order[current] ? missing : null
}
