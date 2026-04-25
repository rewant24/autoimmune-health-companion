/**
 * Components/memory shared types.
 *
 * Originally a local stub built by chunk 2.B while chunk 2.A was in flight;
 * integration step swapped it for a re-export from the canonical
 * `@/lib/memory/event-types`. Kept as a re-export module so existing
 * imports across components/tests don't churn.
 */
export type { TaskState, MemoryEvent, Mood } from '@/lib/memory/event-types'
export type { MemoryFilter } from '@/lib/memory/filters'
