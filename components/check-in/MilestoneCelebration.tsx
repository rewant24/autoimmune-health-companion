'use client'

/**
 * MilestoneCelebration — Whoop-style ring-stack overlay for day-1 / day-7 /
 * day-30 / day-90 / day-180 / day-365 streak markers.
 *
 * Feature 01, Cycle 2, Chunk 2.F, story Milestone.US-1.J.4.
 *
 * Visual rules (locked in the cycle plan):
 *   - One ring per day for day-1 / day-7 / day-30.
 *   - day-90 / day-180 / day-365 cap at 30 displayed rings (5×6 grid) — a
 *     denser visual cluster prevents the overlay from blowing past the
 *     viewport. The ring count beyond the cap is reflected in the
 *     `data-day-count` attribute so analytics can read the true value.
 *   - Animation total ≤ 2s. CSS-only, no JS animation runtime.
 *   - `prefers-reduced-motion`: collapses to a static fully-filled grid
 *     (no animation class, `data-reduced-motion="true"`).
 *
 * The component is dumb. The orchestrator passes:
 *   - `kind`: the MilestoneKind from `detectMilestone(...)`
 *   - `closerText`: the closer for this `ContinuityState` snapshot
 *   - `onContinue`: dispatches `CELEBRATION_DONE` → routes to
 *     `/check-in/saved`
 *   - `prefersReducedMotion`: derived once on the page from
 *     `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. We
 *     accept it as a prop rather than read it here so SSR is deterministic
 *     and so jsdom-driven tests don't need a matchMedia polyfill.
 */

import { useEffect, useRef } from 'react'

import type { MilestoneKind } from '@/lib/checkin/types'

const DAY_COUNT_FOR_KIND: Record<MilestoneKind, number> = {
  'day-1': 1,
  'day-7': 7,
  'day-30': 30,
  'day-90': 90,
  'day-180': 180,
  'day-365': 365,
}

const RING_VISUAL_CAP = 30

/**
 * Friendly aria-label per milestone kind. Avoid "day-30 milestone"
 * jargon — screen readers should announce "30-day streak celebration".
 * `day-1` reads as "first check-in" since it isn't a streak yet.
 */
const ARIA_LABEL_FOR_KIND: Record<MilestoneKind, string> = {
  'day-1': 'First check-in celebration',
  'day-7': '7-day streak celebration',
  'day-30': '30-day streak celebration',
  'day-90': '90-day streak celebration',
  'day-180': '180-day streak celebration',
  'day-365': '365-day streak celebration',
}

/**
 * Visible tier label. day-30/90/180/365 all render the same 30-ring
 * grid (cap), so without this label the four longer milestones look
 * identical. The label is also the only place the actual day count is
 * surfaced for `day-90` / `day-180` / `day-365`.
 */
const TIER_LABEL_FOR_KIND: Record<MilestoneKind, string> = {
  'day-1': 'Day 1',
  'day-7': '7 days',
  'day-30': '30 days',
  'day-90': '90 days',
  'day-180': '180 days',
  'day-365': '365 days',
}

export interface MilestoneCelebrationProps {
  kind: MilestoneKind
  closerText: string
  onContinue: () => void
  prefersReducedMotion?: boolean
}

export function MilestoneCelebration({
  kind,
  closerText,
  onContinue,
  prefersReducedMotion = false,
}: MilestoneCelebrationProps): React.JSX.Element {
  const dayCount = DAY_COUNT_FOR_KIND[kind]
  const ringCount = Math.min(dayCount, RING_VISUAL_CAP)
  const reducedAttr = prefersReducedMotion ? 'true' : 'false'
  const continueButtonRef = useRef<HTMLButtonElement | null>(null)

  // Move focus to the continue button on mount — without this, focus
  // stays on whatever was focused before the overlay opened (often the
  // ConfirmSummary save button, now hidden), which strands keyboard
  // and screen-reader users outside the dialog.
  useEffect(() => {
    continueButtonRef.current?.focus()
  }, [])

  return (
    <section
      data-testid="milestone-celebration"
      data-kind={kind}
      data-day-count={dayCount}
      role="dialog"
      aria-modal="true"
      aria-label={ARIA_LABEL_FOR_KIND[kind]}
      className={
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 ' +
        'bg-white/95 px-6 backdrop-blur dark:bg-zinc-950/95'
      }
    >
      <h2
        className="text-center text-lg font-medium text-zinc-900 dark:text-zinc-50"
        // Closer text is rendered as the heading per spec.
      >
        {closerText}
      </h2>

      <p
        data-testid="milestone-tier-label"
        className="text-center text-sm font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300"
      >
        {TIER_LABEL_FOR_KIND[kind]}
      </p>

      <div
        data-testid="milestone-ring-stack"
        data-reduced-motion={reducedAttr}
        className={
          'grid max-w-xs gap-2 ' +
          (ringCount <= 7 ? 'grid-cols-7 ' : 'grid-cols-5 ')
        }
      >
        {Array.from({ length: ringCount }, (_, i) => (
          <span
            key={i}
            data-testid="milestone-ring"
            data-filled={prefersReducedMotion ? 'true' : 'false'}
            style={prefersReducedMotion ? undefined : { animationDelay: `${i * 40}ms` }}
            className={
              'block h-6 w-6 rounded-full border-2 border-teal-600 ' +
              (prefersReducedMotion
                ? 'bg-teal-600 '
                : 'milestone-ring-animate ')
            }
          />
        ))}
      </div>

      <button
        ref={continueButtonRef}
        type="button"
        onClick={onContinue}
        className={
          'inline-flex min-h-12 items-center justify-center rounded-full ' +
          'bg-teal-700 px-8 text-sm font-semibold text-white shadow-sm ' +
          'transition hover:bg-teal-800 focus-visible:outline-none ' +
          'focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2'
        }
      >
        Keep going
      </button>

      {/*
        CSS keyframes scoped to this component. Total animation ≤ 2s when the
        last ring fires (cap = 30 rings × 40ms delay = 1.2s + 0.6s fill = 1.8s).
      */}
      <style>{`
        @keyframes milestone-ring-fill {
          0% {
            background-color: transparent;
            transform: scale(0.8);
            opacity: 0;
          }
          60% {
            opacity: 1;
          }
          100% {
            background-color: rgb(13 148 136);
            transform: scale(1);
            opacity: 1;
          }
        }
        .milestone-ring-animate {
          animation: milestone-ring-fill 0.6s ease-out forwards;
        }
      `}</style>
    </section>
  )
}
