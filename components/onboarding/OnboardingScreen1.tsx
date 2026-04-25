'use client'

/**
 * Onboarding Screen 1 — App name + tagline.
 *
 * Story: Onboarding.US-1 — `/onboarding/1` renders Screen 1; CTA "Next" → `/onboarding/2`.
 *
 * Copy: app name "Saha" is locked; tagline is a placeholder pending Rewant
 * (see `lib/copy/onboarding-placeholders.ts`).
 *
 * Owned by Build-A.
 */

import { useRouter } from 'next/navigation'

import { OnboardingShell } from './OnboardingShell'
import { SCREEN_1_TAGLINE_PLACEHOLDER } from '@/lib/copy/onboarding-placeholders'

const TOTAL_STEPS = 5

export function OnboardingScreen1(): React.JSX.Element {
  const router = useRouter()
  return (
    <OnboardingShell
      step={1}
      total={TOTAL_STEPS}
      illustration={<Illustration />}
      title={<>Saha</>}
      body={<p data-testid="screen-1-tagline">{SCREEN_1_TAGLINE_PLACEHOLDER}</p>}
      ctaLabel="Next"
      onCta={() => router.push('/onboarding/2')}
    />
  )
}

function Illustration(): React.JSX.Element {
  // Sage-soft circular wordmark stand-in; the dedicated illustration cycle
  // will replace this asset.
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-full w-full"
      role="presentation"
      focusable="false"
    >
      <circle cx="48" cy="48" r="44" fill="var(--sage-soft)" />
      <text
        x="48"
        y="58"
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontSize="34"
        fontWeight="500"
        fill="var(--sage-deep)"
      >
        सह
      </text>
    </svg>
  )
}
