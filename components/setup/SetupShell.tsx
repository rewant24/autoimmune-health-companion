'use client'

/**
 * SetupShell — shared layout for the four Setup B screens
 * (/setup/{name,dob,email,condition}).
 *
 * Onboarding Shell cycle, Build-B (Chunk B).
 *
 * Renders:
 *   - progress dots (`step / 4`, with the active dot highlighted)
 *   - a heading slot + body field slot
 *   - a sticky-bottom Next button that the page disables when the field is
 *     invalid (page passes `disabled` + `onNext`)
 *
 * Mobile-first. Uses the project's design tokens (sage palette + Fraunces
 * for display copy + Inter for body — see app/globals.css).
 */

import type { ReactNode } from 'react'

export interface SetupShellProps {
  /** 1-indexed; 1..4. */
  step: 1 | 2 | 3 | 4
  /** Display heading shown above the field. */
  heading: string
  /** Optional supporting line under the heading. */
  subhead?: string
  /** The interactive field (input, dropdowns, list). */
  children: ReactNode
  /** Disabled state for the Next button (driven by field validity). */
  disabled: boolean
  /** Triggered when the user taps Next. */
  onNext: () => void
  /** CTA label override (defaults to "Next"). */
  nextLabel?: string
}

const TOTAL_STEPS = 4

export function SetupShell({
  step,
  heading,
  subhead,
  children,
  disabled,
  onNext,
  nextLabel = 'Next',
}: SetupShellProps): React.JSX.Element {
  return (
    <main
      data-testid="setup-screen"
      data-setup-step={step}
      className={
        'flex min-h-[100svh] w-full flex-col bg-[var(--bg)] text-[var(--ink)] ' +
        '[padding-top:max(1.5rem,env(safe-area-inset-top))] ' +
        '[padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]'
      }
    >
      <div className="flex flex-1 flex-col gap-6 px-6 pt-6 pb-32">
        <ProgressDots step={step} />
        <header className="flex flex-col gap-2">
          <h1 className="type-display-md">{heading}</h1>
          {subhead && (
            <p className="type-body-lg text-[var(--ink-muted)]">{subhead}</p>
          )}
        </header>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
      <div
        className={
          'sticky bottom-0 left-0 right-0 z-10 border-t border-[var(--rule)] ' +
          'bg-[var(--bg)]/90 px-6 py-4 backdrop-blur ' +
          '[padding-bottom:max(1rem,env(safe-area-inset-bottom))]'
        }
      >
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          aria-disabled={disabled}
          data-testid="setup-next"
          className={
            'flex h-12 w-full items-center justify-center rounded-full ' +
            'bg-[var(--sage-deep)] text-[var(--bg-elevated)] font-medium ' +
            'transition-opacity duration-150 ' +
            'disabled:cursor-not-allowed disabled:opacity-40'
          }
        >
          {nextLabel}
        </button>
      </div>
    </main>
  )
}

interface ProgressDotsProps {
  step: 1 | 2 | 3 | 4
}

function ProgressDots({ step }: ProgressDotsProps): React.JSX.Element {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuenow={step}
      aria-label={`Step ${step} of ${TOTAL_STEPS}`}
      data-testid="setup-progress"
      className="flex items-center gap-2"
    >
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
        const active = n === step
        const completed = n < step
        return (
          <span
            key={n}
            data-active={active}
            data-completed={completed}
            className={
              'h-1.5 w-8 rounded-full transition-colors ' +
              (active
                ? 'bg-[var(--sage-deep)]'
                : completed
                ? 'bg-[var(--sage)]'
                : 'bg-[var(--rule)]')
            }
          />
        )
      })}
    </div>
  )
}
