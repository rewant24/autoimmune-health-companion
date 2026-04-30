/**
 * Feature 05 Cycle 1 — Doctor visits (first-class timeline events).
 *
 * Owned by chunk 5.A.
 *
 * Mutations:
 *   - `createVisit({ userId, date, doctorName, specialty?, visitType,
 *     notes?, source, checkInId?, clientRequestId? })`
 *   - `updateVisit({ visitId, userId, ...patch })` — userId-scoped guard.
 *   - `softDeleteVisit({ visitId, userId })` — sets `deletedAt`. Idempotent
 *     (returns `{ alreadyDeleted: true }` on a second call).
 *
 * Queries:
 *   - `listVisits({ userId, fromDate?, toDate? })` — newest first; soft-deleted excluded.
 *   - `getNextUpcomingVisit({ userId, today })` — soonest `date >= today`; null when none.
 *   - `getVisitsByDate({ userId, date })`
 *
 * Auth posture: client-trusted `userId` per ADR-019. Auth lands in F02 work
 * — at that point `userId` arg is dropped and `ctx.auth.getUserIdentity()`
 * is read instead.
 *
 * Pattern mirrors `convex/checkIns.ts`: handlers are extracted as plain
 * async functions accepting a structural ctx so vitest can drive them
 * with a mock db without `convex-test`.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// -- Validators --------------------------------------------------------------

const visitTypeValidator = v.union(
  v.literal("consultation"),
  v.literal("follow-up"),
  v.literal("urgent"),
  v.literal("other"),
);

const sourceValidator = v.union(
  v.literal("module"),
  v.literal("check-in"),
);

// -- Row + arg types ---------------------------------------------------------

export type VisitRow = {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  doctorName: string;
  specialty?: string;
  visitType: "consultation" | "follow-up" | "urgent" | "other";
  notes?: string;
  source: "module" | "check-in";
  checkInId?: string;
  createdAt: number;
  deletedAt?: number;
  /** F05 fix-pass: idempotency token, mirrors `checkIns.clientRequestId`. */
  clientRequestId: string;
};

export type CreateVisitArgs = {
  userId: string;
  date: string;
  doctorName: string;
  specialty?: string;
  visitType: VisitRow["visitType"];
  notes?: string;
  source: VisitRow["source"];
  checkInId?: string;
  /** F05 fix-pass: idempotency token; required at the API surface. */
  clientRequestId: string;
};

export type UpdateVisitArgs = {
  visitId: string;
  userId: string;
  date?: string;
  doctorName?: string;
  specialty?: string;
  visitType?: VisitRow["visitType"];
  notes?: string;
};

export type DeleteVisitArgs = {
  visitId: string;
  userId: string;
};

export type ListVisitsArgs = {
  userId: string;
  fromDate?: string;
  toDate?: string;
};

export type GetNextUpcomingVisitArgs = {
  userId: string;
  today: string; // YYYY-MM-DD
};

export type GetVisitsByDateArgs = {
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
  query: (table: "doctorVisits") => {
    withIndex: (
      name: "by_user_date" | "by_user_request",
      cb: (q: IndexBuilder) => IndexBuilder,
    ) => {
      collect: () => Promise<VisitRow[]>;
    };
  };
  get: (id: string) => Promise<VisitRow | null>;
};

type MutationHandlerCtx = {
  db: DbReader & {
    insert: (
      table: "doctorVisits",
      doc: Omit<VisitRow, "_id">,
    ) => Promise<string>;
    patch: (id: string, patch: Partial<VisitRow>) => Promise<void>;
  };
};

type QueryHandlerCtx = {
  db: DbReader;
};

// -- Handlers ----------------------------------------------------------------

/**
 * createVisit — write-through with shape validation. Mirrors checkIns:
 * trims `doctorName`, requires `checkInId` exactly when `source === 'check-in'`,
 * forbids `checkInId` when `source === 'module'`.
 */
export async function createVisitHandler(
  ctx: MutationHandlerCtx,
  args: CreateVisitArgs,
  now: () => number = Date.now,
): Promise<{ id: string }> {
  const doctorName = args.doctorName.trim();
  if (doctorName.length === 0) {
    throw new ConvexError({
      code: "visit.invalid_doctor_name",
      message: "doctorName must be non-empty after trim.",
    });
  }
  if (args.source === "check-in" && args.checkInId === undefined) {
    throw new ConvexError({
      code: "visit.missing_check_in_id",
      message: "checkInId is required when source is 'check-in'.",
    });
  }
  if (args.source === "module" && args.checkInId !== undefined) {
    throw new ConvexError({
      code: "visit.unexpected_check_in_id",
      message: "checkInId must be absent when source is 'module'.",
    });
  }

  // F05 fix-pass: idempotency. Mirrors `convex/checkIns.ts`. A retry with
  // the same (userId, clientRequestId) returns the existing row instead of
  // inserting a duplicate.
  const existing = await ctx.db
    .query("doctorVisits")
    .withIndex("by_user_request", (q) =>
      q.eq("userId", args.userId).eq("clientRequestId", args.clientRequestId),
    )
    .collect();
  const idempotentMatch = existing.find((r) => r.deletedAt === undefined);
  if (idempotentMatch !== undefined) {
    return { id: String(idempotentMatch._id) };
  }

  const id = await ctx.db.insert("doctorVisits", {
    userId: args.userId,
    date: args.date,
    doctorName,
    specialty: args.specialty,
    visitType: args.visitType,
    notes: args.notes,
    source: args.source,
    checkInId: args.checkInId,
    createdAt: now(),
    clientRequestId: args.clientRequestId,
  });

  return { id: String(id) };
}

/**
 * updateVisit — userId-scoped guard. Throws `visit.not_found` if the row
 * doesn't exist OR doesn't belong to args.userId OR is soft-deleted (cannot
 * edit a deleted row). All patch fields are optional; only provided keys
 * are written through.
 */
export async function updateVisitHandler(
  ctx: MutationHandlerCtx,
  args: UpdateVisitArgs,
): Promise<{ ok: true }> {
  const row = await ctx.db.get(args.visitId);
  if (row === null || row.userId !== args.userId || row.deletedAt !== undefined) {
    throw new ConvexError({
      code: "visit.not_found",
      message: "Visit not found for this user.",
    });
  }

  if (args.doctorName !== undefined) {
    const trimmed = args.doctorName.trim();
    if (trimmed.length === 0) {
      throw new ConvexError({
        code: "visit.invalid_doctor_name",
        message: "doctorName must be non-empty after trim.",
      });
    }
  }

  const patch: Partial<VisitRow> = {};
  if (args.date !== undefined) patch.date = args.date;
  if (args.doctorName !== undefined) patch.doctorName = args.doctorName.trim();
  if (args.specialty !== undefined) patch.specialty = args.specialty;
  if (args.visitType !== undefined) patch.visitType = args.visitType;
  if (args.notes !== undefined) patch.notes = args.notes;

  await ctx.db.patch(args.visitId, patch);
  return { ok: true };
}

/**
 * softDeleteVisit — sets `deletedAt`. Idempotent: a second call on an
 * already-deleted row is a no-op and returns `{ alreadyDeleted: true }`.
 * Throws `visit.not_found` if the row is missing or scoped to another user.
 */
export async function softDeleteVisitHandler(
  ctx: MutationHandlerCtx,
  args: DeleteVisitArgs,
  now: () => number = Date.now,
): Promise<{ alreadyDeleted: boolean }> {
  const row = await ctx.db.get(args.visitId);
  if (row === null || row.userId !== args.userId) {
    throw new ConvexError({
      code: "visit.not_found",
      message: "Visit not found for this user.",
    });
  }
  if (row.deletedAt !== undefined) {
    return { alreadyDeleted: true };
  }
  await ctx.db.patch(args.visitId, { deletedAt: now() });
  return { alreadyDeleted: false };
}

/**
 * listVisits — index by_user_date, filter soft-deleted, optional [from,to]
 * range. Sorted by date desc, then createdAt desc as tiebreaker.
 */
export async function listVisitsHandler(
  ctx: QueryHandlerCtx,
  args: ListVisitsArgs,
): Promise<{ items: VisitRow[] }> {
  const all = await ctx.db
    .query("doctorVisits")
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

/**
 * getNextUpcomingVisit — smallest `date >= today` excluding soft-deleted.
 * Tie-break by createdAt asc so the earliest-logged visit on a tied date
 * wins (deterministic). Returns null when no upcoming visit exists.
 */
export async function getNextUpcomingVisitHandler(
  ctx: QueryHandlerCtx,
  args: GetNextUpcomingVisitArgs,
): Promise<VisitRow | null> {
  const all = await ctx.db
    .query("doctorVisits")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();

  const upcoming = all
    .filter((row) => row.deletedAt === undefined)
    .filter((row) => row.date >= args.today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.createdAt - b.createdAt;
    });

  return upcoming[0] ?? null;
}

/**
 * getVisitsByDate — every live visit on a single YYYY-MM-DD.
 */
export async function getVisitsByDateHandler(
  ctx: QueryHandlerCtx,
  args: GetVisitsByDateArgs,
): Promise<{ items: VisitRow[] }> {
  const rows = await ctx.db
    .query("doctorVisits")
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

export const createVisit = mutation({
  args: {
    userId: v.string(),
    date: v.string(),
    doctorName: v.string(),
    specialty: v.optional(v.string()),
    visitType: visitTypeValidator,
    notes: v.optional(v.string()),
    source: sourceValidator,
    checkInId: v.optional(v.id("checkIns")),
    clientRequestId: v.string(),
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    return createVisitHandler(ctx as unknown as MutationHandlerCtx, args);
  },
});

export const updateVisit = mutation({
  args: {
    visitId: v.id("doctorVisits"),
    userId: v.string(),
    date: v.optional(v.string()),
    doctorName: v.optional(v.string()),
    specialty: v.optional(v.string()),
    visitType: v.optional(visitTypeValidator),
    notes: v.optional(v.string()),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    return updateVisitHandler(ctx as unknown as MutationHandlerCtx, {
      ...args,
      visitId: String(args.visitId),
    });
  },
});

export const softDeleteVisit = mutation({
  args: {
    visitId: v.id("doctorVisits"),
    userId: v.string(),
  },
  returns: v.object({ alreadyDeleted: v.boolean() }),
  handler: async (ctx, args) => {
    return softDeleteVisitHandler(ctx as unknown as MutationHandlerCtx, {
      visitId: String(args.visitId),
      userId: args.userId,
    });
  },
});

export const listVisits = query({
  args: {
    userId: v.string(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return listVisitsHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});

export const getNextUpcomingVisit = query({
  args: {
    userId: v.string(),
    today: v.string(),
  },
  handler: async (ctx, args) => {
    return getNextUpcomingVisitHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});

export const getVisitsByDate = query({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return getVisitsByDateHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});
