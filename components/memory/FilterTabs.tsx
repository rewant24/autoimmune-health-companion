'use client'

/**
 * FilterTabs — 5 single-select filter chips for the Memory tab.
 *
 * Feature 02, Chunk 2.B, US-2.B.3.
 *
 * Order is locked: All / Check-ins / Intake events / Flare-ups / Visits.
 * Selected tab is filled in sage-teal accent. Container is horizontally
 * scrollable on small screens. Each tab is a `<button role="tab">` with
 * `aria-selected`. Min hit target 44pt.
 */

import type { MemoryFilter } from './_types'

export interface FilterTabsProps {
  value: MemoryFilter
  onChange: (next: MemoryFilter) => void
}

const TABS: ReadonlyArray<{ value: MemoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'check-ins', label: 'Check-ins' },
  { value: 'intake-events', label: 'Intake events' },
  { value: 'flare-ups', label: 'Flare-ups' },
  { value: 'visits', label: 'Visits' },
]

export function FilterTabs({
  value,
  onChange,
}: FilterTabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Filter Memory by event type"
      data-testid="filter-tabs"
      className="flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const isSelected = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-testid={`filter-tab-${tab.value}`}
            data-selected={isSelected ? 'true' : 'false'}
            onClick={() => onChange(tab.value)}
            className={[
              'min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 py-2',
              'text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sage)]',
              isSelected
                ? 'bg-[color:var(--sage)] text-white'
                : 'bg-[color:var(--bg-card)] text-[color:var(--ink-muted)] hover:bg-[color:var(--sage-soft)]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
