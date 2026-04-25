'use client'

/**
 * Onboarding Screen 3 — Agency framing (locked headline already fits voice).
 *
 * Story: Onboarding.US-3 — Locked headline *"You take command of your own
 * life."* Already fits the Saha "endurance + together" voice. Body copy is
 * a placeholder pending Rewant.
 *
 * CTA "Next" → `/onboarding/4`.
 *
 * Owned by Build-A.
 */

import { useRouter } from 'next/navigation'

import { OnboardingShell } from './OnboardingShell'
import { SCREEN_3_BODY_PLACEHOLDER } from '@/lib/copy/onboarding-placeholders'

const TOTAL_STEPS = 5

// Locked from scoping § Onboarding Screen 3.
const SCREEN_3_HEADLINE = 'You take command of your own life.'

export function OnboardingScreen3(): React.JSX.Element {
  const router = useRouter()
  return (
    <OnboardingShell
      step={3}
      total={TOTAL_STEPS}
      illustration={<Illustration />}
      title={<>{SCREEN_3_HEADLINE}</>}
      body={<p data-testid="screen-3-body">{SCREEN_3_BODY_PLACEHOLDER}</p>}
      ctaLabel="Next"
      onCta={() => router.push('/onboarding/4')}
    />
  )
}

function Illustration(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-full w-full"
      role="presentation"
      focusable="false"
    >
      <circle cx="48" cy="48" r="40" fill="var(--sage-soft)" />
      <path
        d="M28 56 L44 40 L56 52 L68 32"
        fill="none"
        stroke="var(--sage-deep)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="68" cy="32" r="3.5" fill="var(--terracotta)" />
    </svg>
  )
}
