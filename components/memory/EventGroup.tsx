/**
 * <EventGroup> — labelled section of <EventRow>s.
 *
 * If `collapsible`, the header is a button that toggles the rows; the
 * button carries `aria-expanded`. When collapsed, the header reads
 * `"{label} ({events.length})"` so the count is still visible.
 */
'use client'

import { useState } from 'react'
import type { MemoryEvent } from './_types'
import { EventRow } from './EventRow'

type Props = {
  label: string
  events: MemoryEvent[]
  onEventTap?: (eventId: string) => void
  collapsible?: boolean
  initiallyCollapsed?: boolean
}

export function EventGroup({
  label,
  events,
  onEventTap,
  collapsible = false,
  initiallyCollapsed = false,
}: Props): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(
    collapsible && initiallyCollapsed,
  )
  const expanded = !collapsed
  const headerText = collapsed ? `${label} (${events.length})` : label

  const headerClasses =
    'flex w-full items-center justify-between text-xs uppercase tracking-wide text-[var(--ink-subtle)]'

  return (
    <section
      data-event-group={label}
      className="flex flex-col gap-1 px-3 py-2"
    >
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setCollapsed((c) => !c)}
          className={`${headerClasses} cursor-pointer select-none rounded px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sage)]`}
        >
          <span>{headerText}</span>
          <span
            aria-hidden="true"
            className="inline-block transition-transform"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ›
          </span>
        </button>
      ) : (
        <div className={`${headerClasses} px-1 py-1`}>
          <span>{label}</span>
        </div>
      )}
      {expanded && (
        <ul className="flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.eventId}>
              <EventRow event={event} onTap={onEventTap} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
