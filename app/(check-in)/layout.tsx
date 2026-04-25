/**
 * Check-in route-group layout.
 *
 * Feature 01, Chunk 1.C, US-1.C.3.
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

export default function CheckinLayout({
  children,
}: {
  children: ReactNode
}): React.JSX.Element {
  return (
    <>
      <h1 className="sr-only">Daily Check-in</h1>
      {children}
    </>
  )
}
