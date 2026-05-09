/**
 * Handler tests for `convex/bloodWork.ts`.
 *
 * Covers marker validation, idempotency on `clientRequestId`, abnormal
 * derivation when both refRange bounds are present, and soft-delete
 * idempotency per US-5.A.2 / US-5.A.3.
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  createBloodWorkHandler,
  updateBloodWorkHandler,
  softDeleteBloodWorkHandler,
  listBloodWorkHandler,
  getBloodWorkByDateHandler,
  type BloodWorkRow,
  type CreateBloodWorkArgs,
  type BloodWorkMarkerInput,
} from "@/convex/bloodWork";

function makeCtx() {
  const rows: BloodWorkRow[] = [];
  let nextId = 1;

  const ctx = {
    db: {
      query: (_table: "bloodWork") => ({
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
        _table: "bloodWork",
        doc: Omit<BloodWorkRow, "_id">,
      ): Promise<string> => {
        const id = `bw_${nextId++}`;
        rows.push({ ...doc, _id: id });
        return id;
      },
      get: async (id: string): Promise<BloodWorkRow | null> =>
        rows.find((r) => r._id === id) ?? null,
      patch: async (id: string, fields: Partial<BloodWorkRow>) => {
        const target = rows.find((r) => r._id === id);
        if (target !== undefined) {
          Object.assign(target, fields);
        }
      },
    },
  };
  return { ctx, rows };
}

const crpMarker: BloodWorkMarkerInput = {
  name: "CRP",
  value: 5.2,
  unit: "mg/L",
};

const baseCreate = (
  overrides: Partial<CreateBloodWorkArgs> = {},
): CreateBloodWorkArgs => ({
  userId: "user_A",
  date: "2026-04-30",
  markers: [crpMarker],
  source: "module",
  clientRequestId: "req_1",
  ...overrides,
});

type Ctx = Parameters<typeof createBloodWorkHandler>[0];

describe("createBloodWorkHandler", () => {
  it("happy path inserts a row with one marker", async () => {
    const { ctx, rows } = makeCtx();
    const result = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    expect(result.deduped).toBe(false);
    expect(result.bloodWorkId).toMatch(/^bw_/);
    expect(rows).toHaveLength(1);
    expect(rows[0].markers).toHaveLength(1);
    expect(rows[0].markers[0].name).toBe("CRP");
    expect(rows[0].markers[0].value).toBe(5.2);
    expect(rows[0].markers[0].unit).toBe("mg/L");
    expect(rows[0].createdAt).toBeGreaterThan(0);
  });

  it("trims marker name + unit, preserves order", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({
        markers: [
          { name: "  CRP  ", value: 5, unit: "  mg/L " },
          { name: " ESR ", value: 20, unit: "mm/hr" },
        ],
      }),
    );
    expect(rows[0].markers[0].name).toBe("CRP");
    expect(rows[0].markers[0].unit).toBe("mg/L");
    expect(rows[0].markers[1].name).toBe("ESR");
  });

  it("derives abnormal when both bounds are present", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({
        markers: [
          { name: "CRP", value: 12, unit: "mg/L", refRangeLow: 0, refRangeHigh: 5 },
          { name: "ESR", value: 18, unit: "mm/hr", refRangeLow: 0, refRangeHigh: 20 },
        ],
      }),
    );
    expect(rows[0].markers[0].abnormal).toBe(true);
    expect(rows[0].markers[1].abnormal).toBe(false);
  });

  it("does not derive abnormal when bounds are missing", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({
        markers: [{ name: "CRP", value: 99, unit: "mg/L" }],
      }),
    );
    expect(rows[0].markers[0].abnormal).toBeUndefined();
  });

  it("trusts caller-provided abnormal even when bounds present", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({
        markers: [
          {
            name: "CRP",
            value: 12,
            unit: "mg/L",
            refRangeLow: 0,
            refRangeHigh: 5,
            abnormal: false, // override; would derive true
          },
        ],
      }),
    );
    expect(rows[0].markers[0].abnormal).toBe(false);
  });

  it("idempotent on clientRequestId", async () => {
    const { ctx, rows } = makeCtx();
    const first = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    const second = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    expect(second.bloodWorkId).toBe(first.bloodWorkId);
    expect(second.deduped).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("dedupe ignores soft-deleted rows", async () => {
    const { ctx, rows } = makeCtx();
    const first = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    rows[0].deletedAt = Date.now();
    const second = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    expect(second.bloodWorkId).not.toBe(first.bloodWorkId);
    expect(second.deduped).toBe(false);
    expect(rows).toHaveLength(2);
  });

  it("rejects empty markers[]", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ markers: [] }),
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.no_markers" } });
  });

  it("rejects marker with empty name after trim", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ markers: [{ name: "  ", value: 1, unit: "mg/L" }] }),
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.bad_marker_name" } });
  });

  it("rejects non-finite value (NaN)", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ markers: [{ name: "CRP", value: NaN, unit: "mg/L" }] }),
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.bad_marker_value" } });
  });

  it("rejects non-finite value (Infinity)", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({
          markers: [{ name: "CRP", value: Infinity, unit: "mg/L" }],
        }),
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.bad_marker_value" } });
  });

  it("rejects empty unit after trim", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ markers: [{ name: "CRP", value: 5, unit: "  " }] }),
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.bad_marker_unit" } });
  });

  it("rejects refRangeLow > refRangeHigh", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({
          markers: [
            {
              name: "CRP",
              value: 5,
              unit: "mg/L",
              refRangeLow: 10,
              refRangeHigh: 5,
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.bad_ref_range" } });
  });

  it("rejects bad date format", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ date: "2026-4-30" }),
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.bad_date_format" } });
  });

  it("rejects future-dated blood work (write path defends form-level guard)", async () => {
    // Pin "now" to noon-IST 2026-05-09 → today=2026-05-09. A 2026-05-10
    // request must trip the future-date guard regardless of where the
    // request originated (manual form, voice extraction, future API).
    const nowMs = Date.UTC(2026, 4, 9, 6, 30, 0, 0);
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ date: "2026-05-10" }),
        () => nowMs,
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.future_date" } });
  });

  it("accepts today's date (boundary — equal-to-today is allowed)", async () => {
    const nowMs = Date.UTC(2026, 4, 9, 6, 30, 0, 0);
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-05-09" }),
      () => nowMs,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-05-09");
  });

  it("accepts source='check-in' without checkInId (best-effort linkage)", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ source: "check-in" }),
    );
    expect(rows[0].source).toBe("check-in");
    expect(rows[0].checkInId).toBeUndefined();
  });

  it("rejects source='check-in' with empty-string checkInId", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ source: "check-in", checkInId: "" }),
      ),
    ).rejects.toMatchObject({
      data: { code: "bloodWork.empty_check_in_id" },
    });
  });

  it("rejects source='module' with checkInId set", async () => {
    const { ctx } = makeCtx();
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseCreate({ source: "module", checkInId: "checkin_1" }),
      ),
    ).rejects.toMatchObject({
      data: { code: "bloodWork.unexpected_check_in_id" },
    });
  });

  it("accepts source='check-in' with checkInId", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ source: "check-in", checkInId: "checkin_1" }),
    );
    expect(rows[0].source).toBe("check-in");
    expect(rows[0].checkInId).toBe("checkin_1");
  });
});

describe("updateBloodWorkHandler", () => {
  it("rejects patching date to a future value", async () => {
    const nowMs = Date.UTC(2026, 4, 9, 6, 30, 0, 0); // today=2026-05-09
    const { ctx } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
      () => nowMs,
    );
    await expect(
      updateBloodWorkHandler(
        ctx as unknown as Ctx,
        { bloodWorkId, userId: "user_A", date: "2026-05-15" },
        () => nowMs,
      ),
    ).rejects.toMatchObject({ data: { code: "bloodWork.future_date" } });
  });

  it("patches notes only", async () => {
    const { ctx, rows } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await updateBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId,
      userId: "user_A",
      notes: "Fasting sample",
    });
    expect(rows[0].notes).toBe("Fasting sample");
    expect(rows[0].markers).toHaveLength(1);
  });

  it("patches markers — recomputes abnormal when bounds present", async () => {
    const { ctx, rows } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await updateBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId,
      userId: "user_A",
      markers: [
        { name: "CRP", value: 9, unit: "mg/L", refRangeLow: 0, refRangeHigh: 5 },
      ],
    });
    expect(rows[0].markers[0].value).toBe(9);
    expect(rows[0].markers[0].abnormal).toBe(true);
  });

  it("rejects when userId mismatches", async () => {
    const { ctx } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await expect(
      updateBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId,
        userId: "user_B",
        notes: "x",
      }),
    ).rejects.toMatchObject({ data: { code: "bloodWork.forbidden" } });
  });

  it("rejects unknown id", async () => {
    const { ctx } = makeCtx();
    await expect(
      updateBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId: "bw_404",
        userId: "user_A",
        notes: "x",
      }),
    ).rejects.toMatchObject({ data: { code: "bloodWork.not_found" } });
  });

  it("rejects update against soft-deleted row", async () => {
    const { ctx, rows } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    rows[0].deletedAt = Date.now();
    await expect(
      updateBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId,
        userId: "user_A",
        notes: "x",
      }),
    ).rejects.toMatchObject({ data: { code: "bloodWork.deleted" } });
  });

  it("rejects update with empty markers[]", async () => {
    const { ctx } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await expect(
      updateBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId,
        userId: "user_A",
        markers: [],
      }),
    ).rejects.toMatchObject({ data: { code: "bloodWork.no_markers" } });
  });

  it("clears notes when given empty trimmed string", async () => {
    const { ctx, rows } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ notes: "Original" }),
    );
    expect(rows[0].notes).toBe("Original");
    await updateBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId,
      userId: "user_A",
      notes: "   ",
    });
    expect(rows[0].notes).toBeUndefined();
  });
});

describe("softDeleteBloodWorkHandler", () => {
  it("stamps deletedAt", async () => {
    const { ctx, rows } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    const result = await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId,
      userId: "user_A",
    });
    expect(result.alreadyDeleted).toBe(false);
    expect(rows[0].deletedAt).toBeGreaterThan(0);
  });

  it("idempotent on already-deleted row", async () => {
    const { ctx, rows } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId,
      userId: "user_A",
    });
    const firstDeletedAt = rows[0].deletedAt;
    const result = await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId,
      userId: "user_A",
    });
    expect(result.alreadyDeleted).toBe(true);
    expect(rows[0].deletedAt).toBe(firstDeletedAt);
  });

  it("rejects userId mismatch", async () => {
    const { ctx } = makeCtx();
    const { bloodWorkId } = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await expect(
      softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId,
        userId: "user_B",
      }),
    ).rejects.toMatchObject({ data: { code: "bloodWork.forbidden" } });
  });

  it("ConvexError on unknown id", async () => {
    const { ctx } = makeCtx();
    try {
      await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId: "bw_404",
        userId: "user_A",
      });
      throw new Error("expected not_found");
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
    }
  });
});

describe("listBloodWorkHandler", () => {
  it("filters by date range, excludes soft-deleted, sorts newest-first", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-28", clientRequestId: "r1" }),
    );
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-29", clientRequestId: "r2" }),
    );
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-30", clientRequestId: "r3" }),
    );
    rows[0].deletedAt = Date.now();

    const result = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-29",
      toDate: "2026-04-30",
    });
    expect(result.map((r) => r.date)).toEqual(["2026-04-30", "2026-04-29"]);
  });

  it("works without fromDate / toDate", async () => {
    const { ctx } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-03-15", clientRequestId: "r1" }),
    );
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-30", clientRequestId: "r2" }),
    );
    const result = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(result.map((r) => r.date)).toEqual(["2026-04-30", "2026-03-15"]);
  });

  it("scopes by userId", async () => {
    const { ctx } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ userId: "user_A", clientRequestId: "rA" }),
    );
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ userId: "user_B", clientRequestId: "rB" }),
    );
    const result = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user_A");
  });
});

describe("getBloodWorkByDateHandler", () => {
  it("returns all non-soft-deleted entries on a date", async () => {
    const { ctx, rows } = makeCtx();
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ clientRequestId: "r1" }),
    );
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ clientRequestId: "r2" }),
    );
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-29", clientRequestId: "rOther" }),
    );
    rows[1].deletedAt = Date.now();

    const result = await getBloodWorkByDateHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      date: "2026-04-30",
    });
    expect(result).toHaveLength(1);
    expect(result[0].clientRequestId).toBe("r1");
  });

  it("rejects bad date format", async () => {
    const { ctx } = makeCtx();
    await expect(
      getBloodWorkByDateHandler(ctx as unknown as Ctx, {
        userId: "user_A",
        date: "30-04-2026",
      }),
    ).rejects.toMatchObject({ data: { code: "bloodWork.bad_date_format" } });
  });
});
