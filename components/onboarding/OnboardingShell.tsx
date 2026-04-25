'use client'

/**
 * OnboardingShell — shared layout for /onboarding/[step] screens.
 *
 * Provides:
 *   - Pastel tinted background (matches landing-page tokens: warm cream
 *     ground + sage/terracotta radial washes + grain texture).
 *   - Illustration slot (caller-supplied small inline SVG / emoji).
 *   - Title slot (display serif — Fraunces).
 *   - Body slot (Inter body copy).
 *   - Sticky-bottom Next CTA — caller supplies label + onClick.
 *   - Progress dots (`step / total`) with `aria-label` on the group.
 *
 * Design tokens inherited from `app/globals.css` and `app/LandingPage.tsx`.
 *
 * Owned by Build-A — Onboarding Shell cycle, Wave 1, Chunk A.
 */

import type { ReactNode } from 'react'

export interface OnboardingShellProps {
  /** 1-based step index. */
  step: number
  /** Total step count — for progress dots + screen-reader announcement. */
  total: number
  /** Small inline visual — SVG or emoji. Decorative only. */
  illustration: ReactNode
  /** Display-serif title. */
  title: ReactNode
  /** Body copy (1–2 sentences typical). */
  body: ReactNode
  /** Sticky-bottom CTA label — usually "Next"; Screen 5 overrides. */
  ctaLabel: string
  /** Sticky-bottom CTA handler. */
  onCta: () => void
}

export function OnboardingShell(props: OnboardingShellProps): React.JSX.Element {
  const { step, total, illustration, title, body, ctaLabel, onCta } = props

  return (
    <div
      data-testid="onboarding-shell"
      data-step={step}
      className="grain relative min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      {/* Pastel tinted wash — matches landing-page hero gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 90% 10%, rgba(197, 133, 107, 0.18) 0%, rgba(197, 133, 107, 0) 60%), radial-gradient(50% 38% at 8% 28%, rgba(92, 138, 127, 0.18) 0%, rgba(92, 138, 127, 0) 60%)',
        }}
      />

      <main
        className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pt-10 pb-32 sm:max-w-lg sm:pt-16"
        style={{
          // Reserve bottom padding so the sticky CTA + iOS safe-area inset
          // never overlap the body content.
          paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Progress dots — top of the screen. */}
        <ProgressDots step={step} total={total} />

        <div className="mt-10 flex flex-1 flex-col items-center text-center sm:mt-14">
          <div
            data-testid="onboarding-illustration"
            aria-hidden="true"
            className="mb-8 flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40"
          >
            {illustration}
          </div>

          <h1 className="type-display-md mb-5 max-w-md text-balance">{title}</h1>

          <div className="type-body-lg max-w-md text-balance">{body}</div>
        </div>
      </main>

      {/* Sticky-bottom CTA. */}
      <div
        className="fixed inset-x-0 bottom-0 z-20"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background:
            'linear-gradient(to top, var(--bg) 65%, rgba(246, 241, 232, 0))',
        }}
      >
        <div className="mx-auto w-full max-w-md px-6 pt-6 pb-6 sm:max-w-lg">
          <button
            type="button"
            onClick={onCta}
            data-testid="onboarding-cta"
            className="w-full rounded-full px-6 py-4 text-base font-medium transition-colors"
            style={{
              background: 'var(--sage-deep)',
              color: '#FCF9F3',
              minHeight: '52px',
            }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ProgressDotsProps {
  step: number
  total: number
}

function ProgressDots({ step, total }: ProgressDotsProps): React.JSX.Element {
  const dots: number[] = []
  for (let i = 1; i <= total; i++) dots.push(i)
  return (
    <div
      role="group"
      aria-label={`Step ${step} of ${total}`}
      data-testid="onboarding-progress"
      className="flex items-center justify-center gap-2"
    >
      {dots.map((i) => {
        const isActive = i === step
        const isPast = i < step
        return (
          <span
            key={i}
            aria-hidden="true"
            data-active={isActive ? 'true' : 'false'}
            data-past={isPast ? 'true' : 'false'}
            className="h-2 rounded-full transition-all"
            style={{
              width: isActive ? '1.5rem' : '0.5rem',
              background:
                isActive || isPast ? 'var(--sage-deep)' : 'var(--rule)',
              opacity: isActive ? 1 : isPast ? 0.7 : 1,
            }}
          />
        )
      })}
    </div>
  )
}
