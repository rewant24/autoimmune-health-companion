'use client'

/**
 * /home — first product surface after onboarding completes.
 *
 * Onboarding Shell cycle, Chunk C, Home.US-1 + Home.US-2.
 *
 * Composition top-to-bottom:
 *   - <HomeGreeting />       — "Welcome, [name]" personalized.
 *   - <CheckInPromptCard />  — primary CTA → /check-in.
 *   - <MedsSetupNudgeCard /> — disabled nudge (Q6).
 *   - <MetricVizPlaceholder />— Q4 placeholder; real viz is F03.
 *   - <BottomNav />          — 5-pillar nav (Q5: only here this cycle).
 *
 * Direct-link guard (Home.US-2): if `readProfile()?.onboarded !== true`,
 * redirect to /onboarding/1. Runs in an effect so SSR doesn't access
 * localStorage; first paint shows nothing while we decide.
 */

import { useOnboardingGuard } from '@/lib/auth/use-onboarding-guard'
import { BottomNav } from '@/components/nav/BottomNav'
import { CheckInPromptCard } from '@/components/home/CheckInPromptCard'
import { HomeGreeting } from '@/components/home/HomeGreeting'
import { IntakeTapList } from '@/components/home/IntakeTapList'
import { MedsSetupNudgeCard } from '@/components/home/MedsSetupNudgeCard'
import { MetricVizPlaceholder } from '@/components/home/MetricVizPlaceholder'

export default function HomePage(): React.JSX.Element {
  const allowed = useOnboardingGuard()

  if (!allowed) {
    // Blank shell while the guard runs — avoids a flash of content for
    // un-onboarded users.
    return (
      <main
        data-testid="home-page-pending"
        className="grain min-h-screen"
        style={{ background: 'var(--bg)' }}
      />
    )
  }

  return (
    <main
      data-testid="home-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <HomeGreeting />
        <CheckInPromptCard />
        {/* SPRINT_F04_NUDGE_SLOT — chunk 4.B updates MedsSetupNudgeCard
            (or replaces with a live regimen-aware variant) so it hides
            once `listActiveMedications` returns ≥1. */}
        <MedsSetupNudgeCard />
        <IntakeTapList />
        <MetricVizPlaceholder />
      </div>
      <BottomNav />
    </main>
  )
}
