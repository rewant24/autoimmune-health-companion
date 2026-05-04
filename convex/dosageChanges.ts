/**
 * Feature 04 Cycle 1 — Dosage change audit trail.
 *
 * Owned by chunk 4.A. Mirror the convex/checkIns.ts handler-extraction
 * pattern: structurally-typed mock ctx in tests, real Convex ctx satisfies
 * the shape, cast in the wrapper has no runtime effect.
 *
 * `recordDosageChange` is atomic — it patches `medications.dose` AND
 * inserts the audit row in the same mutation. Because Convex mutations
 * are transactional, both writes commit together (or not at all).
 *
 * Validation rules (per US-4.A.3 acceptance):
 *   - oldDose !== newDose; otherwise throws `dosage.no_change`.
 *   - source 'check-in' requires `checkInId`; source 'module' must omit it.
 *   - Defense-in-depth (ADR-019): the medication's userId must match the
 *     userId on the request before any write happens.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Validators / types
// ---------------------------------------------------------------------------

const sourceValidator = v.union(
  v.literal("module"),
  v.literal("check-in"),
);

export type DosageChangeSource = "module" | "check-in";

export type DosageChangeRow = {
  _id: string;
  userId: string;
  medicationId: string;
  oldDose: string;
  newDose: string;
  changedAt: number;
  reason?: string;
  source: DosageChangeSource;
  checkInId?: string;
};

export type RecordDosageChangeArgs = {
  userId: string;
  medicationId: string;
  oldDose: string;
  newDose: string;
  reason?: string;
  source: DosageChangeSource;
  checkInId?: string;
  changedAt?: number;
};

export type ListDosageChangesArgs = {
  userId: string;
  medicationId?: string;
};

// Structural ctx — mirrors the by-now-familiar pattern.
type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
};

// Lightweight medication shape — we only read userId + dose for the
// defense-in-depth check and audit. Avoids importing MedicationRow.
type MedicationLite = {
  _id: string;
  userId: string;
  dose: string;
};

type DosageCtx = {
  db: {
    query: (table: "dosageChanges") => {
      withIndex: (
        name: string,
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        collect: () => Promise<DosageChangeRow[]>;
      };
    };
    insert: (
      table: "dosageChanges",
      doc: Omit<DosageChangeRow, "_id">,
    ) => Promise<string>;
    get: (id: string) => Promise<MedicationLite | null>;
    patch: (id: string, fields: { dose: string }) => Promise<void>;
  };
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function recordDosageChangeHandler(
  ctx: DosageCtx,
  args: RecordDosageChangeArgs,
  now: () => number = Date.now,
): Promise<{ id: string }> {
  const oldDose = args.oldDose.trim();
  const newDose = args.newDose.trim();

  if (oldDose.length === 0 || newDose.length === 0) {
    throw new ConvexError({
      code: "dosage.invalid_dose",
      message: "Both oldDose and newDose are required.",
    });
  }

  if (oldDose === newDose) {
    throw new ConvexError({
      code: "dosage.no_change",
      message: "newDose must differ from oldDose.",
    });
  }

  // Source / checkInId well-formedness.
  if (args.source === "check-in" && args.checkInId === undefined) {
    throw new ConvexError({
      code: "dosage.checkin_id_required",
      message: "checkInId is required when source is 'check-in'.",
    });
  }
  if (args.source === "module" && args.checkInId !== undefined) {
    throw new ConvexError({
      code: "dosage.checkin_id_forbidden",
      message: "checkInId must not be set when source is 'module'.",
    });
  }

  // Defense-in-depth (ADR-019): the medication must belong to this user.
  const med = await ctx.db.get(args.medicationId);
  if (med === null) {
    throw new ConvexError({
      code: "dosage.medication_not_found",
      message: "Medication not found.",
    });
  }
  if (med.userId !== args.userId) {
    throw new ConvexError({
      code: "dosage.forbidden",
      message: "Medication does not belong to this user.",
    });
  }

  // Atomic: insert audit row + patch medication.dose.
  const id = await ctx.db.insert("dosageChanges", {
    userId: args.userId,
    medicationId: args.medicationId,
    oldDose,
    newDose,
    changedAt: args.changedAt ?? now(),
    reason: args.reason,
    source: args.source,
    checkInId: args.checkInId,
  });
  await ctx.db.patch(args.medicationId, { dose: newDose });

  return { id: String(id) };
}

export async function listDosageChangesHandler(
  ctx: DosageCtx,
  args: ListDosageChangesArgs,
): Promise<DosageChangeRow[]> {
  if (args.medicationId !== undefined) {
    const medId = args.medicationId;
    const rows = await ctx.db
      .query("dosageChanges")
      .withIndex("by_user_med", (q) =>
        q.eq("userId", args.userId).eq("medicationId", medId),
      )
      .collect();
    return [...rows].sort((a, b) => b.changedAt - a.changedAt);
  }
  const rows = await ctx.db
    .query("dosageChanges")
    .withIndex("by_user_changed_at", (q) => q.eq("userId", args.userId))
    .collect();
  return [...rows].sort((a, b) => b.changedAt - a.changedAt);
}

// ---------------------------------------------------------------------------
// Convex wrappers
// ---------------------------------------------------------------------------

export const recordDosageChange = mutation({
  args: {
    userId: v.string(),
    medicationId: v.id("medications"),
    oldDose: v.string(),
    newDose: v.string(),
    reason: v.optional(v.string()),
    source: sourceValidator,
    checkInId: v.optional(v.id("checkIns")),
    changedAt: v.optional(v.number()),
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    return recordDosageChangeHandler(ctx as unknown as DosageCtx, {
      ...args,
      medicationId: String(args.medicationId),
      checkInId:
        args.checkInId === undefined ? undefined : String(args.checkInId),
    });
  },
});

export const listDosageChanges = query({
  args: {
    userId: v.string(),
    medicationId: v.optional(v.id("medications")),
  },
  handler: async (ctx, args) => {
    return listDosageChangesHandler(ctx as unknown as DosageCtx, {
      userId: args.userId,
      medicationId:
        args.medicationId === undefined
          ? undefined
          : String(args.medicationId),
    });
  },
});
