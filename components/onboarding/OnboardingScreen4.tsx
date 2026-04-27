'use client'

/**
 * Onboarding Screen 4 — Voice check-in (Saha first-person).
 *
 * Story: Onboarding.US-4 — Locked verbatim from scoping § Screen 4.
 * Brand-voice note: copy was authored under the prior "gentle" framing
 * but was re-validated under the Saha "endurance + together" voice
 * during the cycle fix-pass and approved by Rewant as-is.
 *
 * CTA "Next" → `/onboarding/5`.
 *
 * Owned by Build-A.
 */

import { useRouter } from 'next/navigation'

import { OnboardingShell } from './OnboardingShell'

const TOTAL_STEPS = 5

// Locked verbatim from scoping § Onboarding Screen 4.
const SCREEN_4_TITLE = 'Talk to me. I\u2019ll remember.'
const SCREEN_4_BODY =
  'One minute a day. You talk \u2014 about how you slept, what hurt, what\u2019s different today. I listen, I keep the record, and you never have to be your own logbook again.'

export function OnboardingScreen4(): React.JSX.Element {
  const router = useRouter()
  return (
    <OnboardingShell
      step={4}
      total={TOTAL_STEPS}
      illustration={<Illustration />}
      title={<>{SCREEN_4_TITLE}</>}
      body={<p data-testid="screen-4-body">{SCREEN_4_BODY}</p>}
      ctaLabel="Next"
      onCta={() => router.push('/onboarding/5')}
    />
  )
}

function Illustration(): React.JSX.Element {
  // Mic-with-soundwave glyph — Saha voice loop.
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-full w-full"
      role="presentation"
      focusable="false"
    >
      <rect
        x="40"
        y="20"
        width="16"
        height="36"
        rx="8"
        fill="var(--sage-deep)"
      />
      <path
        d="M30 50 a18 18 0 0 0 36 0"
        fill="none"
        stroke="var(--sage-deep)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line x1="48" y1="68" x2="48" y2="78" stroke="var(--sage-deep)" strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="38" x2="14" y2="38" stroke="var(--terracotta)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="48" x2="12" y2="48" stroke="var(--terracotta)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="20" y1="58" x2="14" y2="58" stroke="var(--terracotta)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="76" y1="38" x2="82" y2="38" stroke="var(--terracotta)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="74" y1="48" x2="84" y2="48" stroke="var(--terracotta)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="76" y1="58" x2="82" y2="58" stroke="var(--terracotta)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
