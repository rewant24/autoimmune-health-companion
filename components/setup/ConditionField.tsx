'use client'

/**
 * ConditionField — single-select 10 conditions + "Other / not listed" with
 * inline free-text reveal, for Setup B.4.
 *
 * Onboarding Shell cycle, Build-B (Chunk B).
 *
 * - Locked decision Q2: 10 conditions + Other (escape hatch).
 * - Selecting "Other" reveals a free-text input; saving requires the
 *   `conditionOther` to be non-empty (page disables Next via
 *   `isValidCondition`).
 */

import { useId } from 'react'

import type { Condition } from '@/lib/profile/types'

export interface ConditionFieldValue {
  condition: Condition | null
  conditionOther: string | null
}

export interface ConditionFieldProps {
  value: ConditionFieldValue
  onChange: (next: ConditionFieldValue) => void
}

interface Option {
  id: Exclude<Condition, 'other'>
  label: string
}

/**
 * Locked label set — must match the marketing landing page (`app/LandingPage.tsx`).
 * Order is the same as scoping.
 */
export const CONDITION_OPTIONS: readonly Option[] = [
  { id: 'lupus', label: 'Lupus' },
  { id: 'rheumatoid-arthritis', label: 'Rheumatoid arthritis' },
  { id: 'hashimotos', label: "Hashimoto's" },
  { id: 'multiple-sclerosis', label: 'Multiple sclerosis' },
  { id: 'crohns', label: "Crohn's" },
  { id: 'psoriasis', label: 'Psoriasis' },
  { id: 'sjogrens', label: "Sjögren's" },
  { id: 'ankylosing-spondylitis', label: 'Ankylosing spondylitis' },
  { id: 'type-1-diabetes', label: 'Type 1 diabetes' },
  { id: 'celiac', label: 'Celiac' },
] as const

export function ConditionField({
  value,
  onChange,
}: ConditionFieldProps): React.JSX.Element {
  const groupId = useId()
  const otherInputId = useId()
  const isOther = value.condition === 'other'

  const select = (next: Condition) => {
    if (next === 'other') {
      onChange({ condition: 'other', conditionOther: value.conditionOther ?? '' })
    } else {
      // Drop any prior other-text when switching off Other.
      onChange({ condition: next, conditionOther: null })
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="condition-field">
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className="flex flex-col gap-2"
      >
        <span id={groupId} className="type-label text-[var(--ink-muted)]">
          Which condition are you living with?
        </span>
        {CONDITION_OPTIONS.map((opt) => (
          <ConditionRow
            key={opt.id}
            id={opt.id}
            label={opt.label}
            selected={value.condition === opt.id}
            onSelect={() => select(opt.id)}
          />
        ))}
        <ConditionRow
          id="other"
          label="Other / not listed"
          selected={isOther}
          onSelect={() => select('other')}
        />
      </div>

      {isOther && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={otherInputId}
            className="type-label text-[var(--ink-muted)]"
          >
            Tell us what you're living with
          </label>
          <input
            id={otherInputId}
            type="text"
            autoFocus
            value={value.conditionOther ?? ''}
            onChange={(e) =>
              onChange({ condition: 'other', conditionOther: e.target.value })
            }
            data-testid="condition-other-input"
            className={
              'h-12 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg-card)] ' +
              'px-4 text-base text-[var(--ink)] placeholder:text-[var(--ink-subtle)] ' +
              'focus:border-[var(--sage-deep)] focus:outline-none focus:ring-2 ' +
              'focus:ring-[var(--sage-soft)]'
            }
          />
        </div>
      )}
    </div>
  )
}

interface ConditionRowProps {
  id: Condition
  label: string
  selected: boolean
  onSelect: () => void
}

function ConditionRow({
  id,
  label,
  selected,
  onSelect,
}: ConditionRowProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={`condition-option-${id}`}
      data-selected={selected}
      className={
        'flex h-12 w-full items-center justify-between rounded-lg border ' +
        'px-4 text-left text-base transition-colors ' +
        (selected
          ? 'border-[var(--sage-deep)] bg-[var(--sage-soft)] text-[var(--ink)]'
          : 'border-[var(--rule)] bg-[var(--bg-card)] text-[var(--ink)] hover:border-[var(--sage)]')
      }
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={
          'inline-flex h-5 w-5 items-center justify-center rounded-full border ' +
          (selected
            ? 'border-[var(--sage-deep)] bg-[var(--sage-deep)]'
            : 'border-[var(--rule)]')
        }
      >
        {selected && (
          <span className="h-2 w-2 rounded-full bg-[var(--bg-elevated)]" />
        )}
      </span>
    </button>
  )
}

export function isValidCondition(value: ConditionFieldValue): boolean {
  if (value.condition === null) return false
  if (value.condition === 'other') {
    return (
      value.conditionOther !== null &&
      value.conditionOther.trim().length > 0
    )
  }
  return true
}
