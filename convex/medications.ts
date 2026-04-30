/**
 * Feature 04 Cycle 1 — Medications regimen CRUD.
 *
 * Owned by chunk 4.A. Mirrors `convex/checkIns.ts`:
 *   - Extracted plain-async handlers driven by structurally-typed mock ctx
 *     in tests. The real Convex ctx satisfies the shape; the cast in the
 *     wrappers has no runtime effect.
 *   - Soft-delete via `isActive: false` + `deactivatedAt: number`. No hard
 *     delete — intake events + dose changes reference these rows.
 *
 * Auth posture: client-trusted `userId` arg per ADR-019. userId on every
 * mutation is checked defense-in-depth against the row's stored userId
 * before any update / deactivate. Auth slice tracked in post-MVP item 20.
 *
 * Stories owned by chunk 4.A:
 *   - US-4.A.1 Regimen CRUD (`createMedication`, `updateMedication`,
 *     `deactivateMedication`).
 *   - US-4.A.2 Idempotent intake logging — see `convex/intakeEvents.ts`.
 *   - US-4.A.3 Dosage change events — see `convex/dosageChanges.ts`.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Validators (must match `convex/schema.ts` medications table)
// ---------------------------------------------------------------------------

const categoryValidator = v.union(
  v.literal("arthritis-focused"),
  v.literal("immunosuppressant"),
  v.literal("steroid"),
  v.literal("nsaid"),
  v.literal("antidepressant"),
  v.literal("supplement"),
  v.literal("other"),
);

const deliveryValidator = v.union(
  v.literal("oral"),
  v.literal("injectable"),
  v.literal("iv"),
  v.literal("other"),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MedicationCategory =
  | "arthritis-focused"
  | "immunosuppressant"
  | "steroid"
  | "nsaid"
  | "antidepressant"
  | "supplement"
  | "other";

export type MedicationDelivery = "oral" | "injectable" | "iv" | "other";

export type MedicationRow = {
  _id: string;
  userId: string;
  name: string;
  dose: string;
  frequency: string;
  category: MedicationCategory;
  delivery: MedicationDelivery;
  isActive: boolean;
  createdAt: number;
  deactivatedAt?: number;
};

export type CreateMedicationArgs = {
  userId: string;
  name: string;
  dose: string;
  frequency: string;
  category: MedicationCategory;
  delivery: MedicationDelivery;
};

export type UpdateMedicationArgs = {
  medicationId: string;
  userId: string;
  name?: string;
  dose?: string;
  frequency?: string;
  category?: MedicationCategory;
  delivery?: MedicationDelivery;
};

export type DeactivateMedicationArgs = {
  medicationId: string;
  userId: string;
};

export type ListMedicationsArgs = {
  userId: string;
};

export type GetTodayAdherenceArgs = {
  userId: string;
  date: string;
};

export type AdherenceRow = {
  medication: MedicationRow;
  takenToday: boolean;
  lastTakenAt?: number;
};

// Minimal structural ctx the handlers depend on. The real Convex ctx
// satisfies this; tests use a hand-rolled mock.
type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
};

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

type MedicationsCtx = {
  db: {
    query: (table: "medications" | "intakeEvents") => {
      withIndex: (
        name: string,
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        collect: () => Promise<MedicationRow[] | IntakeRowLite[]>;
      };
    };
    insert: (
      table: "medications",
      doc: Omit<MedicationRow, "_id">,
    ) => Promise<string>;
    get: (id: string) => Promise<MedicationRow | null>;
    patch: (id: string, fields: Partial<MedicationRow>) => Promise<void>;
  };
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function createMedicationHandler(
  ctx: MedicationsCtx,
  args: CreateMedicationArgs,
  now: () => number = Date.now,
): Promise<{ id: string }> {
  const name = args.name.trim();
  const dose = args.dose.trim();
  const frequency = args.frequency.trim();

  if (name.length === 0) {
    throw new ConvexError({
      code: "medication.invalid_name",
      message: "Medication name is required.",
    });
  }
  if (dose.length === 0) {
    throw new ConvexError({
      code: "medication.invalid_dose",
      message: "Dose is required.",
    });
  }
  if (frequency.length === 0) {
    throw new ConvexError({
      code: "medication.invalid_frequency",
      message: "Frequency is required.",
    });
  }

  const id = await ctx.db.insert("medications", {
    userId: args.userId,
    name,
    dose,
    frequency,
    category: args.category,
    delivery: args.delivery,
    isActive: true,
    createdAt: now(),
  });

  return { id: String(id) };
}

export async function updateMedicationHandler(
  ctx: MedicationsCtx,
  args: UpdateMedicationArgs,
): Promise<{ id: string }> {
  const row = await ctx.db.get(args.medicationId);
  if (row === null) {
    throw new ConvexError({
      code: "medication.not_found",
      message: "Medication not found.",
    });
  }
  // Defense-in-depth (ADR-019): userId on the request must match the row.
  if (row.userId !== args.userId) {
    throw new ConvexError({
      code: "medication.forbidden",
      message: "Medication does not belong to this user.",
    });
  }

  const patch: Partial<MedicationRow> = {};
  if (args.name !== undefined) {
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "medication.invalid_name",
        message: "Medication name cannot be empty.",
      });
    }
    patch.name = name;
  }
  if (args.dose !== undefined) {
    const dose = args.dose.trim();
    if (dose.length === 0) {
      throw new ConvexError({
        code: "medication.invalid_dose",
        message: "Dose cannot be empty.",
      });
    }
    patch.dose = dose;
  }
  if (args.frequency !== undefined) {
    const frequency = args.frequency.trim();
    if (frequency.length === 0) {
      throw new ConvexError({
        code: "medication.invalid_frequency",
        message: "Frequency cannot be empty.",
      });
    }
    patch.frequency = frequency;
  }
  if (args.category !== undefined) {
    patch.category = args.category;
  }
  if (args.delivery !== undefined) {
    patch.delivery = args.delivery;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(args.medicationId, patch);
  }

  return { id: String(args.medicationId) };
}

export async function deactivateMedicationHandler(
  ctx: MedicationsCtx,
  args: DeactivateMedicationArgs,
  now: () => number = Date.now,
): Promise<{ id: string; alreadyInactive: boolean }> {
  const row = await ctx.db.get(args.medicationId);
  if (row === null) {
    throw new ConvexError({
      code: "medication.not_found",
      message: "Medication not found.",
    });
  }
  if (row.userId !== args.userId) {
    throw new ConvexError({
      code: "medication.forbidden",
      message: "Medication does not belong to this user.",
    });
  }
  if (row.isActive === false) {
    // Idempotent — calling on an already-inactive row is a successful no-op.
    return { id: String(args.medicationId), alreadyInactive: true };
  }
  await ctx.db.patch(args.medicationId, {
    isActive: false,
    deactivatedAt: now(),
  });
  return { id: String(args.medicationId), alreadyInactive: false };
}

export async function listActiveMedicationsHandler(
  ctx: MedicationsCtx,
  args: ListMedicationsArgs,
): Promise<MedicationRow[]> {
  const rows = (await ctx.db
    .query("medications")
    .withIndex("by_user_active", (q) =>
      q.eq("userId", args.userId).eq("isActive", true),
    )
    .collect()) as MedicationRow[];
  return rows
    .filter((r) => r.isActive === true)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listAllMedicationsHandler(
  ctx: MedicationsCtx,
  args: ListMedicationsArgs,
): Promise<MedicationRow[]> {
  const rows = (await ctx.db
    .query("medications")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .collect()) as MedicationRow[];
  return [...rows].sort((a, b) => a.createdAt - b.createdAt);
}

export async function getTodayAdherenceHandler(
  ctx: MedicationsCtx,
  args: GetTodayAdherenceArgs,
): Promise<AdherenceRow[]> {
  // Active regimen first (sorted by createdAt asc to match list order).
  const meds = (await ctx.db
    .query("medications")
    .withIndex("by_user_active", (q) =>
      q.eq("userId", args.userId).eq("isActive", true),
    )
    .collect()) as MedicationRow[];
  const active = meds
    .filter((r) => r.isActive === true)
    .sort((a, b) => a.createdAt - b.createdAt);

  // All intake events for (userId, date). We intentionally fetch via
  // by_user_date and filter in code so the structural mock ctx in tests
  // doesn't have to know about composite keys per medication.
  const intakes = (await ctx.db
    .query("intakeEvents")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .collect()) as IntakeRowLite[];
  const live = intakes.filter((r) => r.deletedAt === undefined);

  return active.map((medication) => {
    const forMed = live.filter((r) => r.medicationId === medication._id);
    if (forMed.length === 0) {
      return { medication, takenToday: false };
    }
    const lastTakenAt = forMed.reduce(
      (max, r) => (r.takenAt > max ? r.takenAt : max),
      0,
    );
    return { medication, takenToday: true, lastTakenAt };
  });
}

// ---------------------------------------------------------------------------
// Convex wrappers
// ---------------------------------------------------------------------------

export const createMedication = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    dose: v.string(),
    frequency: v.string(),
    category: categoryValidator,
    delivery: deliveryValidator,
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    return createMedicationHandler(ctx as unknown as MedicationsCtx, args);
  },
});

export const updateMedication = mutation({
  args: {
    medicationId: v.id("medications"),
    userId: v.string(),
    name: v.optional(v.string()),
    dose: v.optional(v.string()),
    frequency: v.optional(v.string()),
    category: v.optional(categoryValidator),
    delivery: v.optional(deliveryValidator),
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    return updateMedicationHandler(ctx as unknown as MedicationsCtx, {
      ...args,
      medicationId: String(args.medicationId),
    });
  },
});

export const deactivateMedication = mutation({
  args: {
    medicationId: v.id("medications"),
    userId: v.string(),
  },
  returns: v.object({ id: v.string(), alreadyInactive: v.boolean() }),
  handler: async (ctx, args) => {
    return deactivateMedicationHandler(ctx as unknown as MedicationsCtx, {
      ...args,
      medicationId: String(args.medicationId),
    });
  },
});

export const listActiveMedications = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return listActiveMedicationsHandler(ctx as unknown as MedicationsCtx, args);
  },
});

export const listAllMedications = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return listAllMedicationsHandler(ctx as unknown as MedicationsCtx, args);
  },
});

export const getTodayAdherence = query({
  args: { userId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    return getTodayAdherenceHandler(ctx as unknown as MedicationsCtx, args);
  },
});
