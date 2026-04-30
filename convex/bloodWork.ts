/**
 * Feature 05 Cycle 1 — Blood work results (structured markers).
 *
 * Owned by chunk 5.A.
 *
 * Mutations:
 *   - `createBloodWork({ userId, date, markers, notes?, source, checkInId? })`
 *     Validates: each marker has non-empty trimmed `name`, finite `value`,
 *     non-empty trimmed `unit`. `refRangeLow <= refRangeHigh` when both
 *     present. Empty `markers[]` → `bloodWork.no_markers`. `abnormal` is
 *     derived at write time when both bounds present (`value < low ||
 *     value > high`); a written-through `abnormal` value is trusted on
 *     update.
 *   - `updateBloodWork({ bloodWorkId, userId, ...patch })`
 *   - `softDeleteBloodWork({ bloodWorkId, userId })` — idempotent.
 *
 * Queries:
 *   - `listBloodWork({ userId, fromDate?, toDate? })` — by_user_date, soft-deleted excluded.
 *   - `getBloodWorkByDate({ userId, date })`
 *
 * Auth posture: client-trusted `userId` per ADR-019.
 *
 * PDF/image attachment + OCR are post-MVP (item 3).
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// -- Validators --------------------------------------------------------------

const markerValidator = v.object({
  name: v.string(),
  value: v.number(),
  unit: v.string(),
  refRangeLow: v.optional(v.number()),
  refRangeHigh: v.optional(v.number()),
  abnormal: v.optional(v.boolean()),
});

const sourceValidator = v.union(
  v.literal("module"),
  v.literal("check-in"),
);

// -- Types -------------------------------------------------------------------

export type Marker = {
  name: string;
  value: number;
  unit: string;
  refRangeLow?: number;
  refRangeHigh?: number;
  abnormal?: boolean;
};

export type BloodWorkRow = {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  markers: Marker[];
  notes?: string;
  source: "module" | "check-in";
  checkInId?: string;
  createdAt: number;
  deletedAt?: number;
  /** F05 fix-pass: idempotency token. */
  clientRequestId: string;
};

export type CreateBloodWorkArgs = {
  userId: string;
  date: string;
  markers: Marker[];
  notes?: string;
  source: BloodWorkRow["source"];
  checkInId?: string;
  /** F05 fix-pass: idempotency token; required at the API surface. */
  clientRequestId: string;
};

export type UpdateBloodWorkArgs = {
  bloodWorkId: string;
  userId: string;
  date?: string;
  markers?: Marker[];
  notes?: string;
};

export type DeleteBloodWorkArgs = {
  bloodWorkId: string;
  userId: string;
};

export type ListBloodWorkArgs = {
  userId: string;
  fromDate?: string;
  toDate?: string;
};

export type GetBloodWorkByDateArgs = {
  userId: string;
  date: string;
};

// -- Mock-friendly ctx shape -------------------------------------------------

type IndexBuilder = {
  eq: (
    field: "userId" | "date" | "clientRequestId",
    value: string,
  ) => IndexBuilder;
};

type DbReader = {
  query: (table: "bloodWork") => {
    withIndex: (
      name: "by_user_date" | "by_user_request",
      cb: (q: IndexBuilder) => IndexBuilder,
    ) => {
      collect: () => Promise<BloodWorkRow[]>;
    };
  };
  get: (id: string) => Promise<BloodWorkRow | null>;
};

type MutationHandlerCtx = {
  db: DbReader & {
    insert: (
      table: "bloodWork",
      doc: Omit<BloodWorkRow, "_id">,
    ) => Promise<string>;
    patch: (id: string, patch: Partial<BloodWorkRow>) => Promise<void>;
  };
};

type QueryHandlerCtx = {
  db: DbReader;
};

// -- Marker normalisation ----------------------------------------------------

/**
 * Validate + derive `abnormal` for each marker. Trims name + unit; throws
 * with descriptive codes on shape violations. Returns a fresh array so
 * callers don't mutate the input.
 */
export function normaliseMarkers(markers: Marker[]): Marker[] {
  if (markers.length === 0) {
    throw new ConvexError({
      code: "bloodWork.no_markers",
      message: "At least one marker is required.",
    });
  }
  return markers.map((m, idx) => {
    const name = m.name.trim();
    const unit = m.unit.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "bloodWork.invalid_marker_name",
        message: `Marker at index ${idx}: name must be non-empty.`,
      });
    }
    if (unit.length === 0) {
      throw new ConvexError({
        code: "bloodWork.invalid_marker_unit",
        message: `Marker at index ${idx}: unit must be non-empty.`,
      });
    }
    if (!Number.isFinite(m.value)) {
      throw new ConvexError({
        code: "bloodWork.invalid_marker_value",
        message: `Marker at index ${idx}: value must be finite.`,
      });
    }
    if (
      m.refRangeLow !== undefined &&
      m.refRangeHigh !== undefined &&
      m.refRangeLow > m.refRangeHigh
    ) {
      throw new ConvexError({
        code: "bloodWork.invalid_ref_range",
        message: `Marker at index ${idx}: refRangeLow must be <= refRangeHigh.`,
      });
    }

    let abnormal: boolean | undefined = m.abnormal;
    if (abnormal === undefined && m.refRangeLow !== undefined && m.refRangeHigh !== undefined) {
      abnormal = m.value < m.refRangeLow || m.value > m.refRangeHigh;
    }

    const normalised: Marker = {
      name,
      value: m.value,
      unit,
    };
    if (m.refRangeLow !== undefined) normalised.refRangeLow = m.refRangeLow;
    if (m.refRangeHigh !== undefined) normalised.refRangeHigh = m.refRangeHigh;
    if (abnormal !== undefined) normalised.abnormal = abnormal;
    return normalised;
  });
}

// -- Handlers ----------------------------------------------------------------

export async function createBloodWorkHandler(
  ctx: MutationHandlerCtx,
  args: CreateBloodWorkArgs,
  now: () => number = Date.now,
): Promise<{ id: string }> {
  if (args.source === "check-in" && args.checkInId === undefined) {
    throw new ConvexError({
      code: "bloodWork.missing_check_in_id",
      message: "checkInId is required when source is 'check-in'.",
    });
  }
  if (args.source === "module" && args.checkInId !== undefined) {
    throw new ConvexError({
      code: "bloodWork.unexpected_check_in_id",
      message: "checkInId must be absent when source is 'module'.",
    });
  }

  // F05 fix-pass: idempotency. Mirror checkIns + doctorVisits.
  const existing = await ctx.db
    .query("bloodWork")
    .withIndex("by_user_request", (q) =>
      q.eq("userId", args.userId).eq("clientRequestId", args.clientRequestId),
    )
    .collect();
  const idempotentMatch = existing.find((r) => r.deletedAt === undefined);
  if (idempotentMatch !== undefined) {
    return { id: String(idempotentMatch._id) };
  }

  const markers = normaliseMarkers(args.markers);

  const id = await ctx.db.insert("bloodWork", {
    userId: args.userId,
    date: args.date,
    markers,
    notes: args.notes,
    source: args.source,
    checkInId: args.checkInId,
    createdAt: now(),
    clientRequestId: args.clientRequestId,
  });

  return { id: String(id) };
}

export async function updateBloodWorkHandler(
  ctx: MutationHandlerCtx,
  args: UpdateBloodWorkArgs,
): Promise<{ ok: true }> {
  const row = await ctx.db.get(args.bloodWorkId);
  if (row === null || row.userId !== args.userId || row.deletedAt !== undefined) {
    throw new ConvexError({
      code: "bloodWork.not_found",
      message: "Blood work not found for this user.",
    });
  }

  const patch: Partial<BloodWorkRow> = {};
  if (args.date !== undefined) patch.date = args.date;
  if (args.notes !== undefined) patch.notes = args.notes;
  if (args.markers !== undefined) {
    patch.markers = normaliseMarkers(args.markers);
  }

  await ctx.db.patch(args.bloodWorkId, patch);
  return { ok: true };
}

export async function softDeleteBloodWorkHandler(
  ctx: MutationHandlerCtx,
  args: DeleteBloodWorkArgs,
  now: () => number = Date.now,
): Promise<{ alreadyDeleted: boolean }> {
  const row = await ctx.db.get(args.bloodWorkId);
  if (row === null || row.userId !== args.userId) {
    throw new ConvexError({
      code: "bloodWork.not_found",
      message: "Blood work not found for this user.",
    });
  }
  if (row.deletedAt !== undefined) {
    return { alreadyDeleted: true };
  }
  await ctx.db.patch(args.bloodWorkId, { deletedAt: now() });
  return { alreadyDeleted: false };
}

export async function listBloodWorkHandler(
  ctx: QueryHandlerCtx,
  args: ListBloodWorkArgs,
): Promise<{ items: BloodWorkRow[] }> {
  const all = await ctx.db
    .query("bloodWork")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();

  const items = all
    .filter((row) => row.deletedAt === undefined)
    .filter((row) =>
      args.fromDate !== undefined ? row.date >= args.fromDate : true,
    )
    .filter((row) =>
      args.toDate !== undefined ? row.date <= args.toDate : true,
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

  return { items };
}

export async function getBloodWorkByDateHandler(
  ctx: QueryHandlerCtx,
  args: GetBloodWorkByDateArgs,
): Promise<{ items: BloodWorkRow[] }> {
  const rows = await ctx.db
    .query("bloodWork")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .collect();

  const items = rows
    .filter((row) => row.deletedAt === undefined)
    .sort((a, b) => b.createdAt - a.createdAt);

  return { items };
}

// -- Convex wrappers ---------------------------------------------------------

export const createBloodWork = mutation({
  args: {
    userId: v.string(),
    date: v.string(),
    markers: v.array(markerValidator),
    notes: v.optional(v.string()),
    source: sourceValidator,
    checkInId: v.optional(v.id("checkIns")),
    clientRequestId: v.string(),
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    return createBloodWorkHandler(ctx as unknown as MutationHandlerCtx, args);
  },
});

export const updateBloodWork = mutation({
  args: {
    bloodWorkId: v.id("bloodWork"),
    userId: v.string(),
    date: v.optional(v.string()),
    markers: v.optional(v.array(markerValidator)),
    notes: v.optional(v.string()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    return updateBloodWorkHandler(ctx as unknown as MutationHandlerCtx, {
      ...args,
      bloodWorkId: String(args.bloodWorkId),
    });
  },
});

export const softDeleteBloodWork = mutation({
  args: {
    bloodWorkId: v.id("bloodWork"),
    userId: v.string(),
  },
  returns: v.object({ alreadyDeleted: v.boolean() }),
  handler: async (ctx, args) => {
    return softDeleteBloodWorkHandler(ctx as unknown as MutationHandlerCtx, {
      bloodWorkId: String(args.bloodWorkId),
      userId: args.userId,
    });
  },
});

export const listBloodWork = query({
  args: {
    userId: v.string(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return listBloodWorkHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});

export const getBloodWorkByDate = query({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return getBloodWorkByDateHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});
