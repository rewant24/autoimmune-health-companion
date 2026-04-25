'use client'

/**
 * NameField — single text input for Setup B.1.
 *
 * Onboarding Shell cycle, Build-B (Chunk B).
 *
 * Label: *"What should Saha call you?"* (locked, friend-voice — fits the
 * "with you" framing per scoping § Setup B).
 */

import { useId } from 'react'

export interface NameFieldProps {
  value: string
  onChange: (next: string) => void
  /** Submit on Enter — page wires this to advance when valid. */
  onSubmit?: () => void
  autoFocus?: boolean
}

export function NameField({
  value,
  onChange,
  onSubmit,
  autoFocus,
}: NameFieldProps): React.JSX.Element {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-label text-[var(--ink-muted)]">
        What should Saha call you?
      </label>
      <input
        id={id}
        type="text"
        autoComplete="given-name"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault()
            onSubmit()
          }
        }}
        data-testid="name-input"
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

/** Pure validity check — exported so pages can decide CTA disabled state. */
export function isValidName(value: string): boolean {
  return value.trim().length > 0
}
