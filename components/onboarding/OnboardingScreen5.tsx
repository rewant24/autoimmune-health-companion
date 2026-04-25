'use client'

/**
 * Onboarding Screen 5 — Memory + Patterns (Saha first-person, final screen).
 *
 * Story: Onboarding.US-5 — Locked verbatim from scoping § Screen 5.
 * Reviewer note: copy was authored under prior "Saumya / gentle"
 * framing. Reviewer-1 must flag for Rewant to confirm under Saha
 * "endurance + together" voice or supply a rewrite via TODO(rewant-copy).
 *
 * CTA "Start my first check-in" → `/setup/name` (per Q1 lock: skip Setup A).
 *
 * Owned by Build-A.
 */

import { useRouter } from 'next/navigation'

import { OnboardingShell } from './OnboardingShell'

const TOTAL_STEPS = 5

// Locked verbatim from scoping § Onboarding Screen 5.
const SCREEN_5_TITLE = 'Look back. See what\u2019s changed.'
const SCREEN_5_BODY =
  'Week to week, the bad days blur into the okay ones \u2014 and you lose the thread. I hold the record, so when you want to see how this month compares to last, you actually can.'

export function OnboardingScreen5(): React.JSX.Element {
  const router = useRouter()
  return (
    <OnboardingShell
      step={5}
      total={TOTAL_STEPS}
      illustration={<Illustration />}
      title={<>{SCREEN_5_TITLE}</>}
      body={<p data-testid="screen-5-body">{SCREEN_5_BODY}</p>}
      ctaLabel="Start my first check-in"
      onCta={() => router.push('/setup/name')}
    />
  )
}

function Illustration(): React.JSX.Element {
  // Tiny line-chart over a calendar-grid hint — Memory + Patterns motif.
  return (
    <svg
      viewBox="0 0 96 96"
      className="h-full w-full"
      role="presentation"
      focusable="false"
    >
      <rect x="14" y="20" width="68" height="56" rx="4" fill="var(--bg-card)" stroke="var(--sage-deep)" strokeWidth="2" />
      <line x1="14" y1="34" x2="82" y2="34" stroke="var(--rule)" strokeWidth="1" />
      {[26, 38, 50, 62, 74].map((x) => (
        <line key={x} x1={x} y1="34" x2={x} y2="76" stroke="var(--rule)" strokeWidth="1" />
      ))}
      <polyline
        points="22,62 34,54 46,58 58,42 70,48 78,40"
        fill="none"
        stroke="var(--sage-deep)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="78" cy="40" r="3" fill="var(--terracotta)" />
    </svg>
  )
}
