'use client'

/**
 * MedsSetupNudgeCard — setup-meds nudge on /home.
 *
 * Originally shipped (Onboarding Shell cycle, Chunk C, Home.US-1) as a
 * non-interactive faded card per Q6 — Medications setup didn't exist yet.
 *
 * F04 Cycle 1, Chunk 4.B, US-4.B.1 extension (2026-04-30):
 *   - Card is now interactive: a real CTA routes to `/medications/setup`.
 *   - The card hides itself once `listActiveMedications` returns ≥1.
 *   - While the Convex query is loading (returns `undefined`), we render
 *     the card in its original faded shape so the home page doesn't flash
 *     between two card states.
 */

import Link from 'next/link'
import { useQuery } from 'convex/react'

import { api } from '@/convex/_generated/api'
import { useUserId } from '@/lib/auth/use-user-id'

export function MedsSetupNudgeCard(): React.JSX.Element | null {
  const userId = useUserId()

  const meds = useQuery(
    api.medications.listActiveMedications,
    userId === null ? 'skip' : { userId },
  ) as Array<{ _id: string }> | undefined

  // Hide entirely once at least one active medication exists.
  if (Array.isArray(meds) && meds.length > 0) {
    return null
  }

  // Loading or empty: render the nudge. While loading we keep the original
  // faded look so the surface doesn't pop in/out once data arrives.
  const isLoading = meds === undefined

  return (
    <section
      data-testid="meds-setup-nudge"
      className="mx-6 mt-4 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        opacity: isLoading ? 0.55 : 1,
      }}
    >
      <p className="type-label">Medications</p>
      <h2
        className="mt-3"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: '1.25rem',
          lineHeight: 1.2,
          fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          color: 'var(--ink)',
        }}
      >
        Set up your medications
      </h2>
      <p
        className="type-body mt-3"
        style={{ color: 'var(--ink-muted)' }}
      >
        So I can track your doses with you.
      </p>
      {isLoading ? null : (
        <div className="mt-4">
          <Link
            href="/medications/setup"
            data-testid="meds-setup-nudge-cta"
            className={
              'inline-flex min-h-12 items-center justify-center rounded-full ' +
              'px-6 text-[15px] font-medium transition-colors ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
            }
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            Set up
          </Link>
        </div>
      )}
    </section>
  )
}
