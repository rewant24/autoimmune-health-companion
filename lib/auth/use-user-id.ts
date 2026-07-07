'use client'

/**
 * useUserId — the single identity seam for the pre-auth localStorage stub
 * (ADR-019). Owns the `saha.testUser.v1` key and the get-or-create
 * lifecycle that 13 pages/components previously each redeclared.
 *
 * W3 (auth) swaps this hook's internals for Convex Auth identity
 * (`ctx.auth.getUserIdentity()` server-side, session client-side) — call
 * sites don't change. That's the point of the seam: auth becomes a
 * 1-file swap instead of a 13-file swap.
 *
 * e2e specs keep their own seeding copy of the key — they run outside
 * React and get rewired with the W3 test-auth strategy.
 */

import { useEffect, useState } from 'react'

export const TEST_USER_KEY = 'saha.testUser.v1'

/**
 * Read the stub without creating one. SSR-safe. For surfaces that must
 * not own the id lifecycle (PostHog identify runs outside React's render
 * cycle; detail pages treat a missing id as not-found).
 */
export function readUserId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TEST_USER_KEY)
}

function getOrCreateUserId(): string {
  const existing = window.localStorage.getItem(TEST_USER_KEY)
  if (existing) return existing
  const fresh =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(36).slice(2)}_${Date.now()}`
  window.localStorage.setItem(TEST_USER_KEY, fresh)
  return fresh
}

/**
 * Returns the stub userId, or `null` on the server and during the first
 * client render (the read happens in an effect so SSR never touches
 * localStorage). Pass `{ create: false }` on surfaces that must not mint
 * an id (detail pages) — they get the existing stub or `null`.
 */
export function useUserId(opts?: { create?: boolean }): string | null {
  const create = opts?.create ?? true
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    setUserId(create ? getOrCreateUserId() : readUserId())
  }, [create])

  return userId
}
