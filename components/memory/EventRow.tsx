/**
 * <EventRow> — one row in a day section (US-2.C.2).
 *
 * Layout: TaskStateIcon (24px) → time (HH:MM, tabular nums) → title +
 * meta line stacked. Entire row is a <button> so click + keyboard come
 * for free; a visible focus ring is part of the contract. Reduced-motion
 * users get no entrance animation (we simply don't add one).
 */
import type { MemoryEvent, TaskState } from './_types'
import { TaskStateIcon } from './TaskStateIcon'

type Props = {
  event: MemoryEvent
  onTap?: (eventId: string) => void
}

const STATE_LABELS: Record<TaskState, string> = {
  pending: 'Pending',
  done: 'Done',
  missed: 'Missed',
}

export function EventRow({ event, onTap }: Props): React.JSX.Element {
  const ariaLabel = `${event.time}, ${event.title}, ${STATE_LABELS[event.taskState]}`
  return (
    <button
      type="button"
      onClick={() => onTap?.(event.eventId)}
      aria-label={ariaLabel}
      data-event-id={event.eventId}
      data-event-type={event.type}
      data-task-state={event.taskState}
      className={[
        'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left',
        'min-h-[72px]',
        'bg-transparent hover:bg-[var(--bg-card)]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sage)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        'transition-colors',
      ].join(' ')}
    >
      <span className="mt-0.5 shrink-0">
        <TaskStateIcon state={event.taskState} size={24} />
      </span>
      <span
        className="shrink-0 pt-0.5 text-sm tabular-nums text-[var(--ink-subtle)]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {event.time}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base text-[var(--ink)]">
          {event.title}
        </span>
        {event.meta && (
          <span className="truncate text-sm text-[var(--ink-subtle)]">
            {event.meta}
          </span>
        )}
      </span>
    </button>
  )
}
