/**
 * Handler tests for `convex/medications.ts`.
 *
 * Approach: same as `tests/check-in/convex-checkins.test.ts` — drive the
 * extracted plain-async handlers with a hand-rolled mock ctx whose `db`
 * emulates only the slice of the Convex DB API the handlers touch.
 * No `convex-test` dependency by design.
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  createMedicationHandler,
  updateMedicationHandler,
  deactivateMedicationHandler,
  listActiveMedicationsHandler,
  listAllMedicationsHandler,
  getTodayAdherenceHandler,
  type MedicationRow,
  type CreateMedicationArgs,
} from "@/convex/medications";

type IntakeRowLite = {
  _id: string;
  userId: string;
  medicationId: string;
  takenAt: number;
  date: string;
  source: "home-tap" | "check-in" | "module";
  clientRequestId: string;
  deletedAt?: number;
};

function makeCtx() {
  const meds: MedicationRow[] = [];
  const intakes: IntakeRowLite[] = [];
  let nextId = 1;

  const ctx = {
    db: {
      query: (table: "medications" | "intakeEvents") => ({
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
            collect: async () => {
              const source = table === "medications" ? meds : intakes;
              return (source as Array<Record<string, unknown>>).filter(
                (row) =>
                  eqs.every(({ field, value }) => row[field] === value),
              );
            },
          };
        },
      }),
      insert: async (
        table: "medications",
        doc: Omit<MedicationRow, "_id">,
      ): Promise<string> => {
        const id = `med_${nextId++}`;
        if (table === "medications") {
          meds.push({ ...doc, _id: id });
        }
        return id;
      },
      get: async (id: string): Promise<MedicationRow | null> =>
        meds.find((m) => m._id === id) ?? null,
      patch: async (id: string, fields: Partial<MedicationRow>) => {
        const target = meds.find((m) => m._id === id);
        if (target !== undefined) {
          Object.assign(target, fields);
        }
      },
    },
  };
  return { ctx, meds, intakes };
}

const baseCreate = (
  overrides: Partial<CreateMedicationArgs> = {},
): CreateMedicationArgs => ({
  userId: "user_A",
  name: "Methotrexate",
  dose: "15mg",
  frequency: "weekly",
  category: "immunosuppressant",
  delivery: "oral",
  ...overrides,
});

type Ctx = Parameters<typeof createMedicationHandler>[0];

describe("createMedicationHandler", () => {
  it("happy path inserts an active row", async () => {
    const { ctx, meds } = makeCtx();
    const result = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    expect(result.id).toMatch(/^med_/);
    expect(meds).toHaveLength(1);
    expect(meds[0].isActive).toBe(true);
    expect(meds[0].name).toBe("Methotrexate");
    expect(meds[0].createdAt).toBeGreaterThan(0);
    expect(meds[0].deactivatedAt).toBeUndefined();
  });

  it("trims name, dose, frequency", async () => {
    const { ctx, meds } = makeCtx();
    await createMedicationHandler(
      ctx as unknown as Ctx,
      baseCreate({ name: "  Folic acid  ", dose: " 5mg ", frequency: " daily " }),
    );
    expect(meds[0].name).toBe("Folic acid");
    expect(meds[0].dose).toBe("5mg");
    expect(meds[0].frequency).toBe("daily");
  });

  it("rejects empty name (after trim)", async () => {
    const { ctx } = makeCtx();
    await expect(
      createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "   " })),
    ).rejects.toMatchObject({ data: { code: "medication.invalid_name" } });
  });

  it("rejects empty dose (after trim)", async () => {
    const { ctx } = makeCtx();
    await expect(
      createMedicationHandler(ctx as unknown as Ctx, baseCreate({ dose: "" })),
    ).rejects.toMatchObject({ data: { code: "medication.invalid_dose" } });
  });

  it("rejects empty frequency (after trim)", async () => {
    const { ctx } = makeCtx();
    await expect(
      createMedicationHandler(ctx as unknown as Ctx, baseCreate({ frequency: "" })),
    ).rejects.toMatchObject({ data: { code: "medication.invalid_frequency" } });
  });
});

describe("updateMedicationHandler", () => {
  it("patches provided fields, leaves others untouched", async () => {
    const { ctx, meds } = makeCtx();
    const { id } = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    await updateMedicationHandler(ctx as unknown as Ctx, {
      medicationId: id,
      userId: "user_A",
      dose: "20mg",
    });
    expect(meds[0].dose).toBe("20mg");
    expect(meds[0].name).toBe("Methotrexate");
    expect(meds[0].frequency).toBe("weekly");
  });

  it("rejects when userId mismatches stored row (ADR-019)", async () => {
    const { ctx } = makeCtx();
    const { id } = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    await expect(
      updateMedicationHandler(ctx as unknown as Ctx, {
        medicationId: id,
        userId: "user_B",
        name: "Hijack",
      }),
    ).rejects.toMatchObject({ data: { code: "medication.forbidden" } });
  });

  it("rejects unknown medication id", async () => {
    const { ctx } = makeCtx();
    await expect(
      updateMedicationHandler(ctx as unknown as Ctx, {
        medicationId: "med_does_not_exist",
        userId: "user_A",
        dose: "20mg",
      }),
    ).rejects.toMatchObject({ data: { code: "medication.not_found" } });
  });

  it("rejects empty trimmed update fields", async () => {
    const { ctx } = makeCtx();
    const { id } = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    await expect(
      updateMedicationHandler(ctx as unknown as Ctx, {
        medicationId: id,
        userId: "user_A",
        name: "   ",
      }),
    ).rejects.toMatchObject({ data: { code: "medication.invalid_name" } });
  });

  it("ConvexError on userId mismatch", async () => {
    const { ctx } = makeCtx();
    const { id } = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    try {
      await updateMedicationHandler(ctx as unknown as Ctx, {
        medicationId: id,
        userId: "user_B",
        dose: "9mg",
      });
      throw new Error("expected forbidden");
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
    }
  });
});

describe("deactivateMedicationHandler", () => {
  it("flips isActive to false and stamps deactivatedAt", async () => {
    const { ctx, meds } = makeCtx();
    const { id } = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    const result = await deactivateMedicationHandler(ctx as unknown as Ctx, {
      medicationId: id,
      userId: "user_A",
    });
    expect(result.alreadyInactive).toBe(false);
    expect(meds[0].isActive).toBe(false);
    expect(meds[0].deactivatedAt).toBeGreaterThan(0);
  });

  it("idempotent on already-inactive row", async () => {
    const { ctx, meds } = makeCtx();
    const { id } = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    await deactivateMedicationHandler(ctx as unknown as Ctx, {
      medicationId: id,
      userId: "user_A",
    });
    const firstDeactivatedAt = meds[0].deactivatedAt;
    const result = await deactivateMedicationHandler(ctx as unknown as Ctx, {
      medicationId: id,
      userId: "user_A",
    });
    expect(result.alreadyInactive).toBe(true);
    // deactivatedAt should not be re-stamped on the second call.
    expect(meds[0].deactivatedAt).toBe(firstDeactivatedAt);
  });

  it("rejects when userId mismatches stored row (ADR-019)", async () => {
    const { ctx } = makeCtx();
    const { id } = await createMedicationHandler(ctx as unknown as Ctx, baseCreate());
    await expect(
      deactivateMedicationHandler(ctx as unknown as Ctx, {
        medicationId: id,
        userId: "user_B",
      }),
    ).rejects.toMatchObject({ data: { code: "medication.forbidden" } });
  });
});

describe("listActiveMedicationsHandler", () => {
  it("filters out inactive rows, sorts by createdAt asc", async () => {
    const { ctx, meds } = makeCtx();
    await createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "First" }));
    // Force createdAt ordering by mutating directly after insert.
    meds[0].createdAt = 1000;
    await createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "Second" }));
    meds[1].createdAt = 2000;
    await createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "Third" }));
    meds[2].createdAt = 3000;

    // Deactivate the middle one.
    meds[1].isActive = false;
    meds[1].deactivatedAt = 2500;

    const active = await listActiveMedicationsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(active.map((r) => r.name)).toEqual(["First", "Third"]);
  });

  it("scopes by userId", async () => {
    const { ctx } = makeCtx();
    await createMedicationHandler(
      ctx as unknown as Ctx,
      baseCreate({ userId: "user_A", name: "A-med" }),
    );
    await createMedicationHandler(
      ctx as unknown as Ctx,
      baseCreate({ userId: "user_B", name: "B-med" }),
    );
    const active = await listActiveMedicationsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("A-med");
  });
});

describe("listAllMedicationsHandler", () => {
  it("returns active + inactive sorted by createdAt asc", async () => {
    const { ctx, meds } = makeCtx();
    await createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "Old" }));
    meds[0].createdAt = 1000;
    meds[0].isActive = false;
    meds[0].deactivatedAt = 1500;
    await createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "New" }));
    meds[1].createdAt = 2000;

    const all = await listAllMedicationsHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(all.map((r) => r.name)).toEqual(["Old", "New"]);
  });
});

describe("getTodayAdherenceHandler", () => {
  it("flags taken vs not-taken correctly per active medication", async () => {
    const { ctx, meds, intakes } = makeCtx();
    const { id: medA } = await createMedicationHandler(
      ctx as unknown as Ctx,
      baseCreate({ name: "MedA" }),
    );
    meds[0].createdAt = 1000;
    const { id: medB } = await createMedicationHandler(
      ctx as unknown as Ctx,
      baseCreate({ name: "MedB" }),
    );
    meds[1].createdAt = 2000;

    // Taken MedA today; MedB not taken.
    intakes.push({
      _id: "i1",
      userId: "user_A",
      medicationId: medA,
      takenAt: 1700000000000,
      date: "2026-04-30",
      source: "home-tap",
      clientRequestId: "r1",
    });

    const result = await getTodayAdherenceHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      date: "2026-04-30",
    });
    expect(result).toHaveLength(2);
    expect(result[0].medication.name).toBe("MedA");
    expect(result[0].takenToday).toBe(true);
    expect(result[0].lastTakenAt).toBe(1700000000000);
    expect(result[1].medication.name).toBe("MedB");
    expect(result[1].takenToday).toBe(false);
    expect(result[1].lastTakenAt).toBeUndefined();

    // Sanity: ensure medB id is referenced (silences unused-var).
    expect(medB).toMatch(/^med_/);
  });

  it("ignores soft-deleted intakes", async () => {
    const { ctx, meds, intakes } = makeCtx();
    const { id: medA } = await createMedicationHandler(
      ctx as unknown as Ctx,
      baseCreate({ name: "MedA" }),
    );
    meds[0].createdAt = 1000;

    intakes.push({
      _id: "i1",
      userId: "user_A",
      medicationId: medA,
      takenAt: 1700000000000,
      date: "2026-04-30",
      source: "home-tap",
      clientRequestId: "r1",
      deletedAt: 1700000005000,
    });

    const result = await getTodayAdherenceHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      date: "2026-04-30",
    });
    expect(result[0].takenToday).toBe(false);
  });

  it("uses max takenAt when multiple intakes exist for a single med/day", async () => {
    const { ctx, meds, intakes } = makeCtx();
    const { id: medA } = await createMedicationHandler(
      ctx as unknown as Ctx,
      baseCreate({ name: "MedA" }),
    );
    meds[0].createdAt = 1000;

    intakes.push(
      {
        _id: "i1",
        userId: "user_A",
        medicationId: medA,
        takenAt: 1700000000000,
        date: "2026-04-30",
        source: "home-tap",
        clientRequestId: "r1",
      },
      {
        _id: "i2",
        userId: "user_A",
        medicationId: medA,
        takenAt: 1700000099999,
        date: "2026-04-30",
        source: "check-in",
        clientRequestId: "r2",
      },
    );

    const result = await getTodayAdherenceHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      date: "2026-04-30",
    });
    expect(result[0].lastTakenAt).toBe(1700000099999);
  });

  it("excludes inactive medications from the adherence list", async () => {
    const { ctx, meds } = makeCtx();
    await createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "Active" }));
    meds[0].createdAt = 1000;
    await createMedicationHandler(ctx as unknown as Ctx, baseCreate({ name: "Stopped" }));
    meds[1].createdAt = 2000;
    meds[1].isActive = false;
    meds[1].deactivatedAt = 2500;

    const result = await getTodayAdherenceHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      date: "2026-04-30",
    });
    expect(result.map((r) => r.medication.name)).toEqual(["Active"]);
  });
});
