/**
 * Handler tests for `convex/doctorVisits.ts`.
 *
 * Approach: same as `tests/convex/medications.test.ts` — drive the
 * extracted plain-async handlers with a hand-rolled mock ctx whose `db`
 * emulates only the slice of the Convex DB API the handlers touch.
 * No `convex-test` dependency.
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  createVisitHandler,
  updateVisitHandler,
  softDeleteVisitHandler,
  listVisitsHandler,
  getNextUpcomingVisitHandler,
  getVisitsByDateHandler,
  type DoctorVisitRow,
  type CreateVisitArgs,
} from "@/convex/doctorVisits";

function makeCtx() {
  const rows: DoctorVisitRow[] = [];
  let nextId = 1;

  const ctx = {
    db: {
      query: (_table: "doctorVisits") => ({
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
        _table: "doctorVisits",
        doc: Omit<DoctorVisitRow, "_id">,
      ): Promise<string> => {
        const id = `visit_${nextId++}`;
        rows.push({ ...doc, _id: id });
        return id;
      },
      get: async (id: string): Promise<DoctorVisitRow | null> =>
        rows.find((r) => r._id === id) ?? null,
      patch: async (id: string, fields: Partial<DoctorVisitRow>) => {
        const target = rows.find((r) => r._id === id);
        if (target !== undefined) {
          Object.assign(target, fields);
        }
      },
    },
  };
  return { ctx, rows };
}

const baseCreate = (
  overrides: Partial<CreateVisitArgs> = {},
): CreateVisitArgs => ({
  userId: "user_A",
  date: "2026-04-30",
  doctorName: "Dr. Mehta",
  visitType: "consultation",
  source: "module",
  clientRequestId: "req_1",
  ...overrides,
});

type Ctx = Parameters<typeof createVisitHandler>[0];

describe("createVisitHandler", () => {
  it("happy path inserts a row with createdAt + module source", async () => {
    const { ctx, rows } = makeCtx();
    const result = await createVisitHandler(ctx as unknown as Ctx, baseCreate());
    expect(result.deduped).toBe(false);
    expect(result.visitId).toMatch(/^visit_/);
    expect(rows).toHaveLength(1);
    expect(rows[0].doctorName).toBe("Dr. Mehta");
    expect(rows[0].source).toBe("module");
    expect(rows[0].createdAt).toBeGreaterThan(0);
    expect(rows[0].deletedAt).toBeUndefined();
  });

  it("trims doctorName, specialty, notes (and drops empty strings)", async () => {
    const { ctx, rows } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({
        doctorName: "  Dr. Mehta  ",
        specialty: "  Rheumatology  ",
        notes: "  follow-up next month  ",
      }),
    );
    expect(rows[0].doctorName).toBe("Dr. Mehta");
    expect(rows[0].specialty).toBe("Rheumatology");
    expect(rows[0].notes).toBe("follow-up next month");

    const { ctx: ctx2, rows: rows2 } = makeCtx();
    await createVisitHandler(
      ctx2 as unknown as Ctx,
      baseCreate({ specialty: "   ", notes: "   " }),
    );
    expect(rows2[0].specialty).toBeUndefined();
    expect(rows2[0].notes).toBeUndefined();
  });

  it("idempotent on clientRequestId — second call returns same id with deduped=true", async () => {
    const { ctx, rows } = makeCtx();
    const first = await createVisitHandler(ctx as unknown as Ctx, baseCreate());
    const second = await createVisitHandler(ctx as unknown as Ctx, baseCreate());
    expect(second.visitId).toBe(first.visitId);
    expect(second.deduped).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("dedupe ignores soft-deleted rows", async () => {
    const { ctx, rows } = makeCtx();
    const first = await createVisitHandler(ctx as unknown as Ctx, baseCreate());
    rows[0].deletedAt = Date.now();
    const second = await createVisitHandler(ctx as unknown as Ctx, baseCreate());
    expect(second.visitId).not.toBe(first.visitId);
    expect(second.deduped).toBe(false);
    expect(rows).toHaveLength(2);
  });

  it("rejects empty doctorName after trim", async () => {
    const { ctx } = makeCtx();
    await expect(
      createVisitHandler(
        ctx as unknown as Ctx,
        baseCreate({ doctorName: "   " }),
      ),
    ).rejects.toMatchObject({ data: { code: "visit.no_doctor_name" } });
  });

  it("rejects bad date format", async () => {
    const { ctx } = makeCtx();
    await expect(
      createVisitHandler(
        ctx as unknown as Ctx,
        baseCreate({ date: "April 30, 2026" }),
      ),
    ).rejects.toMatchObject({ data: { code: "visit.bad_date_format" } });
  });

  it("rejects unknown visitType (defensive — schema also blocks)", async () => {
    const { ctx } = makeCtx();
    await expect(
      createVisitHandler(
        ctx as unknown as Ctx,
        baseCreate({ visitType: "lab" as unknown as CreateVisitArgs["visitType"] }),
      ),
    ).rejects.toMatchObject({ data: { code: "visit.bad_visit_type" } });
  });

  it("accepts source='check-in' without checkInId (best-effort linkage)", async () => {
    const { ctx, rows } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ source: "check-in" }),
    );
    expect(rows[0].source).toBe("check-in");
    expect(rows[0].checkInId).toBeUndefined();
  });

  it("rejects source='check-in' with empty-string checkInId", async () => {
    const { ctx } = makeCtx();
    await expect(
      createVisitHandler(
        ctx as unknown as Ctx,
        baseCreate({ source: "check-in", checkInId: "" }),
      ),
    ).rejects.toMatchObject({
      data: { code: "visit.empty_check_in_id" },
    });
  });

  it("rejects source='module' with checkInId set", async () => {
    const { ctx } = makeCtx();
    await expect(
      createVisitHandler(
        ctx as unknown as Ctx,
        baseCreate({ source: "module", checkInId: "checkin_1" }),
      ),
    ).rejects.toMatchObject({
      data: { code: "visit.unexpected_check_in_id" },
    });
  });

  it("accepts source='check-in' with valid checkInId and stores the link", async () => {
    const { ctx, rows } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ source: "check-in", checkInId: "checkin_1" }),
    );
    expect(rows[0].source).toBe("check-in");
    expect(rows[0].checkInId).toBe("checkin_1");
  });
});

describe("updateVisitHandler", () => {
  it("patches only provided fields", async () => {
    const { ctx, rows } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await updateVisitHandler(ctx as unknown as Ctx, {
      visitId,
      userId: "user_A",
      notes: "Updated note",
    });
    expect(rows[0].notes).toBe("Updated note");
    expect(rows[0].doctorName).toBe("Dr. Mehta");
    expect(rows[0].visitType).toBe("consultation");
  });

  it("rejects when userId mismatches stored row", async () => {
    const { ctx } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId,
        userId: "user_B",
        notes: "hijack",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.forbidden" } });
  });

  it("rejects unknown id", async () => {
    const { ctx } = makeCtx();
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId: "visit_does_not_exist",
        userId: "user_A",
        notes: "x",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.not_found" } });
  });

  it("rejects updates against a soft-deleted visit", async () => {
    const { ctx, rows } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    rows[0].deletedAt = Date.now();
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId,
        userId: "user_A",
        notes: "edit on deleted",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.deleted" } });
  });

  it("rejects empty trimmed doctorName on update", async () => {
    const { ctx } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId,
        userId: "user_A",
        doctorName: "   ",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.no_doctor_name" } });
  });

  it("rejects bad date format on update", async () => {
    const { ctx } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId,
        userId: "user_A",
        date: "2026/04/30",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.bad_date_format" } });
  });

  it("clears specialty when given an empty string", async () => {
    const { ctx, rows } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ specialty: "Rheumatology" }),
    );
    expect(rows[0].specialty).toBe("Rheumatology");
    await updateVisitHandler(ctx as unknown as Ctx, {
      visitId,
      userId: "user_A",
      specialty: "   ",
    });
    expect(rows[0].specialty).toBeUndefined();
  });
});

describe("softDeleteVisitHandler", () => {
  it("stamps deletedAt on the row", async () => {
    const { ctx, rows } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    const result = await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId,
      userId: "user_A",
    });
    expect(result.alreadyDeleted).toBe(false);
    expect(rows[0].deletedAt).toBeGreaterThan(0);
  });

  it("idempotent on already-deleted row, no re-stamp", async () => {
    const { ctx, rows } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId,
      userId: "user_A",
    });
    const firstDeletedAt = rows[0].deletedAt;
    const result = await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId,
      userId: "user_A",
    });
    expect(result.alreadyDeleted).toBe(true);
    expect(rows[0].deletedAt).toBe(firstDeletedAt);
  });

  it("rejects when userId mismatches", async () => {
    const { ctx } = makeCtx();
    const { visitId } = await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate(),
    );
    await expect(
      softDeleteVisitHandler(ctx as unknown as Ctx, {
        visitId,
        userId: "user_B",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.forbidden" } });
  });

  it("ConvexError on unknown id", async () => {
    const { ctx } = makeCtx();
    try {
      await softDeleteVisitHandler(ctx as unknown as Ctx, {
        visitId: "visit_404",
        userId: "user_A",
      });
      throw new Error("expected not_found");
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
    }
  });
});

describe("listVisitsHandler", () => {
  it("filters by date range, excludes soft-deleted, sorts newest-first", async () => {
    const { ctx, rows } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-28", clientRequestId: "r1" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-29", clientRequestId: "r2" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-30", clientRequestId: "r3" }),
    );
    rows[0].deletedAt = Date.now(); // soft-delete the 28th

    const result = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-29",
      toDate: "2026-04-30",
    });
    expect(result.map((r) => r.date)).toEqual(["2026-04-30", "2026-04-29"]);
  });

  it("works without fromDate / toDate", async () => {
    const { ctx } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-28", clientRequestId: "r1" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-05-15", clientRequestId: "r2" }),
    );
    const result = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(result.map((r) => r.date)).toEqual(["2026-05-15", "2026-04-28"]);
  });

  it("scopes by userId", async () => {
    const { ctx } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ userId: "user_A", clientRequestId: "rA" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ userId: "user_B", clientRequestId: "rB" }),
    );
    const result = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user_A");
  });
});

describe("getNextUpcomingVisitHandler", () => {
  it("returns the smallest date >= today, excludes soft-deleted", async () => {
    const { ctx, rows } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-20", clientRequestId: "rPast" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-05-10", clientRequestId: "rNear" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-06-01", clientRequestId: "rFar" }),
    );

    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      today: "2026-04-30",
    });
    expect(result?.date).toBe("2026-05-10");

    // Soft-delete the near one and re-query.
    const near = rows.find((r) => r.date === "2026-05-10");
    if (near) near.deletedAt = Date.now();
    const result2 = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      today: "2026-04-30",
    });
    expect(result2?.date).toBe("2026-06-01");
  });

  it("treats today's date as upcoming (>= today, not strictly >)", async () => {
    const { ctx } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-30", clientRequestId: "rToday" }),
    );
    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      today: "2026-04-30",
    });
    expect(result?.date).toBe("2026-04-30");
  });

  it("returns null when no future visits", async () => {
    const { ctx } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ date: "2026-04-01", clientRequestId: "rPast" }),
    );
    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      today: "2026-04-30",
    });
    expect(result).toBeNull();
  });

  it("rejects bad today format", async () => {
    const { ctx } = makeCtx();
    await expect(
      getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
        userId: "user_A",
        today: "today",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.bad_date_format" } });
  });
});

describe("getVisitsByDateHandler", () => {
  it("returns all non-soft-deleted visits for a date", async () => {
    const { ctx, rows } = makeCtx();
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ doctorName: "Dr. A", clientRequestId: "rA" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({ doctorName: "Dr. B", clientRequestId: "rB" }),
    );
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseCreate({
        doctorName: "Dr. Other",
        date: "2026-04-29",
        clientRequestId: "rO",
      }),
    );
    rows[1].deletedAt = Date.now(); // soft-delete Dr. B

    const result = await getVisitsByDateHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      date: "2026-04-30",
    });
    expect(result.map((r) => r.doctorName)).toEqual(["Dr. A"]);
  });

  it("rejects bad date format", async () => {
    const { ctx } = makeCtx();
    await expect(
      getVisitsByDateHandler(ctx as unknown as Ctx, {
        userId: "user_A",
        date: "30-04-2026",
      }),
    ).rejects.toMatchObject({ data: { code: "visit.bad_date_format" } });
  });
});
