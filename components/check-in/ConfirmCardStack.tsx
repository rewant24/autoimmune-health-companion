'use client'

/**
 * ConfirmCardStack — W2-4 (Lane 1D part 2). Owns the N-rule from
 * feedback_confirm_card_stack_threshold so pages never decide:
 *
 *   - N≤3 → cards render individually in the locked order set 2026-05-09:
 *     dose changes → `children` (the ConfirmSummary slot) → visits →
 *     blood work. The summary sits between so the user reads their
 *     captured metrics first; visit + blood-work cards are extractor
 *     side-events that come after; dose-change cards stay on top per the
 *     F05 chunk 5.C invariant.
 *
 *   - N≥4 → grouped presentation (spike §2 sketch): the summary first,
 *     then one section headed "I also caught N things to save" with a
 *     collapsed row per card. Rows expand one at a time into the full
 *     ConfirmCard (P1 behavior inside). "Save all" renders only when
 *     every card is unambiguous (no blood-work marker missing a unit).
 *
 * Cards stay mounted in both presentations (collapsed rows hide them with
 * `hidden`) so per-card state — unit picks, saved/dismissed undo chips —
 * survives collapse/expand and presentation switches.
 */

import { useRef, useState } from 'react'
import {
  ConfirmCard,
  confirmCardRowSummary,
  type ConfirmCardHandle,
  type ConfirmCardProps,
  type ConfirmCardState,
} from '@/components/check-in/ConfirmCard'
import { PillButton } from '@/components/ui/PillButton'

export type ConfirmCardStackItem = ConfirmCardProps & { key: string }

export interface ConfirmCardStackProps {
  items: ConfirmCardStackItem[]
  /** The ConfirmSummary slot. */
  children?: React.ReactNode
}

/** N≤3 renders individual cards; N≥4 groups them. */
const GROUP_THRESHOLD = 4

const KIND_ORDER: Record<ConfirmCardProps['kind'], number> = {
  'dose-change': 0,
  visit: 1,
  'blood-work': 2,
}

const STATE_ICON: Record<ConfirmCardState, string> = {
  prompt: '○',
  saved: '✓',
  dismissed: '—',
  error: '!',
}

export function ConfirmCardStack({
  items,
  children,
}: ConfirmCardStackProps): React.JSX.Element {
  const ordered = [...items].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  )
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, ConfirmCardState>>(
    {},
  )
  const handles = useRef(new Map<string, ConfirmCardHandle>())

  if (ordered.length < GROUP_THRESHOLD) {
    const dose = ordered.filter((i) => i.kind === 'dose-change')
    const events = ordered.filter((i) => i.kind !== 'dose-change')
    return (
      <>
        {dose.map(({ key, ...card }) => (
          <ConfirmCard key={key} {...card} />
        ))}
        {children}
        {events.map(({ key, ...card }) => (
          <ConfirmCard key={key} {...card} />
        ))}
      </>
    )
  }

  const statusOf = (key: string): ConfirmCardState => statuses[key] ?? 'prompt'
  const pending = ordered.filter((i) => {
    const s = statusOf(i.key)
    return s === 'prompt' || s === 'error'
  })
  // "Save all" only when every row is unambiguous — a blood-work card with
  // a null-unit marker needs its picker looked at, so no bulk save.
  const unambiguous = ordered.every(
    (i) => i.kind !== 'blood-work' || i.markers.every((m) => m.unit !== null),
  )

  const saveAll = (): void => {
    for (const item of pending) {
      handles.current.get(item.key)?.save()
    }
  }

  return (
    <>
      {children}
      <section
        data-testid="confirm-card-group"
        className="mx-6 mt-4 rounded-2xl border border-rule bg-bg-card p-5"
      >
        <p className="type-label">
          I also caught {ordered.length} things to save
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {ordered.map((item) => {
            const { key, ...card } = item
            const expanded = expandedKey === key
            return (
              <li key={key}>
                <button
                  type="button"
                  data-testid={`confirm-card-group-row-${key}`}
                  hidden={expanded}
                  onClick={() => setExpandedKey(key)}
                  className={
                    'flex min-h-11 w-full items-center gap-3 rounded-xl ' +
                    'border border-rule px-4 text-left transition-colors ' +
                    'focus-visible:outline-none focus-visible:ring-2 ' +
                    'focus-visible:ring-offset-2'
                  }
                >
                  <span
                    aria-hidden="true"
                    className="text-sage-deep"
                    data-testid={`confirm-card-group-row-${key}-status`}
                  >
                    {STATE_ICON[statusOf(key)]}
                  </span>
                  <span className="type-body" style={{ color: 'var(--ink)' }}>
                    {confirmCardRowSummary(item)}
                  </span>
                </button>
                <div hidden={!expanded}>
                  <ConfirmCard
                    {...card}
                    grouped
                    ref={(handle) => {
                      if (handle) handles.current.set(key, handle)
                      else handles.current.delete(key)
                    }}
                    onStateChange={(state) => {
                      setStatuses((prev) => ({ ...prev, [key]: state }))
                      card.onStateChange?.(state)
                      // Collapse the resolved card back into its row so the
                      // next one is one tap away.
                      if (state === 'saved' || state === 'dismissed') {
                        setExpandedKey((prev) => (prev === key ? null : prev))
                      }
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
        {unambiguous && pending.length > 0 ? (
          <PillButton
            data-testid="confirm-card-group-save-all"
            className="mt-4"
            onClick={saveAll}
          >
            Save all
          </PillButton>
        ) : null}
      </section>
    </>
  )
}
