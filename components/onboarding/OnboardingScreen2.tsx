'use client'

/**
 * Onboarding Screen 2 — Doctor-visit framing.
 *
 * Story: Onboarding.US-2.
 *
 * Headline note: the original scoping line ("A digital friend for the
 * day-to-day…") was authored under the prior "gentle" framing. R1
 * supplied a Saha-voice rewrite during the cycle fix-pass; approved by
 * Rewant. The new line keeps the same job (memory-burden → data) but in
 * the "endurance + together" register.
 *
 * CTA "Next" → `/onboarding/3`.
 *
 * Owned by Build-A.
 */

import { useRouter } from 'next/navigation'

import { OnboardingShell } from './OnboardingShell'
import { SCREEN_2_BODY_PLACEHOLDER } from '@/lib/copy/onboarding-placeholders'

const TOTAL_STEPS = 5

// R1 Saha-voice rewrite (approved by Rewant in fix-pass).
const SCREEN_2_HEADLINE =
  'Living with autoimmune asks a lot of memory. Saha holds the record — so you walk into every doctor visit with data, not guesses.'

export function OnboardingScreen2(): React.JSX.Element {
  const router = useRouter()
  return (
    <OnboardingShell
      step={2}
      total={TOTAL_STEPS}
      illustration={<Illustration />}
      title={<>{SCREEN_2_HEADLINE}</>}
      body={<p data-testid="screen-2-body">{SCREEN_2_BODY_PLACEHOLDER}</p>}
      ctaLabel="Next"
      onCta={() => router.push('/onboarding/3')}
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
      <rect
        x="18"
        y="14"
        width="60"
        height="68"
        rx="6"
        fill="var(--bg-card)"
        stroke="var(--sage-deep)"
        strokeWidth="2"
      />
      <line x1="28" y1="32" x2="68" y2="32" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="44" x2="60" y2="44" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="56" x2="64" y2="56" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="68" x2="52" y2="68" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
