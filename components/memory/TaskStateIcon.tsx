/**
 * <TaskStateIcon> — single source of truth for the three task-state
 * glyphs Memory, Home, and Patterns share (US-2.C.3).
 *
 * Colour-blind safety contract: each state's *shape* is distinct, not
 * just its colour:
 *   - 'pending' → empty circle (stroke only)
 *   - 'done'    → circle + check mark
 *   - 'missed'  → circle + diagonal strike
 *
 * The visible glyph carries no text label; an `sr-only` span supplies the
 * state name so screen-reader users read "Pending" / "Done" / "Missed".
 */
import type { TaskState } from './_types'

type Props = {
  state: TaskState
  /** Square size in CSS px. Default 24. */
  size?: number
}

const LABELS: Record<TaskState, string> = {
  pending: 'Pending',
  done: 'Done',
  missed: 'Missed',
}

export function TaskStateIcon({ state, size = 24 }: Props): React.JSX.Element {
  const stroke = state === 'done'
    ? 'var(--sage-deep)'
    : state === 'missed'
      ? 'var(--terracotta)'
      : 'var(--ink-subtle)'

  return (
    <span
      className="inline-flex items-center"
      data-task-state={state}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {/* All states share an outer circle so the glyph reads as a
            consistent token across surfaces. */}
        <circle cx="12" cy="12" r="9" />
        {state === 'done' && (
          // Check mark — distinct shape, not just colour.
          <polyline points="8 12.5 11 15.5 16.5 9.5" />
        )}
        {state === 'missed' && (
          // Diagonal strike — readable without colour.
          <line x1="7.5" y1="16.5" x2="16.5" y2="7.5" />
        )}
      </svg>
      <span className="sr-only">{LABELS[state]}</span>
    </span>
  )
}
