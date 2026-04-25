/**
 * Unit tests for `lib/memory/filters.ts` — verifies each of the 5 filter
 * tabs returns the correct subset against a mixed-event fixture.
 */
import { describe, it, expect } from "vitest";
import { applyFilter } from "@/lib/memory/filters";
import type { MemoryEvent } from "@/lib/memory/event-types";

const checkinA: MemoryEvent = {
  type: "check-in",
  eventId: "checkin:1",
  date: "2026-04-25",
  time: "09:00",
  title: "Daily check-in",
  meta: "Pain 5 · Okay",
  taskState: "done",
  payload: {
    pain: 5,
    mood: "okay",
    adherenceTaken: true,
    energy: 6,
    transcript: "ok",
    checkinId: "1",
  },
};

const checkinB: MemoryEvent = {
  type: "check-in",
  eventId: "checkin:2",
  date: "2026-04-24",
  time: "08:00",
  title: "Daily check-in",
  meta: "Pain 4 · Bright",
  taskState: "done",
  payload: {
    pain: 4,
    mood: "bright",
    adherenceTaken: true,
    energy: 7,
    transcript: "good",
    checkinId: "2",
  },
};

const flare: MemoryEvent = {
  type: "flare",
  eventId: "flare:1",
  date: "2026-04-25",
  time: "09:00",
  title: "Flare-up logged",
  meta: "",
  taskState: "missed",
  payload: { checkinId: "1" },
};

const intake: MemoryEvent = {
  type: "intake",
  eventId: "intake:1",
  date: "2026-04-25",
  time: "10:00",
  title: "Medication intake",
  meta: "",
  taskState: "done",
  payload: {},
};

const visit: MemoryEvent = {
  type: "visit",
  eventId: "visit:1",
  date: "2026-04-25",
  time: "14:00",
  title: "Doctor visit",
  meta: "",
  taskState: "done",
  payload: {},
};

const all: MemoryEvent[] = [checkinA, checkinB, flare, intake, visit];

describe("applyFilter", () => {
  it("'all' returns every event unchanged", () => {
    expect(applyFilter(all, "all")).toEqual(all);
  });

  it("'check-ins' returns only check-in events", () => {
    expect(applyFilter(all, "check-ins")).toEqual([checkinA, checkinB]);
  });

  it("'intake-events' returns only intake events", () => {
    expect(applyFilter(all, "intake-events")).toEqual([intake]);
  });

  it("'flare-ups' returns only flare events", () => {
    expect(applyFilter(all, "flare-ups")).toEqual([flare]);
  });

  it("'visits' returns only visit events", () => {
    expect(applyFilter(all, "visits")).toEqual([visit]);
  });

  it("returns [] for the empty input regardless of filter", () => {
    expect(applyFilter([], "all")).toEqual([]);
    expect(applyFilter([], "check-ins")).toEqual([]);
    expect(applyFilter([], "flare-ups")).toEqual([]);
    expect(applyFilter([], "intake-events")).toEqual([]);
    expect(applyFilter([], "visits")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...all];
    applyFilter(input, "check-ins");
    expect(input).toEqual(all);
  });
});
