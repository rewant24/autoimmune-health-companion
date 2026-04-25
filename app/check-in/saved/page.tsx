'use client'

/**
 * /check-in/saved — terminal route after a successful save.
 *
 * Feature 01, Chunk 2.D, US-1.F.4.
 *
 * Per ADR-023 (with unified-app-shell update 2026-04-26):
 *   - Stable URL the post-save flow always lands on (mobile-share friendly).
 *   - Renders the settled orb (`'saved'` visual variant) + the closer text
 *     passed via `?closer=<URL-encoded>`.
 *   - Auto-dismiss to `/journey/memory` after 2000ms (was `/` pre-unify);
 *     closes the contribute → see-it-back loop. Visible ≥ 1500ms minimum.
 *   - "View memory" CTA rendered unconditionally (was gated behind
 *     `NEXT_PUBLIC_F02_C1_SHIPPED` pre-F02 C1; F02 C1 has shipped, so the
 *     gate is removed for one fewer env-var dependency).
 *
 * The page splits into a thin wrapper (reads search params) + a
 * presentational `<SavedView>` so tests can render the view directly with
 * fake timers and a mocked `useRouter`.
 */

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Orb } from '@/components/check-in/Orb'
import { ScreenShell } from '@/components/check-in/ScreenShell'

const AUTO_DISMISS_MS = 2000

const DEFAULT_CLOSER = 'Saved. See you tomorrow.'

export interface SavedViewProps {
  closer: string
  queued: boolean
}

export function SavedView({ closer, queued }: SavedViewProps): React.JSX.Element {
  const router = useRouter()

  useEffect(() => {
    const id = window.setTimeout(() => {
      router.push('/journey/memory')
    }, AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [router])

  const visibleCloser = closer.trim().length > 0 ? closer : DEFAULT_CLOSER

  return (
    <ScreenShell>
      <section
        data-testid="checkin-saved-region"
        aria-live="polite"
        className="flex flex-col items-center gap-6"
      >
        <Orb orbState="saved" onTap={() => {}} disabled />
        <p className="max-w-sm text-base text-zinc-700 dark:text-zinc-200">
          {visibleCloser}
        </p>
        {queued ? (
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Saved for later — we&apos;ll save it as soon as you&apos;re back online.
          </p>
        ) : null}
        <a
          href="/journey/memory"
          className={
            'mt-2 inline-flex min-h-11 items-center justify-center rounded-full ' +
            'bg-teal-600 px-6 text-sm font-medium text-white hover:bg-teal-700 ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ' +
            'focus-visible:ring-offset-2'
          }
        >
          View memory
        </a>
      </section>
    </ScreenShell>
  )
}

function SavedPageInner(): React.JSX.Element {
  const params = useSearchParams()
  const closer = params?.get('closer') ?? ''
  const queued = params?.get('queued') === 'true'
  return <SavedView closer={closer} queued={queued} />
}

export default function SavedPage(): React.JSX.Element {
  // useSearchParams must be wrapped in <Suspense> at the App Router boundary.
  return (
    <Suspense fallback={<SavedView closer="" queued={false} />}>
      <SavedPageInner />
    </Suspense>
  )
}
