/**
 * Journey route-group layout.
 *
 * Unified-app-shell (2026-04-26): mounts the persistent `<BottomNav />`
 * so /journey/memory reads as part of the same app surface as /home and
 * /check-in. Active-tab highlight (Journey pillar) is computed by
 * BottomNav from `usePathname()`.
 *
 * Server component. The Memory page itself is a client component that
 * owns its data + state. This layout is a thin shell.
 */

import type { ReactNode } from 'react'

import { BottomNav } from '@/components/nav/BottomNav'

export default function JourneyLayout({
  children,
}: {
  children: ReactNode
}): React.JSX.Element {
  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}
