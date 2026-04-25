/**
 * Unit tests for `lib/memory/event-types.ts` — covers eventFromCheckin
 * shape, taskState, eventId pattern, meta formatting, IST time conversion,
 * and the flare=true → 2 events emission rule.
 */
import { describe, it, expect } from "vitest";
import { eventFromCheckin } from "@/lib/memory/event-types";
import type { CheckinRow } from "@/convex/checkIns";

const baseRow = (overrides: Partial<CheckinRow> = {}): CheckinRow => ({
  _id: "id_1",
  userId: "user_A",
  date: "2026-04-25",
  // 2026-04-25T09:00:00Z → 14:30 IST
  createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
  pain: 5,
  mood: "okay",
  adherenceTaken: true,
  flare: "no",
  energy: 6,
  transcript: "today was alright",
  stage: "open",
  durationMs: 42000,
  providerUsed: "web-speech",
  clientRequestId: "req_1",
  ...overrides,
});

describe("eventFromCheckin", () => {
  it("flare='no' produces exactly one check-in event", () => {
    const events = eventFromCheckin(baseRow());
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("check-in");
  });

  it("flare=true produces a check-in event followed by a flare event", () => {
    const events = eventFromCheckin(baseRow({ flare: "yes" }));
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.type)).toEqual(["check-in", "flare"]);
  });

  it("check-in event has title 'Daily check-in', meta 'Pain N · Mood', taskState 'done'", () => {
    const [checkin] = eventFromCheckin(baseRow({ pain: 7, mood: "bright" }));
    expect(checkin.title).toBe("Daily check-in");
    expect(checkin.meta).toBe("Pain 7 · Bright");
    expect(checkin.taskState).toBe("done");
  });

  it("title-cases each mood label in meta", () => {
    for (const mood of ["heavy", "flat", "okay", "bright", "great"] as const) {
      const expectedLabel =
        mood.charAt(0).toUpperCase() + mood.slice(1);
      const [event] = eventFromCheckin(baseRow({ mood, pain: 3 }));
      expect(event.meta).toBe(`Pain 3 · ${expectedLabel}`);
    }
  });

  it("flare event has title 'Flare-up logged', empty meta, taskState 'missed'", () => {
    const [, flare] = eventFromCheckin(baseRow({ flare: "yes" }));
    expect(flare.type).toBe("flare");
    expect(flare.title).toBe("Flare-up logged");
    expect(flare.meta).toBe("");
    expect(flare.taskState).toBe("missed");
  });

  it("eventId is 'checkin:{_id}' for check-in and 'flare:{_id}' for flare", () => {
    const [checkin, flare] = eventFromCheckin(
      baseRow({ _id: "abc123", flare: "yes" }),
    );
    expect(checkin.eventId).toBe("checkin:abc123");
    expect(flare?.eventId).toBe("flare:abc123");
  });

  it("time is HH:MM in IST (UTC+5:30)", () => {
    // 09:00 UTC + 5:30 = 14:30 IST
    const [event] = eventFromCheckin(baseRow());
    expect(event.time).toBe("14:30");
  });

  it("time crosses IST midnight correctly", () => {
    // 19:00 UTC = 00:30 IST next day. We don't shift `date` (the row's
    // own `date` field is the source of truth) — only the time string.
    const [event] = eventFromCheckin(
      baseRow({ createdAt: Date.UTC(2026, 3, 25, 19, 0, 0, 0) }),
    );
    expect(event.time).toBe("00:30");
  });

  it("flare event shares the same date and time as its check-in", () => {
    const [checkin, flare] = eventFromCheckin(baseRow({ flare: "yes" }));
    expect(flare.date).toBe(checkin.date);
    expect(flare.time).toBe(checkin.time);
  });

  it("check-in payload carries the structured fields", () => {
    const [checkin] = eventFromCheckin(
      baseRow({
        _id: "row_xyz",
        pain: 8,
        mood: "heavy",
        adherenceTaken: false,
        energy: 2,
        transcript: "tough day",
      }),
    );
    if (checkin.type !== "check-in") {
      throw new Error("expected check-in variant");
    }
    expect(checkin.payload).toEqual({
      pain: 8,
      mood: "heavy",
      adherenceTaken: false,
      energy: 2,
      transcript: "tough day",
      checkinId: "row_xyz",
    });
  });
});
