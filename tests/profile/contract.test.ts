// Onboarding-shell pre-flight contract tests.
//
// These guard the locked seam (`lib/profile/types.ts` + the exported
// signatures of `lib/profile/storage.ts`) so that Wave-1's parallel build
// agents can rely on a stable shape. Build-B will add deeper storage tests
// (round-trips, malformed JSON, quota, the four Setup screens). Anything
// covered here must keep passing as Build-B extends.

import { afterEach, describe, expect, it } from 'vitest'

import {
  PROFILE_KEY,
  PROFILE_VERSION,
  type Condition,
  type Profile,
} from '@/lib/profile/types'
import {
  clearProfile,
  markOnboarded,
  readProfile,
  writeProfile,
} from '@/lib/profile/storage'

afterEach(() => {
  clearProfile()
})

describe('profile contract — types', () => {
  it('PROFILE_KEY is the locked saha.profile.v1 namespace', () => {
    expect(PROFILE_KEY).toBe('saha.profile.v1')
  })

  it('PROFILE_VERSION is 1', () => {
    expect(PROFILE_VERSION).toBe(1)
  })

  it('Condition union covers all 10 locked conditions plus other', () => {
    // Compile-time exhaustiveness check — every literal must be assignable.
    const all: Condition[] = [
      'lupus',
      'rheumatoid-arthritis',
      'hashimotos',
      'multiple-sclerosis',
      'crohns',
      'psoriasis',
      'sjogrens',
      'ankylosing-spondylitis',
      'type-1-diabetes',
      'celiac',
      'other',
    ]
    expect(all).toHaveLength(11)
  })

  it('Profile shape compiles with the locked field set', () => {
    // If a field is renamed or removed, this won't typecheck — the test is
    // the canary for accidental contract drift across A/B/C.
    const p: Profile = {
      v: 1,
      name: null,
      dobIso: null,
      email: null,
      condition: null,
      conditionOther: null,
      onboarded: false,
      createdAtMs: 0,
      updatedAtMs: 0,
    }
    expect(p.v).toBe(1)
  })
})

describe('profile contract — storage seam', () => {
  it('readProfile returns null when nothing is stored', () => {
    expect(readProfile()).toBeNull()
  })

  it('writeProfile + readProfile round-trips a partial patch', () => {
    const written = writeProfile({ name: 'Asha' })
    expect(written.name).toBe('Asha')
    expect(written.v).toBe(1)
    expect(written.createdAtMs).toBeGreaterThan(0)
    expect(written.updatedAtMs).toBeGreaterThanOrEqual(written.createdAtMs)

    const read = readProfile()
    expect(read).not.toBeNull()
    expect(read?.name).toBe('Asha')
    expect(read?.email).toBeNull()
  })

  it('writeProfile preserves createdAtMs across subsequent writes', () => {
    const first = writeProfile({ name: 'Asha' })
    const second = writeProfile({ email: 'asha@example.com' })
    expect(second.createdAtMs).toBe(first.createdAtMs)
    expect(second.name).toBe('Asha')
    expect(second.email).toBe('asha@example.com')
  })

  it('readProfile returns null when payload is malformed JSON', () => {
    window.localStorage.setItem(PROFILE_KEY, '{not json')
    expect(readProfile()).toBeNull()
  })

  it('readProfile returns null when payload has wrong schema version', () => {
    window.localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ v: 999, name: 'legacy' }),
    )
    expect(readProfile()).toBeNull()
  })

  it('markOnboarded flips onboarded to true and persists', () => {
    expect(markOnboarded().onboarded).toBe(true)
    expect(readProfile()?.onboarded).toBe(true)
  })

  it('clearProfile removes the stored profile', () => {
    writeProfile({ name: 'Asha' })
    expect(readProfile()).not.toBeNull()
    clearProfile()
    expect(readProfile()).toBeNull()
  })
})
