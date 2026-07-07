/**
 * <DayView> — one calendar day rendered as grouped sections (US-2.C.1).
 *
 * Sections, in fixed order, hide if empty:
 *   1. Today's check-in   — type='check-in' && taskState!='done'
 *   2. Medication intake  — type='intake'   && taskState!='done'
 *   3. Other events       — type in (flare,visit) && taskState!='done'
 *   4. Completed (collapsible, initially EXPANDED)
 *                          — taskState='done'  (across all types)
 *                          Default flipped 2026-05-09: at MVP scale a day's
 *                          completed items are the *content* of Memory, so
 *                          hiding them behind a tap was friction. Group
 *                          remains collapsible for users who want to declutter.
 *
 * Note: in F02 C1 the only event-producer is `eventFromCheckin`, which
 * emits check-ins as `done`. So in C1 every check-in lands in Completed.
 * That's the spec; the pending/missed branches light up in later cycles.
 */
import { formatISTDate, todayIST } from '@/lib/format/date'
import type { MemoryEvent } from './_types'
import { EventGroup } from './EventGroup'

type Props = {
  date: string
  events: MemoryEvent[]
  onEventTap?: (eventId: string) => void
}

function formatDayHeader(date: string): string {
  if (date === todayIST()) return 'Today'
  // "Tue, 21 Apr" — the year is context in a day header.
  return formatISTDate(date, 'compact')
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

  const isEmpty =
    todaysCheckin.length === 0 &&
    medicationIntake.length === 0 &&
    otherEvents.length === 0 &&
    completed.length === 0

  return (
    <article data-day-view={date} className="flex flex-col">
      <header
        data-day-header
        className="sticky top-0 z-10 bg-[var(--bg)] px-3 py-2 type-label text-[var(--ink-muted)]"
      >
        {formatDayHeader(date)}
      </header>
      {isEmpty ? (
        <div
          data-testid="day-view-empty"
          className="px-3 py-6 text-sm text-[color:var(--ink-subtle)]"
        >
          {date === todayIST()
            ? 'Your memory starts today.'
            : 'No check-ins on this day.'}
        </div>
      ) : (
        <>
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
            />
          )}
        </>
      )}
    </article>
  )
}
