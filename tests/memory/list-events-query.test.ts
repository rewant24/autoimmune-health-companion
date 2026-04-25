/**
 * Handler tests for `listEventsByRangeHandler` in `convex/checkIns.ts`.
 * Mirrors the mock-ctx pattern from tests/check-in/convex-checkins.test.ts.
 */
import { describe, it, expect } from "vitest";
import {
  listEventsByRangeHandler,
  type CheckinRow,
} from "@/convex/checkIns";

function makeCtx() {
  const rows: CheckinRow[] = [];

  const ctx = {
    db: {
      query: (_table: "checkIns") => ({
        withIndex: (
          _name: "by_user_date",
          cb: (q: {
            eq: (field: "userId" | "date", value: string) => unknown;
          }) => unknown,
        ) => {
          const eqs: Array<{ field: "userId" | "date"; value: string }> = [];
          const builder: {
            eq: (f: "userId" | "date", v: string) => typeof builder;
          } = {
            eq(field, value) {
              eqs.push({ field, value });
              return builder;
            },
          };
          cb(builder);
          return {
            collect: async () =>
              rows.filter((row) =>
                eqs.every(
                  ({ field, value }) =>
                    (row as unknown as Record<string, string>)[field] ===
                    value,
                ),
              ),
          };
        },
      }),
      // unused by listEventsByRangeHandler but required by the ctx shape:
      insert: async () => {
        throw new Error("not used");
      },
      get: async () => null,
    },
  };

  return { ctx, rows };
}

const seed = (overrides: Partial<CheckinRow> = {}): CheckinRow => ({
  _id: `id_${Math.random().toString(36).slice(2, 8)}`,
  userId: "user_A",
  date: "2026-04-25",
  // 09:00 UTC == 14:30 IST
  createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
  pain: 5,
  mood: "okay",
  adherenceTaken: true,
  flare: "no",
  energy: 6,
  transcript: "alright",
  stage: "open",
  durationMs: 42000,
  providerUsed: "web-speech",
  clientRequestId: "req_x",
  ...overrides,
});

type Ctx = Parameters<typeof listEventsByRangeHandler>[0];

describe("listEventsByRangeHandler", () => {
  it("empty store returns { events: [] }", async () => {
    const { ctx } = makeCtx();
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    });
    expect(result.events).toEqual([]);
  });

  it("excludes rows outside [fromDate, toDate]", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "a", date: "2026-04-20" }),
      seed({ _id: "b", date: "2026-04-22" }),
      seed({ _id: "c", date: "2026-04-24" }),
      seed({ _id: "d", date: "2026-04-26" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-22",
      toDate: "2026-04-24",
    });
    const dates = result.events.map((e) => e.date);
    expect(dates).toEqual(["2026-04-24", "2026-04-22"]);
  });

  it("sorts reverse-chronologically by (date desc, time desc)", async () => {
    const { ctx, rows } = makeCtx();
    // Same-day rows at different times — later time should come first.
    rows.push(
      seed({
        _id: "morning",
        date: "2026-04-25",
        createdAt: Date.UTC(2026, 3, 25, 3, 30, 0, 0), // 09:00 IST
      }),
      seed({
        _id: "evening",
        date: "2026-04-25",
        createdAt: Date.UTC(2026, 3, 25, 14, 30, 0, 0), // 20:00 IST
      }),
      seed({
        _id: "yesterday",
        date: "2026-04-24",
        createdAt: Date.UTC(2026, 3, 24, 12, 0, 0, 0), // 17:30 IST
      }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    });
    expect(result.events.map((e) => e.eventId)).toEqual([
      "checkin:evening",
      "checkin:morning",
      "checkin:yesterday",
    ]);
  });

  it("flare row produces 2 events at the same time", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "flarey", flare: "yes", date: "2026-04-25" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(2);
    const types = result.events.map((e) => e.type).sort();
    expect(types).toEqual(["check-in", "flare"]);
    // Both events share the same date + time.
    expect(result.events[0].time).toBe(result.events[1].time);
    expect(result.events[0].date).toBe(result.events[1].date);
  });

  it("scopes by userId — does not leak rows from other users", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "mine", userId: "user_A", date: "2026-04-25" }),
      seed({ _id: "theirs", userId: "user_B", date: "2026-04-25" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventId).toBe("checkin:mine");
  });

  it("excludes soft-deleted rows", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "live", date: "2026-04-25" }),
      seed({ _id: "deleted", date: "2026-04-25", deletedAt: 123 }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventId).toBe("checkin:live");
  });

  it("inclusive bounds: rows on fromDate and toDate are included", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "from", date: "2026-04-22" }),
      seed({ _id: "to", date: "2026-04-24" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-22",
      toDate: "2026-04-24",
    });
    expect(result.events.map((e) => e.eventId)).toEqual([
      "checkin:to",
      "checkin:from",
    ]);
  });
});
