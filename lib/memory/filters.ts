/**
 * Memory filter predicates — pure functions, no I/O.
 *
 * Maps the filter tabs (All / Check-ins / Intake events / Flare-ups /
 * Visits) to a subset of MemoryEvents. Shared by client (FilterTabs) and
 * server (listEventsByRange) so the two cannot drift.
 *
 * F05 chunk 5.C: blood-work events are surfaced under the `visits` filter
 * tab so the existing 5-tab layout doesn't grow another label. (The pill
 * still distinguishes them visually.) When the chunked filter spec evolves
 * post-MVP, split into its own tab.
 */
import type { MemoryEvent } from "./event-types";

export type MemoryFilter =
  | "all"
  | "check-ins"
  | "intake-events"
  | "flare-ups"
  | "visits";

export function applyFilter(
  events: MemoryEvent[],
  filter: MemoryFilter,
): MemoryEvent[] {
  switch (filter) {
    case "all":
      return events;
    case "check-ins":
      return events.filter((e) => e.type === "check-in");
    case "intake-events":
      return events.filter((e) => e.type === "intake");
    case "flare-ups":
      return events.filter((e) => e.type === "flare");
    case "visits":
      return events.filter(
        (e) => e.type === "visit" || e.type === "blood-work",
      );
  }
}
