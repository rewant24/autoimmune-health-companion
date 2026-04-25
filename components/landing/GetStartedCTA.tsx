'use client'

/**
 * GetStartedCTA — primary hero CTA on the marketing landing page.
 *
 * Onboarding Shell cycle, Chunk C, Landing.US-1.
 *
 * Behaviour:
 *   - Pre-hydration / SSR default: label "Get started", target /onboarding/1.
 *   - Post-hydration: reads `readProfile()?.onboarded`. If true, label flips
 *     to "Open your home page" and target becomes /home.
 *   - Existing waitlist email-capture is unchanged — this CTA augments the
 *     hero, it does not replace the form (target audience is split: prospects
 *     keep using the form; onboarded users get a fast path back).
 *
 * Diff guard for `app/LandingPage.tsx`: this component is the ONLY new
 * insertion in that file. No other section is modified.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { readProfile } from '@/lib/profile/storage'

export function GetStartedCTA(): React.JSX.Element {
  const [onboarded, setOnboarded] = useState<boolean>(false)

  useEffect(() => {
    const profile = readProfile()
    setOnboarded(profile?.onboarded === true)
  }, [])

  const href = onboarded ? '/home' : '/onboarding/1'
  const label = onboarded ? 'Open your home page' : 'Get started'

  return (
    <Link
      href={href}
      data-testid="landing-get-started-cta"
      data-onboarded={onboarded ? 'true' : 'false'}
      className={
        'inline-flex min-h-12 items-center justify-center rounded-full ' +
        'px-7 text-[15px] font-medium transition-colors ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
      }
      style={{
        background: 'var(--sage-deep)',
        color: 'var(--bg-elevated)',
      }}
    >
      {label}
    </Link>
  )
}
