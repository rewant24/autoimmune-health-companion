'use client'

/**
 * ScreenShell — layout wrapper for the daily check-in screen.
 *
 * Feature 01, Chunk 1.C, US-1.C.3.
 *
 * Full viewport height, safe-area padding, no scroll, flex-col centred.
 * Mobile-first. The orb lives in the centre; transient copy above and
 * below. The `<ErrorSlot>` is rendered by the page when state is `error`
 * — this shell stays agnostic about content.
 *
 * Bottom padding clears two stacked floating affordances:
 *   - `<BottomNav>` (~64px tall, `fixed bottom-0`, safe-area aware)
 *   - StopButton / SwitchToTapsButton (~44px tap target, sits at
 *     `bottom-[calc(5rem+safe-area-inset-bottom)]` per Fix B)
 * So the centred orb stays clear of both. Pre-fix-B padding-bottom of
 * 1.5rem was insufficient on mobile.
 */

import type { ReactNode } from 'react'

export interface ScreenShellProps {
  children: ReactNode
}

export function ScreenShell({ children }: ScreenShellProps): React.JSX.Element {
  return (
    <main
      data-testid="checkin-screen"
      className={
        'flex min-h-[100svh] w-full flex-col items-center justify-center ' +
        'gap-8 overflow-hidden bg-bg px-6 text-center text-ink ' +
        // Safe-area padding — respects notch + home indicator on mobile.
        '[padding-top:max(1.5rem,env(safe-area-inset-top))] ' +
        '[padding-bottom:calc(8rem+env(safe-area-inset-bottom))]'
      }
    >
      {children}
    </main>
  )
}
