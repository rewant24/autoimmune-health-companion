// TODO(integration): replace this whole file with `export type { MemoryEvent, MemoryFilter } from '@/lib/memory/event-types'`
//
// Local stub used by Chunk 2.B components while Chunk 2.A is in flight.
// Keep the shape minimal — just what the layout / scrubber / filter tabs
// need to render. The integration step will swap this for a re-export
// (or delete it entirely and rewrite imports).
export type TaskState = 'pending' | 'done' | 'missed'

export type MemoryEvent = {
  type: 'check-in' | 'flare' | 'intake' | 'visit'
  eventId: string
  date: string // YYYY-MM-DD IST
  time: string // HH:MM IST
  title: string
  meta: string
  taskState: TaskState
}

export type MemoryFilter =
  | 'all'
  | 'check-ins'
  | 'intake-events'
  | 'flare-ups'
  | 'visits'
