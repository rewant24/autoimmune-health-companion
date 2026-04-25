/**
 * /onboarding/[step] — dynamic-segment route for the 5 onboarding screens.
 *
 * Story: Onboarding.US-1 — invalid steps (`/onboarding/0`, `/onboarding/6`,
 * `/onboarding/abc`) redirect to `/onboarding/1`. Valid steps 1–5 render
 * the matching screen component.
 *
 * Server component (no client hooks here — the per-screen components own
 * their navigation via `useRouter`). `redirect()` from `next/navigation` is
 * the standard App Router server-side redirect.
 *
 * Owned by Build-A.
 */

import { redirect } from 'next/navigation'

import { OnboardingScreen1 } from '@/components/onboarding/OnboardingScreen1'
import { OnboardingScreen2 } from '@/components/onboarding/OnboardingScreen2'
import { OnboardingScreen3 } from '@/components/onboarding/OnboardingScreen3'
import { OnboardingScreen4 } from '@/components/onboarding/OnboardingScreen4'
import { OnboardingScreen5 } from '@/components/onboarding/OnboardingScreen5'

export interface OnboardingStepPageProps {
  // Next 16 App Router: dynamic params are an async-resolved object.
  params: Promise<{ step: string }>
}

export default async function OnboardingStepPage(
  props: OnboardingStepPageProps,
): Promise<React.JSX.Element> {
  const { step } = await props.params

  switch (step) {
    case '1':
      return <OnboardingScreen1 />
    case '2':
      return <OnboardingScreen2 />
    case '3':
      return <OnboardingScreen3 />
    case '4':
      return <OnboardingScreen4 />
    case '5':
      return <OnboardingScreen5 />
    default:
      redirect('/onboarding/1')
  }
}
