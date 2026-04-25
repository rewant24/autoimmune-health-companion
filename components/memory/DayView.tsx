/**
 * <DayView> — one calendar day rendered as grouped sections (US-2.C.1).
 *
 * Sections, in fixed order, hide if empty:
 *   1. Today's check-in   — type='check-in' && taskState!='done'
 *   2. Medication intake  — type='intake'   && taskState!='done'
 *   3. Other events       — type in (flare,visit) && taskState!='done'
 *   4. Completed (collapsible, initially collapsed)
 *                          — taskState='done'  (across all types)
 *
 * Note: in F02 C1 the only event-producer is `eventFromCheckin`, which
 * emits check-ins as `done`. So in C1 every check-in lands in Completed.
 * That's the spec; the pending/missed branches light up in later cycles.
 */
import type { MemoryEvent } from './_types'
import { EventGroup } from './EventGroup'

type Props = {
  date: string
  events: MemoryEvent[]
  onEventTap?: (eventId: string) => void
}

/** Today's date in IST (YYYY-MM-DD). en-CA happens to format as ISO. */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDayHeader(date: string): string {
  if (date === todayIST()) return 'Today'
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dt)
}

export function DayView({ date, events, onEventTap }: Props): React.JSX.Element {
  // A done event appears ONLY in Completed — never duplicated.
  const completed = events.filter((e) => e.taskState === 'done')
  const pending = events.filter((e) => e.taskState !== 'done')

  const todaysCheckin = pending.filter((e) => e.type === 'check-in')
  const medicationIntake = pending.filter((e) => e.type === 'intake')
  const otherEvents = pending.filter(
    (e) => e.type === 'flare' || e.type === 'visit',
  )

  return (
    <article data-day-view={date} className="flex flex-col">
      <header
        data-day-header
        className="sticky top-0 z-10 bg-[var(--bg)] px-3 py-2 type-label text-[var(--ink-muted)]"
      >
        {formatDayHeader(date)}
      </header>
      {todaysCheckin.length > 0 && (
        <EventGroup
          label="Today's check-in"
          events={todaysCheckin}
          onEventTap={onEventTap}
        />
      )}
      {medicationIntake.length > 0 && (
        <EventGroup
          label="Medication intake"
          events={medicationIntake}
          onEventTap={onEventTap}
        />
      )}
      {otherEvents.length > 0 && (
        <EventGroup
          label="Other events"
          events={otherEvents}
          onEventTap={onEventTap}
        />
      )}
      {completed.length > 0 && (
        <EventGroup
          label="Completed"
          events={completed}
          onEventTap={onEventTap}
          collapsible
          initiallyCollapsed
        />
      )}
    </article>
  )
}
