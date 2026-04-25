/**
 * Tests for `convex/continuity.ts` — `getContinuityStateHandler`.
 *
 * Approach mirrors `convex-checkins.test.ts`: import the extracted plain
 * handler, drive it with a hand-rolled mock ctx that emulates the slice
 * of the Convex DB API we touch (`query(table).withIndex(...).collect()`).
 * That keeps the dependency surface tiny and tests fast.
 *
 * The handler reads the prior 30 days of `checkIns` for the given user
 * and computes a `ContinuityState` snapshot the opener/closer engines
 * consume. `upcomingEvent` is always `null` in C2 (F08 stub).
 */

import { describe, it, expect } from "vitest";
import {
  getContinuityStateHandler,
  type ContinuityRow,
} from "@/convex/continuity";

type Ctx = Parameters<typeof getContinuityStateHandler>[0];

function makeCtx(rows: ContinuityRow[] = []): Ctx {
  return {
    db: {
      query: (_table: "checkIns") => ({
        withIndex: (_name, cb) => {
          const eqs: Array<{ field: "userId" | "date"; value: string }> = [];
          const builder: { eq: (f: "userId" | "date", v: string) => typeof builder } = {
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
                    (row as unknown as Record<string, string>)[field] === value,
                ),
              ),
          };
        },
      }),
    },
  };
}

const baseRow = (overrides: Partial<ContinuityRow>): ContinuityRow => ({
  _id: `id_${Math.random().toString(36).slice(2, 8)}`,
  userId: "user_A",
  date: "2026-04-24",
  createdAt: Date.now(),
  pain: 4,
  mood: "okay",
  flare: "no",
  ...overrides,
});

describe("getContinuityStateHandler — empty / first-ever", () => {
  it("returns isFirstEverCheckin=true and lastCheckinDaysAgo=Infinity when no history", async () => {
    const ctx = makeCtx([]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.isFirstEverCheckin).toBe(true);
    expect(state.yesterday).toBeNull();
    expect(state.streakDays).toBe(0);
    expect(state.flareOngoingDays).toBe(0);
    expect(state.upcomingEvent).toBeNull();
    // No prior row => "skip" of effectively forever; engine treats this
    // before the multi-day-skip branch via isFirstEverCheckin.
    expect(state.lastCheckinDaysAgo).toBe(Number.POSITIVE_INFINITY);
  });

  it("ignores rows for other users", async () => {
    const ctx = makeCtx([baseRow({ userId: "user_B", date: "2026-04-24" })]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.isFirstEverCheckin).toBe(true);
  });
});

describe("getContinuityStateHandler — yesterday read", () => {
  it("populates yesterday block when there is a row dated todayIso - 1 day", async () => {
    const ctx = makeCtx([
      baseRow({
        date: "2026-04-24",
        pain: 7,
        mood: "flat",
        flare: "no",
      }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.yesterday).not.toBeNull();
    expect(state.yesterday?.date).toBe("2026-04-24");
    expect(state.yesterday?.pain).toBe(7);
    expect(state.yesterday?.mood).toBe("flat");
    expect(state.yesterday?.flare).toBe("no");
    expect(state.yesterday?.isRoughDay).toBe(false);
    expect(state.lastCheckinDaysAgo).toBe(1);
    expect(state.streakDays).toBe(1);
    expect(state.isFirstEverCheckin).toBe(false);
  });

  it("isRoughDay = true when pain >= 8", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24", pain: 8, mood: "heavy", flare: "no" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.yesterday?.isRoughDay).toBe(true);
  });

  it("isRoughDay = true when flare === 'yes'", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24", pain: 4, mood: "okay", flare: "yes" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.yesterday?.isRoughDay).toBe(true);
  });

  it("isRoughDay = false on quiet day", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24", pain: 3, mood: "bright", flare: "no" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.yesterday?.isRoughDay).toBe(false);
  });

  it("yesterday.pain reflects null when the metric was declined", async () => {
    const ctx = makeCtx([
      baseRow({
        date: "2026-04-24",
        pain: undefined,
        mood: "okay",
        flare: "no",
      }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.yesterday?.pain).toBeNull();
    expect(state.yesterday?.isRoughDay).toBe(false);
  });
});

describe("getContinuityStateHandler — today's row already exists (re-entry)", () => {
  it("lastCheckinDaysAgo = 0 when a row for todayIso exists", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24", pain: 4 }),
      baseRow({ date: "2026-04-25", pain: 5, mood: "okay" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.lastCheckinDaysAgo).toBe(0);
    // yesterday block still populated from 2026-04-24 row.
    expect(state.yesterday?.date).toBe("2026-04-24");
  });
});

describe("getContinuityStateHandler — streak counting", () => {
  it("counts a 7-day consecutive streak", async () => {
    const dates = [
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
    ];
    const ctx = makeCtx(dates.map((d) => baseRow({ date: d, pain: 4 })));
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.streakDays).toBe(7);
    expect(state.lastCheckinDaysAgo).toBe(1);
  });

  it("breaks streak on a 3-day gap", async () => {
    // 2026-04-24, 2026-04-23 then a gap (no rows for 22/21), then 2026-04-20
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24" }),
      baseRow({ date: "2026-04-23" }),
      baseRow({ date: "2026-04-20" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.streakDays).toBe(2);
  });

  it("multi-day skip: lastCheckinDaysAgo = 3 when most recent row is 3 days old", async () => {
    const ctx = makeCtx([baseRow({ date: "2026-04-22", pain: 4 })]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.lastCheckinDaysAgo).toBe(3);
    expect(state.yesterday).toBeNull();
    expect(state.streakDays).toBe(1);
  });

  it("considers up to 30 days of history", async () => {
    // Generate 30 consecutive prior days using arithmetic-correct dates
    // (April has 30 days, so day 26 back from 2026-04-25 lands in March).
    const rows: ContinuityRow[] = [];
    const start = Date.UTC(2026, 3, 24); // 2026-04-24, one day before todayIso
    for (let i = 0; i < 30; i++) {
      const dt = new Date(start - i * 24 * 60 * 60 * 1000);
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(dt.getUTCDate()).padStart(2, "0");
      rows.push(baseRow({ date: `${yy}-${mm}-${dd}` }));
    }
    const ctx = makeCtx(rows);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.streakDays).toBe(30);
  });
});

describe("getContinuityStateHandler — flare ongoing counting", () => {
  it("counts 1-day ongoing flare", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24", pain: 6, flare: "ongoing" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.flareOngoingDays).toBe(1);
  });

  it("counts 5-day ongoing flare run", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-20", flare: "ongoing" }),
      baseRow({ date: "2026-04-21", flare: "ongoing" }),
      baseRow({ date: "2026-04-22", flare: "ongoing" }),
      baseRow({ date: "2026-04-23", flare: "ongoing" }),
      baseRow({ date: "2026-04-24", flare: "ongoing" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.flareOngoingDays).toBe(5);
  });

  it("flareOngoingDays = 0 when yesterday's flare is 'no'", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-23", flare: "ongoing" }),
      baseRow({ date: "2026-04-24", flare: "no" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.flareOngoingDays).toBe(0);
  });

  it("flareOngoingDays = 0 when yesterday's flare is 'yes' (new flare, not ongoing)", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24", flare: "yes" }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.flareOngoingDays).toBe(0);
  });
});

describe("getContinuityStateHandler — F08 stub + soft-delete", () => {
  it("upcomingEvent always returns null in C2", async () => {
    const ctx = makeCtx([baseRow({ date: "2026-04-24" })]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    expect(state.upcomingEvent).toBeNull();
  });

  it("ignores soft-deleted rows", async () => {
    const ctx = makeCtx([
      baseRow({ date: "2026-04-24", deletedAt: 1234 }),
    ]);
    const state = await getContinuityStateHandler(ctx, {
      userId: "user_A",
      todayIso: "2026-04-25",
    });
    // The only row is deleted → looks like first-ever.
    expect(state.isFirstEverCheckin).toBe(true);
    expect(state.yesterday).toBeNull();
  });
});
