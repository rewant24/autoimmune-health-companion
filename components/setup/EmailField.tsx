'use client'

/**
 * EmailField — single email input for Setup B.3.
 *
 * Onboarding Shell cycle, Build-B (Chunk B).
 *
 * Validation: HTML5 `type="email"` + lightweight regex `/^\S+@\S+\.\S+$/`
 * (per cycle plan; second-pass reviewer can request stricter validation).
 */

import { useId } from 'react'

export interface EmailFieldProps {
  value: string
  onChange: (next: string) => void
  onSubmit?: () => void
  autoFocus?: boolean
}

export function EmailField({
  value,
  onChange,
  onSubmit,
  autoFocus,
}: EmailFieldProps): React.JSX.Element {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-label text-[var(--ink-muted)]">
        Email
      </label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        inputMode="email"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault()
            onSubmit()
          }
        }}
        data-testid="email-input"
        className={
          'h-12 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
          'px-4 text-base text-[var(--ink)] placeholder:text-[var(--ink-subtle)] ' +
          'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-2 ' +
          'focus:ring-[var(--sage-soft)]'
        }
      />
    </div>
  )
}

// Stricter than the prior /^\S+@\S+\.\S+$/ — that accepted `a@b@c.d` because
// `\S` matches `@`. Local + domain must each be one-or-more non-whitespace,
// non-`@` chars, with a dot before the TLD chunk.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Pure validity check. Trims before matching. */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim())
}
