/**
 * Feature 05 Cycle 1 — Doctor visits (first-class timeline events).
 *
 * Owned by chunk 5.A. Pattern mirrors `convex/medications.ts` +
 * `convex/intakeEvents.ts`:
 *   - Plain async `*Handler` functions driven by structurally-typed mock
 *     ctx in tests. The real Convex ctx satisfies the shape; the cast in
 *     the wrappers has no runtime effect.
 *   - Soft-delete via `deletedAt` (ms timestamp). Hard delete is post-MVP.
 *   - `clientRequestId` collapses retries on create.
 *
 * Capture paths:
 *   - `module`    — explicit log inside /visits/new
 *   - `check-in`  — voice extraction during a check-in (links to checkInId)
 *
 * Auth posture: client-trusted `userId` per ADR-019. Defense-in-depth on
 * update + soft-delete (the row's userId must match).
 *
 * Stories owned: US-5.A.1 visits CRUD, US-5.A.3 soft-delete idempotency.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Validators / types
// ---------------------------------------------------------------------------

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

export type VisitType = "consultation" | "follow-up" | "urgent" | "other";
export type VisitSource = "module" | "check-in";

const VALID_VISIT_TYPES: ReadonlyArray<VisitType> = [
  "consultation",
  "follow-up",
  "urgent",
  "other",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DoctorVisitRow = {
  _id: string;
  userId: string;
  date: string;
  doctorName: string;
  specialty?: string;
  visitType: VisitType;
  notes?: string;
  source: VisitSource;
  checkInId?: string;
  clientRequestId: string;
  createdAt: number;
  deletedAt?: number;
};

export type CreateVisitArgs = {
  userId: string;
  date: string;
  doctorName: string;
  specialty?: string;
  visitType: VisitType;
  notes?: string;
  source: VisitSource;
  checkInId?: string;
  clientRequestId: string;
};

export type UpdateVisitArgs = {
  visitId: string;
  userId: string;
  date?: string;
  doctorName?: string;
  specialty?: string;
  visitType?: VisitType;
  notes?: string;
};

export type SoftDeleteVisitArgs = {
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
  today: string;
};

export type GetVisitsByDateArgs = {
  userId: string;
  date: string;
};

// Structural ctx — same approach as convex/medications.ts.
type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
  // W2-2: range bounds ride the index (feedback_memory_aggregation_index_bounds).
  gte: (field: string, value: unknown) => IndexBuilder;
  lte: (field: string, value: unknown) => IndexBuilder;
};

type VisitsCtx = {
  db: {
    query: (table: "doctorVisits") => {
      withIndex: (
        name: string,
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        collect: () => Promise<DoctorVisitRow[]>;
      };
    };
    insert: (
      table: "doctorVisits",
      doc: Omit<DoctorVisitRow, "_id">,
    ) => Promise<string>;
    get: (id: string) => Promise<DoctorVisitRow | null>;
    patch: (id: string, fields: Partial<DoctorVisitRow>) => Promise<void>;
  };
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertVisitDate(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new ConvexError({
      code: "visit.bad_date_format",
      message: "Visit date must be YYYY-MM-DD.",
    });
  }
}

function assertVisitType(visitType: string): void {
  if (!VALID_VISIT_TYPES.includes(visitType as VisitType)) {
    throw new ConvexError({
      code: "visit.bad_visit_type",
      message: "Unknown visit type.",
    });
  }
}

function assertSourceCheckInInvariant(
  source: VisitSource,
  checkInId: string | undefined,
): void {
  // checkInId is best-effort when source='check-in'. The check-in row may
  // not yet be persisted at the moment a confirm-card fires (cards are
  // non-blocking), so we accept the omission. We still reject empty-string
  // checkInId as a likely bug, and reject checkInId on source='module'
  // since the module path has no associated check-in.
  if (source === "check-in" && checkInId === "") {
    throw new ConvexError({
      code: "visit.empty_check_in_id",
      message: "checkInId, when provided, must be non-empty.",
    });
  }
  if (source === "module" && checkInId !== undefined) {
    throw new ConvexError({
      code: "visit.unexpected_check_in_id",
      message: "checkInId must be absent when source is 'module'.",
    });
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function createVisitHandler(
  ctx: VisitsCtx,
  args: CreateVisitArgs,
  now: () => number = Date.now,
): Promise<{ visitId: string; deduped: boolean }> {
  const doctorName = args.doctorName.trim();
  if (doctorName.length === 0) {
    throw new ConvexError({
      code: "visit.no_doctor_name",
      message: "Doctor name is required.",
    });
  }

  assertVisitDate(args.date);
  assertVisitType(args.visitType);
  assertSourceCheckInInvariant(args.source, args.checkInId);

  // Idempotency on clientRequestId — scoped to userId. Skip soft-deleted.
  // W2-2: point lookup on the new by_user_client_request index instead of
  // scanning the user's whole visit history.
  const existingForUser = await ctx.db
    .query("doctorVisits")
    .withIndex("by_user_client_request", (q) =>
      q.eq("userId", args.userId).eq("clientRequestId", args.clientRequestId),
    )
    .collect();
  const idem = existingForUser.find(
    (r) =>
      r.deletedAt === undefined &&
      r.clientRequestId === args.clientRequestId,
  );
  if (idem !== undefined) {
    return { visitId: String(idem._id), deduped: true };
  }

  const specialty =
    args.specialty !== undefined ? args.specialty.trim() : undefined;
  const notes = args.notes !== undefined ? args.notes.trim() : undefined;

  const doc: Omit<DoctorVisitRow, "_id"> = {
    userId: args.userId,
    date: args.date,
    doctorName,
    visitType: args.visitType,
    source: args.source,
    clientRequestId: args.clientRequestId,
    createdAt: now(),
  };
  if (specialty !== undefined && specialty.length > 0) {
    doc.specialty = specialty;
  }
  if (notes !== undefined && notes.length > 0) {
    doc.notes = notes;
  }
  if (args.checkInId !== undefined) {
    doc.checkInId = args.checkInId;
  }

  const id = await ctx.db.insert("doctorVisits", doc);
  return { visitId: String(id), deduped: false };
}

export async function updateVisitHandler(
  ctx: VisitsCtx,
  args: UpdateVisitArgs,
): Promise<{ visitId: string }> {
  const row = await ctx.db.get(args.visitId);
  if (row === null) {
    throw new ConvexError({
      code: "visit.not_found",
      message: "Visit not found.",
    });
  }
  if (row.userId !== args.userId) {
    throw new ConvexError({
      code: "visit.forbidden",
      message: "Visit does not belong to this user.",
    });
  }
  if (row.deletedAt !== undefined) {
    throw new ConvexError({
      code: "visit.deleted",
      message: "Cannot update a soft-deleted visit.",
    });
  }

  const patch: Partial<DoctorVisitRow> = {};

  if (args.date !== undefined) {
    assertVisitDate(args.date);
    patch.date = args.date;
  }
  if (args.doctorName !== undefined) {
    const doctorName = args.doctorName.trim();
    if (doctorName.length === 0) {
      throw new ConvexError({
        code: "visit.no_doctor_name",
        message: "Doctor name cannot be empty.",
      });
    }
    patch.doctorName = doctorName;
  }
  if (args.specialty !== undefined) {
    const specialty = args.specialty.trim();
    patch.specialty = specialty.length === 0 ? undefined : specialty;
  }
  if (args.visitType !== undefined) {
    assertVisitType(args.visitType);
    patch.visitType = args.visitType;
  }
  if (args.notes !== undefined) {
    const notes = args.notes.trim();
    patch.notes = notes.length === 0 ? undefined : notes;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(args.visitId, patch);
  }

  return { visitId: String(args.visitId) };
}

export async function softDeleteVisitHandler(
  ctx: VisitsCtx,
  args: SoftDeleteVisitArgs,
  now: () => number = Date.now,
): Promise<{ visitId: string; alreadyDeleted: boolean }> {
  const row = await ctx.db.get(args.visitId);
  if (row === null) {
    throw new ConvexError({
      code: "visit.not_found",
      message: "Visit not found.",
    });
  }
  if (row.userId !== args.userId) {
    throw new ConvexError({
      code: "visit.forbidden",
      message: "Visit does not belong to this user.",
    });
  }
  if (row.deletedAt !== undefined) {
    return { visitId: String(args.visitId), alreadyDeleted: true };
  }
  await ctx.db.patch(args.visitId, { deletedAt: now() });
  return { visitId: String(args.visitId), alreadyDeleted: false };
}

export async function listVisitsHandler(
  ctx: VisitsCtx,
  args: ListVisitsArgs,
): Promise<DoctorVisitRow[]> {
  // W2-2: optional bounds ride the index; JS filters stay as defense.
  const rows = await ctx.db
    .query("doctorVisits")
    .withIndex("by_user_date", (q) => {
      let b = q.eq("userId", args.userId);
      if (args.fromDate !== undefined) b = b.gte("date", args.fromDate);
      if (args.toDate !== undefined) b = b.lte("date", args.toDate);
      return b;
    })
    .collect();
  return rows
    .filter((r) => r.deletedAt === undefined)
    .filter(
      (r) =>
        (args.fromDate === undefined || r.date >= args.fromDate) &&
        (args.toDate === undefined || r.date <= args.toDate),
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });
}

export async function getNextUpcomingVisitHandler(
  ctx: VisitsCtx,
  args: GetNextUpcomingVisitArgs,
): Promise<DoctorVisitRow | null> {
  assertVisitDate(args.today);
  // W2-2: the >= today bound rides the index — only future rows scan.
  const rows = await ctx.db
    .query("doctorVisits")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).gte("date", args.today),
    )
    .collect();
  const upcoming = rows
    .filter((r) => r.deletedAt === undefined)
    .filter((r) => r.date >= args.today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  return upcoming.length === 0 ? null : upcoming[0];
}

export async function getVisitsByDateHandler(
  ctx: VisitsCtx,
  args: GetVisitsByDateArgs,
): Promise<DoctorVisitRow[]> {
  assertVisitDate(args.date);
  const rows = await ctx.db
    .query("doctorVisits")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .collect();
  return rows
    .filter((r) => r.deletedAt === undefined)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---------------------------------------------------------------------------
// Convex wrappers
// ---------------------------------------------------------------------------

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
  returns: v.object({ visitId: v.string(), deduped: v.boolean() }),
  handler: async (ctx, args) => {
    return createVisitHandler(ctx as unknown as VisitsCtx, {
      ...args,
      checkInId:
        args.checkInId === undefined ? undefined : String(args.checkInId),
    });
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
  returns: v.object({ visitId: v.string() }),
  handler: async (ctx, args) => {
    return updateVisitHandler(ctx as unknown as VisitsCtx, {
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
  returns: v.object({ visitId: v.string(), alreadyDeleted: v.boolean() }),
  handler: async (ctx, args) => {
    return softDeleteVisitHandler(ctx as unknown as VisitsCtx, {
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
    return listVisitsHandler(ctx as unknown as VisitsCtx, args);
  },
});

export const getNextUpcomingVisit = query({
  args: {
    userId: v.string(),
    today: v.string(),
  },
  handler: async (ctx, args) => {
    return getNextUpcomingVisitHandler(ctx as unknown as VisitsCtx, args);
  },
});

export const getVisitsByDate = query({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return getVisitsByDateHandler(ctx as unknown as VisitsCtx, args);
  },
});
