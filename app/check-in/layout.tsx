/**
 * Check-in route-group layout.
 *
 * Feature 01, Chunk 1.C, US-1.C.3.
 * Unified-app-shell update (2026-04-26): mounts the persistent
 * `<BottomNav />` so the check-in screen reads as part of the same
 * app surface as `/home` and `/journey/memory`. The nav is fixed-bottom
 * and pointer-active over the bottom safe area; `ScreenShell` already
 * uses `justify-center` flex layout so the orb sits visually above the
 * nav without a layout shift. (Retrofit follow-up explicitly called out
 * in `components/nav/BottomNav.tsx` header.)
 *
 * Server component — no `'use client'`. The layout only provides a
 * sr-only heading for screen readers and passes children through. The
 * real screen lives in `page.tsx`, which is a client component.
 *
 * TODO Cycle 2 (Chunk 1.F): auth gate — redirect unauthed users to `/`.
 * The scoping doc (US-1.C.3 acceptance) calls for `useQuery(currentUser)`,
 * but `convex/users.ts` is not shipped yet. Until it is, we render
 * children unconditionally. Do not add Convex imports here in Cycle 1.
 */

import type { ReactNode } from 'react'

import { BottomNav } from '@/components/nav/BottomNav'

export default function CheckinLayout({
  children,
}: {
  children: ReactNode
}): React.JSX.Element {
  return (
    <>
      <h1 className="sr-only">Daily Check-in</h1>
      {children}
      <BottomNav />
    </>
  )
}
