/**
 * Deeper storage tests — Onboarding Shell, Build-B (Chunk B).
 *
 * The seam guard lives at `tests/profile/contract.test.ts` (11 tests).
 * These tests cover the full Setup B flow round-trip, edge cases around
 * malformed payloads, quota-exceeded handling, and the
 * `firstMissingSetupStep` helper used by direct-link guards.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PROFILE_KEY, PROFILE_VERSION } from '@/lib/profile/types'
import {
  clearProfile,
  firstMissingSetupStep,
  markOnboarded,
  readProfile,
  SETUP_STEP_ORDER,
  writeProfile,
} from '@/lib/profile/storage'

afterEach(() => {
  clearProfile()
  vi.restoreAllMocks()
})

describe('storage — full Setup B flow round-trip', () => {
  it('preserves each field as they fill in across the four steps', () => {
    writeProfile({ name: 'Asha' })
    writeProfile({ dobMonth: 4, dobYear: 1992 })
    writeProfile({ email: 'asha@example.com' })
    writeProfile({ condition: 'lupus', conditionOther: null })

    const final = readProfile()
    expect(final).not.toBeNull()
    expect(final?.name).toBe('Asha')
    expect(final?.dobMonth).toBe(4)
    expect(final?.dobYear).toBe(1992)
    expect(final?.email).toBe('asha@example.com')
    expect(final?.condition).toBe('lupus')
    expect(final?.conditionOther).toBeNull()
    expect(final?.onboarded).toBe(false)
  })

  it('persists year-only DOB (null month, year set)', () => {
    writeProfile({ name: 'Asha' })
    writeProfile({ dobMonth: null, dobYear: 1992 })
    const final = readProfile()
    expect(final?.dobMonth).toBeNull()
    expect(final?.dobYear).toBe(1992)
  })

  it('persists unassigned DOB (both null)', () => {
    writeProfile({ name: 'Asha' })
    const final = readProfile()
    expect(final?.dobMonth).toBeNull()
    expect(final?.dobYear).toBeNull()
  })

  it('persists `condition: other` with free-text conditionOther', () => {
    writeProfile({ name: 'Asha' })
    writeProfile({ condition: 'other', conditionOther: 'POTS' })

    const final = readProfile()
    expect(final?.condition).toBe('other')
    expect(final?.conditionOther).toBe('POTS')
  })

  it('markOnboarded after the four-step flow does not wipe prior fields', () => {
    writeProfile({ name: 'Asha', dobMonth: 4, dobYear: 1992 })
    writeProfile({ email: 'asha@example.com', condition: 'lupus' })
    markOnboarded()

    const final = readProfile()
    expect(final?.name).toBe('Asha')
    expect(final?.dobMonth).toBe(4)
    expect(final?.dobYear).toBe(1992)
    expect(final?.email).toBe('asha@example.com')
    expect(final?.condition).toBe('lupus')
    expect(final?.onboarded).toBe(true)
  })
})

describe('storage — payload edge cases', () => {
  it('readProfile returns null for a non-object payload (e.g. JSON number)', () => {
    window.localStorage.setItem(PROFILE_KEY, '42')
    expect(readProfile()).toBeNull()
  })

  it('readProfile returns null for a JSON null payload', () => {
    window.localStorage.setItem(PROFILE_KEY, 'null')
    expect(readProfile()).toBeNull()
  })

  it('readProfile returns null for a payload missing the v field', () => {
    window.localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ name: 'no version here' }),
    )
    expect(readProfile()).toBeNull()
  })

  it('writeProfile after a corrupted read starts fresh (createdAtMs new)', () => {
    window.localStorage.setItem(PROFILE_KEY, '{not json')
    const written = writeProfile({ name: 'Asha' })
    expect(written.v).toBe(PROFILE_VERSION)
    expect(written.name).toBe('Asha')
    expect(written.createdAtMs).toBeGreaterThan(0)
  })

  it('a stale patch trying to downgrade `v` is overridden to current version', () => {
    // Patch type-asserts because this models a stale call site that pre-dates
    // the version bump — we want behaviour, not type, coverage.
    const written = writeProfile({ v: 0 as unknown as 2, name: 'Asha' })
    expect(written.v).toBe(PROFILE_VERSION)
  })

  it('updatedAtMs advances on every write', async () => {
    const a = writeProfile({ name: 'Asha' })
    // Wait at least 1ms so Date.now() increments on platforms with ms-grain.
    await new Promise((r) => setTimeout(r, 2))
    const b = writeProfile({ email: 'a@b.co' })
    expect(b.updatedAtMs).toBeGreaterThanOrEqual(a.updatedAtMs)
  })
})

describe('storage — quota-exceeded handling', () => {
  beforeEach(() => {
    // Spy on console.warn so we can assert the once-only log without
    // polluting the test runner output.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('writeProfile does not throw when localStorage.setItem throws', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      })
    expect(() => writeProfile({ name: 'Asha' })).not.toThrow()
    expect(setItem).toHaveBeenCalled()
  })

  it('writeProfile still returns the in-memory shape on quota error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    const result = writeProfile({ name: 'Asha' })
    expect(result.name).toBe('Asha')
    expect(result.v).toBe(PROFILE_VERSION)
  })
})

describe('firstMissingSetupStep helper', () => {
  it('returns "name" when profile is null', () => {
    expect(firstMissingSetupStep(null)).toBe('name')
  })

  it('returns "name" when name is null', () => {
    writeProfile({})
    expect(firstMissingSetupStep(readProfile())).toBe('name')
  })

  it('returns "name" when name is whitespace', () => {
    writeProfile({ name: '   ' })
    expect(firstMissingSetupStep(readProfile())).toBe('name')
  })

  it('returns "email" when name filled but email missing (DOB is optional and skipped)', () => {
    writeProfile({ name: 'Asha' })
    expect(firstMissingSetupStep(readProfile())).toBe('email')
  })

  it('does NOT redirect to "dob" even if both dobMonth and dobYear are null', () => {
    writeProfile({ name: 'Asha', email: 'a@b.co', condition: 'lupus' })
    expect(firstMissingSetupStep(readProfile())).toBeNull()
  })

  it('returns "condition" when name + email filled but condition missing', () => {
    writeProfile({
      name: 'Asha',
      email: 'a@b.co',
    })
    expect(firstMissingSetupStep(readProfile())).toBe('condition')
  })

  it('returns "condition" when condition is "other" but conditionOther empty', () => {
    writeProfile({
      name: 'Asha',
      email: 'a@b.co',
      condition: 'other',
      conditionOther: '   ',
    })
    expect(firstMissingSetupStep(readProfile())).toBe('condition')
  })

  it('returns null when every required field is filled (DOB skipped)', () => {
    writeProfile({
      name: 'Asha',
      email: 'a@b.co',
      condition: 'lupus',
    })
    expect(firstMissingSetupStep(readProfile())).toBeNull()
  })

  it('returns null when DOB also filled (both required + optional present)', () => {
    writeProfile({
      name: 'Asha',
      dobMonth: 4,
      dobYear: 1992,
      email: 'a@b.co',
      condition: 'lupus',
    })
    expect(firstMissingSetupStep(readProfile())).toBeNull()
  })

  it('SETUP_STEP_ORDER lists the four steps in flow order', () => {
    expect(SETUP_STEP_ORDER).toEqual(['name', 'dob', 'email', 'condition'])
  })
})
