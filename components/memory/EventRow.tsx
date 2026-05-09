'use client'

/**
 * <EventRow> — one row in a day section (US-2.C.2).
 *
 * Layout: TaskStateIcon (24px) → time (HH:MM, tabular nums) → title +
 * meta line stacked, plus an optional type-pill badge (DR VISIT,
 * BLOOD WORK) on the right edge for F05 events. Entire row is a <button>
 * so click + keyboard come for free; a visible focus ring is part of the
 * contract. Reduced-motion users get no entrance animation.
 *
 * Tap-to-detail routing (F05 chunk 5.C, US-5.C.3):
 *   - visit       → /visits/[visitId]
 *   - blood-work  → /blood-work/[bloodWorkId]
 *   - other types → fall back to `onTap?.(eventId)` (existing behaviour).
 */
import { useRouter } from 'next/navigation'
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

function pillLabelFor(event: MemoryEvent): string | null {
  if (event.type === 'visit') return 'DR VISIT'
  if (event.type === 'blood-work') return 'BLOOD WORK'
  return null
}

export function EventRow({ event, onTap }: Props): React.JSX.Element {
  const router = useRouter()
  const ariaLabel = `${event.time}, ${event.title}, ${STATE_LABELS[event.taskState]}`
  const pill = pillLabelFor(event)

  const handleTap = (): void => {
    if (event.type === 'visit') {
      router.push(`/visits/${event.payload.visitId}`)
      return
    }
    if (event.type === 'blood-work') {
      router.push(`/blood-work/${event.payload.bloodWorkId}`)
      return
    }
    onTap?.(event.eventId)
  }

  return (
    <button
      type="button"
      onClick={handleTap}
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
      {pill !== null ? (
        <span
          data-testid={`event-pill-${event.type}`}
          className={[
            'shrink-0 self-center rounded-full px-2 py-0.5',
            'text-[10px] font-medium tracking-wider',
            'bg-[var(--bg-card)] text-[var(--ink-muted)]',
            'border border-[var(--rule)]',
          ].join(' ')}
        >
          {pill}
        </span>
      ) : null}
    </button>
  )
}
