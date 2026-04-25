/**
 * Memory filter predicates — pure functions, no I/O.
 *
 * Maps the 5 filter tabs (All / Check-ins / Intake events / Flare-ups /
 * Visits) to a subset of MemoryEvents. Shared by client (FilterTabs) and
 * server (listEventsByRange) so the two cannot drift.
 *
 * Note: in F02 C1, 'intake-events' and 'visits' always return [] because
 * F04 / F05 are not shipped yet — by spec, this is correct behavior.
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
      return events.filter((e) => e.type === "visit");
  }
}
