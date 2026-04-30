/**
 * Handler tests for `convex/dosageChanges.ts`.
 *
 * Atomicity: each `recordDosageChange` writes both a `dosageChanges` row
 * AND patches `medications.dose` — verified per US-4.A.3 acceptance.
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  recordDosageChangeHandler,
  listDosageChangesHandler,
  type DosageChangeRow,
  type RecordDosageChangeArgs,
} from "@/convex/dosageChanges";

type MedicationLite = {
  _id: string;
  userId: string;
  dose: string;
};

function makeCtx() {
  const meds: MedicationLite[] = [
    { _id: "med_1", userId: "user_A", dose: "10mg" },
    { _id: "med_2", userId: "user_B", dose: "5mg" },
  ];
  const changes: DosageChangeRow[] = [];
  let nextId = 1;

  const ctx = {
    db: {
      query: (_table: "dosageChanges") => ({
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
              changes.filter((row) =>
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
        _table: "dosageChanges",
        doc: Omit<DosageChangeRow, "_id">,
      ): Promise<string> => {
        const id = `chg_${nextId++}`;
        changes.push({ ...doc, _id: id });
        return id;
      },
      get: async (id: string): Promise<MedicationLite | null> =>
        meds.find((m) => m._id === id) ?? null,
      patch: async (id: string, fields: { dose: string }) => {
        const target = meds.find((m) => m._id === id);
        if (target !== undefined) {
          target.dose = fields.dose;
        }
      },
    },
  };
  return { ctx, meds, changes };
}

const baseChange = (
  overrides: Partial<RecordDosageChangeArgs> = {},
): RecordDosageChangeArgs => ({
  userId: "user_A",
  medicationId: "med_1",
  oldDose: "10mg",
  newDose: "15mg",
  source: "module",
  ...overrides,
});

type Ctx = Parameters<typeof recordDosageChangeHandler>[0];

describe("recordDosageChangeHandler — happy path + atomicity", () => {
  it("inserts audit row AND patches medications.dose to newDose", async () => {
    const { ctx, meds, changes } = makeCtx();
    const result = await recordDosageChangeHandler(ctx as unknown as Ctx, baseChange());
    expect(result.id).toMatch(/^chg_/);
    expect(changes).toHaveLength(1);
    expect(changes[0].oldDose).toBe("10mg");
    expect(changes[0].newDose).toBe("15mg");
    expect(changes[0].source).toBe("module");
    expect(changes[0].changedAt).toBeGreaterThan(0);
    // Medication patched.
    expect(meds[0].dose).toBe("15mg");
  });

  it("preserves prior oldDose in audit row even after subsequent changes", async () => {
    const { ctx, meds, changes } = makeCtx();
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({ oldDose: "10mg", newDose: "15mg" }),
    );
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({ oldDose: "15mg", newDose: "20mg" }),
    );
    expect(meds[0].dose).toBe("20mg");
    expect(changes).toHaveLength(2);
    expect(changes[0].oldDose).toBe("10mg");
    expect(changes[0].newDose).toBe("15mg");
    expect(changes[1].oldDose).toBe("15mg");
    expect(changes[1].newDose).toBe("20mg");
  });

  it("source 'check-in' with checkInId stores the link", async () => {
    const { ctx, changes } = makeCtx();
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({ source: "check-in", checkInId: "checkin_1" }),
    );
    expect(changes[0].source).toBe("check-in");
    expect(changes[0].checkInId).toBe("checkin_1");
  });

  it("stores reason when provided", async () => {
    const { ctx, changes } = makeCtx();
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({ reason: "tapering" }),
    );
    expect(changes[0].reason).toBe("tapering");
  });
});

describe("recordDosageChangeHandler — validation", () => {
  it("rejects oldDose === newDose with dosage.no_change", async () => {
    const { ctx } = makeCtx();
    await expect(
      recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ oldDose: "10mg", newDose: "10mg" }),
      ),
    ).rejects.toMatchObject({ data: { code: "dosage.no_change" } });
  });

  it("rejects same-value after trim", async () => {
    const { ctx } = makeCtx();
    await expect(
      recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ oldDose: "10mg", newDose: " 10mg " }),
      ),
    ).rejects.toMatchObject({ data: { code: "dosage.no_change" } });
  });

  it("rejects empty doses", async () => {
    const { ctx } = makeCtx();
    await expect(
      recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ newDose: "   " }),
      ),
    ).rejects.toMatchObject({ data: { code: "dosage.invalid_dose" } });
  });

  it("rejects source 'check-in' without checkInId", async () => {
    const { ctx } = makeCtx();
    await expect(
      recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ source: "check-in" }),
      ),
    ).rejects.toMatchObject({ data: { code: "dosage.checkin_id_required" } });
  });

  it("rejects source 'module' with checkInId", async () => {
    const { ctx } = makeCtx();
    await expect(
      recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ source: "module", checkInId: "checkin_1" }),
      ),
    ).rejects.toMatchObject({ data: { code: "dosage.checkin_id_forbidden" } });
  });

  it("rejects unknown medication id", async () => {
    const { ctx } = makeCtx();
    await expect(
      recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ medicationId: "med_does_not_exist" }),
      ),
    ).rejects.toMatchObject({ data: { code: "dosage.medication_not_found" } });
  });

  it("rejects when userId does not match medication owner (ADR-019)", async () => {
    const { ctx } = makeCtx();
    await expect(
      recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ userId: "user_A", medicationId: "med_2" }),
      ),
    ).rejects.toMatchObject({ data: { code: "dosage.forbidden" } });
  });

  it("validation errors are ConvexErrors", async () => {
    const { ctx } = makeCtx();
    try {
      await recordDosageChangeHandler(
        ctx as unknown as Ctx,
        baseChange({ oldDose: "10mg", newDose: "10mg" }),
      );
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError);
    }
  });
});

describe("listDosageChangesHandler", () => {
  it("returns all changes for user newest first when medicationId omitted", async () => {
    const { ctx, changes } = makeCtx();
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({ oldDose: "10mg", newDose: "15mg", changedAt: 1000 }),
    );
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({ oldDose: "15mg", newDose: "20mg", changedAt: 2000 }),
    );
    expect(changes).toHaveLength(2);

    const result = await listDosageChangesHandler(ctx as unknown as Ctx, {
      userId: "user_A",
    });
    expect(result.map((r) => r.changedAt)).toEqual([2000, 1000]);
  });

  it("filters by medicationId when provided", async () => {
    const { ctx, meds } = makeCtx();
    // Reassign med_2 to user_A so we can record a change against it.
    meds[1].userId = "user_A";
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({
        medicationId: "med_1",
        oldDose: "10mg",
        newDose: "15mg",
        changedAt: 1000,
      }),
    );
    await recordDosageChangeHandler(
      ctx as unknown as Ctx,
      baseChange({
        medicationId: "med_2",
        oldDose: "5mg",
        newDose: "10mg",
        changedAt: 2000,
      }),
    );
    const result = await listDosageChangesHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      medicationId: "med_1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].medicationId).toBe("med_1");
  });
});
