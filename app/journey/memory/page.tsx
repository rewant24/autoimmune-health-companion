'use client'

/**
 * /journey/memory — the canonical Memory tab (Feature 02, Chunk 2.B).
 *
 * F02 C1, US-2.B.1. Reads `?filter=` from the URL and hands it to
 * <MemoryTab> as the initial filter; the tab keeps the URL in sync on
 * change. Convex wiring lands at integration time (chunk 2.A's
 * `listEventsByRange`); for C1 we render with an empty events array so
 * the layout, scrubber, and filter tabs are exercised end-to-end.
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { MemoryFilter } from '@/components/memory/_types'
import { MemoryTab } from '@/components/memory/MemoryTab'

const FILTER_VALUES: ReadonlySet<MemoryFilter> = new Set([
  'all',
  'check-ins',
  'intake-events',
  'flare-ups',
  'visits',
])

function parseFilter(raw: string | null): MemoryFilter {
  if (raw && (FILTER_VALUES as Set<string>).has(raw)) {
    return raw as MemoryFilter
  }
  return 'all'
}

/**
 * Inner component that reads `?filter=` — kept under a Suspense boundary
 * because Next 16 requires `useSearchParams` consumers to be suspended
 * during static generation (otherwise the page CSR-bails the whole route).
 */
function JourneyMemoryInner(): React.JSX.Element {
  const searchParams = useSearchParams()
  const initialFilter = parseFilter(searchParams?.get('filter') ?? null)

  // C1: events come from props as an empty list. Integration step swaps
  // this for `useQuery(api.memory.listEventsByRange, …)`.
  return <MemoryTab events={[]} initialFilter={initialFilter} />
}

export default function JourneyMemoryPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <JourneyMemoryInner />
    </Suspense>
  )
}
