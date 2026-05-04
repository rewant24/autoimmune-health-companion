/**
 * Handler tests for `convex/intakeEvents.ts`.
 *
 * Covers idempotency on `clientRequestId` and cross-path dedupe across
 * sources for the same `(userId, medicationId, date)` per US-4.A.2.
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  logIntakeHandler,
  softDeleteIntakeHandler,
  listIntakeEventsHandler,
  listIntakeEventsByDateHandler,
  type IntakeEventRow,
  type LogIntakeArgs,
} from "@/convex/intakeEvents";

function makeCtx() {
  const rows: IntakeEventRow[] = [];
  let nextId = 1;

  const ctx = {
    db: {
      query: (_table: "intakeEvents") => ({
        withIndex: (
          _name: string,
          cb: (q: {
            eq: (field: string, value: unknown) => unknown;
          }) => unknown,
        ) => {
          const eqs: Array<{ field: string; value: unknown }> = [];
          const builder: {
            eq: (f: string, v: unknown) => typeof builder;
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
                    (row as unknown as Record<string, unknown>)[field] ===
                    value,
                ),
              ),
          };
        },
      }),
      insert: async (
        _table: "intakeEvents",
        doc: Omit<IntakeEventRow, "_id">,
      ): Promise<string> => {
        const id = `intake_${nextId++}`;
        rows.push({ ...doc, _id: id });
        return id;
      },
      get: async (id: string): Promise<IntakeEventRow | null> =>
        rows.find((r) => r._id === id) ?? null,
      patch: async (id: string, fields: Partial<IntakeEventRow>) => {
        const target = rows.find((r) => r._id === id);
        if (target !== undefined) {
          Object.assign(target, fields);
        }
      },
    },
  };
  return { ctx, rows };
}

const baseLog = (overrides: Partial<LogIntakeArgs> = {}): LogIntakeArgs => ({
  userId: "user_A",
  medicationId: "med_1",
  date: "2026-04-30",
  source: "home-tap",
  clientRequestId: "req_1",
  ...overrides,
});

type Ctx = Parameters<typeof logIntakeHandler>[0];

describe("logIntakeHandler — idempotency", () => {
  it("inserts a new row on first call", async () => {
    const { ctx, rows } = makeCtx();
    const result = await logIntakeHandler(ctx as unknown as Ctx, baseLog());
    expect(result.deduped).toBe(false);
    expect(result.source).toBe("home-tap");
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("home-tap");
  });

  it("retry with same clientRequestId returns same id, no insert", async () => {
    const { ctx, rows } = makeCtx();
    const first = await logIntakeHandler(ctx as unknown as Ctx, baseLog());
    const second = await logIntakeHandler(ctx as unknown as Ctx, baseLog());
    expect(second.id).toBe(first.id);
    expect(second.deduped).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("uses provided takenAt when given", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(ctx as unknown as Ctx, baseLog({ takenAt: 1700000123000 }));
    expect(rows[0].takenAt).toBe(1700000123000);
  });

  it("defaults takenAt to now() when omitted", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(ctx as unknown as Ctx, baseLog());
    expect(rows[0].takenAt).toBeGreaterThan(0);
  });
});

describe("logIntakeHandler — cross-path dedupe (US-4.A.2)", () => {
  it("home-tap then check-in for same (user, med, date) → no second insert; first writer wins", async () => {
    const { ctx, rows } = makeCtx();
    const first = await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ source: "home-tap", clientRequestId: "req_tap" }),
    );
    const second = await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ source: "check-in", clientRequestId: "req_voice" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("home-tap"); // first writer preserved
    expect(second.id).toBe(first.id);
    expect(second.deduped).toBe(true);
    expect(second.source).toBe("home-tap"); // returns existing source
  });

  it("check-in then home-tap → check-in source preserved", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ source: "check-in", clientRequestId: "req_voice" }),
    );
    const second = await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ source: "home-tap", clientRequestId: "req_tap" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("check-in");
    expect(second.source).toBe("check-in");
  });

  it("different date → new row inserted", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ date: "2026-04-29", clientRequestId: "r1" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ date: "2026-04-30", clientRequestId: "r2" }),
    );
    expect(rows).toHaveLength(2);
  });

  it("different medicationId → new row inserted", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ medicationId: "med_1", clientRequestId: "r1" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ medicationId: "med_2", clientRequestId: "r2" }),
    );
    expect(rows).toHaveLength(2);
  });

  it("different userId → new row inserted (scoping)", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ userId: "user_A", clientRequestId: "r1" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ userId: "user_B", clientRequestId: "r2" }),
    );
    expect(rows).toHaveLength(2);
  });

  it("dedupe ignores soft-deleted rows (re-tap allowed after explicit delete)", async () => {
    const { ctx, rows } = makeCtx();
    const first = await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ clientRequestId: "r1" }),
    );
    // Soft-delete the first row.
    rows[0].deletedAt = Date.now();
    const second = await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ clientRequestId: "r2" }),
    );
    expect(second.id).not.toBe(first.id);
    expect(second.deduped).toBe(false);
    expect(rows).toHaveLength(2);
  });
});

describe("softDeleteIntakeHandler", () => {
  it("stamps deletedAt on the row", async () => {
    const { ctx, rows } = makeCtx();
    const { id } = await logIntakeHandler(ctx as unknown as Ctx, baseLog());
    const result = await softDeleteIntakeHandler(ctx as unknown as Ctx, {
      id,
      userId: "user_A",
    });
    expect(result.alreadyDeleted).toBe(false);
    expect(rows[0].deletedAt).toBeGreaterThan(0);
  });

  it("idempotent on already-deleted row", async () => {
    const { ctx, rows } = makeCtx();
    const { id } = await logIntakeHandler(ctx as unknown as Ctx, baseLog());
    await softDeleteIntakeHandler(ctx as unknown as Ctx, { id, userId: "user_A" });
    const firstDeletedAt = rows[0].deletedAt;
    const result = await softDeleteIntakeHandler(ctx as unknown as Ctx, {
      id,
      userId: "user_A",
    });
    expect(result.alreadyDeleted).toBe(true);
    expect(rows[0].deletedAt).toBe(firstDeletedAt);
  });

  it("rejects when userId mismatches stored row (ADR-019)", async () => {
    const { ctx } = makeCtx();
    const { id } = await logIntakeHandler(ctx as unknown as Ctx, baseLog());
    await expect(
      softDeleteIntakeHandler(ctx as unknown as Ctx, { id, userId: "user_B" }),
    ).rejects.toMatchObject({ data: { code: "intake.forbidden" } });
  });

  it("rejects unknown id with ConvexError", async () => {
    const { ctx } = makeCtx();
    try {
      await softDeleteIntakeHandler(ctx as unknown as Ctx, {
        id: "intake_does_not_exist",
        userId: "user_A",
      });
      throw new Error("expected not_found");
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
    }
  });
});

describe("listIntakeEventsHandler", () => {
  it("filters by date range, excludes soft-deleted, sorts newest first", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ date: "2026-04-28", clientRequestId: "r1" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ date: "2026-04-29", clientRequestId: "r2" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ date: "2026-04-30", clientRequestId: "r3" }),
    );
    rows[0].deletedAt = Date.now(); // soft-delete the 28th

    const result = await listIntakeEventsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-29",
      toDate: "2026-04-30",
    });
    expect(result.map((r) => r.date)).toEqual(["2026-04-30", "2026-04-29"]);
  });

  it("scopes by userId", async () => {
    const { ctx } = makeCtx();
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ userId: "user_A", clientRequestId: "r1" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ userId: "user_B", clientRequestId: "r2" }),
    );
    const result = await listIntakeEventsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-01-01",
      toDate: "2026-12-31",
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user_A");
  });
});

describe("listIntakeEventsByDateHandler", () => {
  it("returns rows for a single date, excludes soft-deleted", async () => {
    const { ctx, rows } = makeCtx();
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ medicationId: "med_1", clientRequestId: "r1" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ medicationId: "med_2", clientRequestId: "r2" }),
    );
    await logIntakeHandler(
      ctx as unknown as Ctx,
      baseLog({ medicationId: "med_3", clientRequestId: "r3" }),
    );
    rows[1].deletedAt = Date.now();

    const result = await listIntakeEventsByDateHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      date: "2026-04-30",
    });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.medicationId).sort()).toEqual(["med_1", "med_3"]);
  });
});
