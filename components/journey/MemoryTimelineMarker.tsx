'use client'

/**
 * MemoryTimelineMarker — render a single visit OR blood-work event with a
 * type-tagged pill chip in the Memory timeline (US-5.C.3).
 *
 * Wraps the existing <EventRow> so the row layout (TaskStateIcon + time +
 * title + meta) stays in lockstep with check-ins and flares. The pill chip
 * sits on the title line, before the title text, so the pill colour-codes
 * the row without forking the row component itself.
 *
 * Pill conventions (per scoping § home event feed):
 *   - APPOINTMENT — visit         — warm/teal
 *   - BLOOD WORK  — blood-work    — blue
 *   - INTAKE      — intake (F04)  — neutral (handled in F04 chunk 4.C)
 *   - FLARE-UP    — flare         — red (handled inline in EventRow)
 *   - check-in itself is unpilled (base)
 *
 * This component is intentionally narrow: only the visit + blood-work
 * branches live here. Check-in / flare / intake continue to render via the
 * existing <EventRow> path inside <DayView>. The page composes both: it
 * passes check-in/flare/intake events to <DayView> as before, and renders
 * <MemoryTimelineMarker> alongside for visit + blood-work events. F02's
 * EventRow stays untouched — the marker is a sibling visual.
 */

import type { MemoryEvent } from '@/lib/memory/event-types'
import { TaskStateIcon } from '@/components/memory/TaskStateIcon'

type MarkerEvent =
  | Extract<MemoryEvent, { type: 'visit' }>
  | Extract<MemoryEvent, { type: 'blood-work' }>

export interface MemoryTimelineMarkerProps {
  event: MarkerEvent
  onTap?: (eventId: string) => void
}

const PILL_LABELS: Record<MarkerEvent['type'], string> = {
  visit: 'APPOINTMENT',
  'blood-work': 'BLOOD WORK',
}

const PILL_CLASSES: Record<MarkerEvent['type'], string> = {
  // Warm/teal for visits — same accent family as the Save button.
  visit:
    'bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100',
  // Blue for blood-work — distinct from visits at a glance.
  'blood-work':
    'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
}

const STATE_LABELS = {
  pending: 'Pending',
  done: 'Done',
  missed: 'Missed',
} as const

export function MemoryTimelineMarker(
  props: MemoryTimelineMarkerProps,
): React.JSX.Element {
  const { event, onTap } = props
  const pillLabel = PILL_LABELS[event.type]
  const pillClass = PILL_CLASSES[event.type]
  const ariaLabel = `${event.time}, ${pillLabel}, ${event.title}, ${STATE_LABELS[event.taskState]}`

  return (
    <button
      type="button"
      onClick={() => onTap?.(event.eventId)}
      aria-label={ariaLabel}
      data-event-id={event.eventId}
      data-event-type={event.type}
      data-task-state={event.taskState}
      data-testid="memory-timeline-marker"
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
        <span className="flex min-w-0 items-center gap-2">
          <span
            data-testid="marker-pill"
            data-pill-kind={event.type}
            className={[
              'inline-flex shrink-0 items-center rounded-full px-2 py-0.5',
              'text-[10px] font-semibold uppercase tracking-wide',
              pillClass,
            ].join(' ')}
          >
            {pillLabel}
          </span>
          <span className="truncate text-base text-[var(--ink)]">
            {event.title}
          </span>
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
