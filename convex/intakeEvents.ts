/**
 * Feature 04 Cycle 1 — Medication intake events.
 *
 * Owned by chunk 4.A. Mirrors `convex/checkIns.ts` for idempotency.
 *
 * Two capture paths feed this table:
 *   - `home-tap`  — user tapped the IntakeTapList card on /home
 *   - `check-in`  — voice flow extracted "I took my morning meds"
 *   - `module`    — explicit log inside /medications
 *
 * Cross-path dedupe (US-4.A.2): if a non-deleted intake row already
 * exists for `(userId, medicationId, date)` from any source, the second
 * call is a no-op that returns the existing row id with its existing
 * source — first writer wins. This collapses the home-tap → check-in
 * race called out in scoping § Daily adherence.
 *
 * Auth posture: client-trusted `userId` per ADR-019. Defense-in-depth
 * applied when soft-deleting (the row's userId must match).
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Validators / types
// ---------------------------------------------------------------------------

const sourceValidator = v.union(
  v.literal("home-tap"),
  v.literal("check-in"),
  v.literal("module"),
);

export type IntakeSource = "home-tap" | "check-in" | "module";

export type IntakeEventRow = {
  _id: string;
  userId: string;
  medicationId: string;
  takenAt: number;
  date: string;
  source: IntakeSource;
  clientRequestId: string;
  deletedAt?: number;
};

export type LogIntakeArgs = {
  userId: string;
  medicationId: string;
  date: string;
  source: IntakeSource;
  clientRequestId: string;
  takenAt?: number;
};

export type SoftDeleteIntakeArgs = {
  id: string;
  userId: string;
};

export type ListIntakeEventsArgs = {
  userId: string;
  fromDate: string;
  toDate: string;
};

// Structural ctx — same approach as convex/checkIns.ts.
type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
};

type IntakeCtx = {
  db: {
    query: (table: "intakeEvents") => {
      withIndex: (
        name: string,
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        collect: () => Promise<IntakeEventRow[]>;
      };
    };
    insert: (
      table: "intakeEvents",
      doc: Omit<IntakeEventRow, "_id">,
    ) => Promise<string>;
    get: (id: string) => Promise<IntakeEventRow | null>;
    patch: (id: string, fields: Partial<IntakeEventRow>) => Promise<void>;
  };
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function logIntakeHandler(
  ctx: IntakeCtx,
  args: LogIntakeArgs,
  now: () => number = Date.now,
): Promise<{ id: string; deduped: boolean; source: IntakeSource }> {
  // Pull all existing intake rows for (userId, medicationId, date). The
  // by_user_med_date index lets us narrow precisely.
  const candidates = await ctx.db
    .query("intakeEvents")
    .withIndex("by_user_med_date", (q) =>
      q
        .eq("userId", args.userId)
        .eq("medicationId", args.medicationId)
        .eq("date", args.date),
    )
    .collect();
  const live = candidates.filter((r) => r.deletedAt === undefined);

  // Idempotency on clientRequestId — return the same row regardless of source.
  const idem = live.find((r) => r.clientRequestId === args.clientRequestId);
  if (idem !== undefined) {
    return { id: String(idem._id), deduped: true, source: idem.source };
  }

  // Cross-path dedupe: any non-deleted intake for this (user, med, date)
  // wins. First writer's source is preserved.
  if (live.length > 0) {
    const first = live[0];
    return { id: String(first._id), deduped: true, source: first.source };
  }

  const takenAt = args.takenAt ?? now();
  const id = await ctx.db.insert("intakeEvents", {
    userId: args.userId,
    medicationId: args.medicationId,
    takenAt,
    date: args.date,
    source: args.source,
    clientRequestId: args.clientRequestId,
  });

  return { id: String(id), deduped: false, source: args.source };
}

export async function softDeleteIntakeHandler(
  ctx: IntakeCtx,
  args: SoftDeleteIntakeArgs,
  now: () => number = Date.now,
): Promise<{ id: string; alreadyDeleted: boolean }> {
  const row = await ctx.db.get(args.id);
  if (row === null) {
    throw new ConvexError({
      code: "intake.not_found",
      message: "Intake event not found.",
    });
  }
  if (row.userId !== args.userId) {
    throw new ConvexError({
      code: "intake.forbidden",
      message: "Intake event does not belong to this user.",
    });
  }
  if (row.deletedAt !== undefined) {
    return { id: String(args.id), alreadyDeleted: true };
  }
  await ctx.db.patch(args.id, { deletedAt: now() });
  return { id: String(args.id), alreadyDeleted: false };
}

export async function listIntakeEventsHandler(
  ctx: IntakeCtx,
  args: ListIntakeEventsArgs,
): Promise<IntakeEventRow[]> {
  const rows = await ctx.db
    .query("intakeEvents")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();
  return rows
    .filter((r) => r.deletedAt === undefined)
    .filter((r) => r.date >= args.fromDate && r.date <= args.toDate)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.takenAt - a.takenAt;
    });
}

export async function listIntakeEventsByDateHandler(
  ctx: IntakeCtx,
  args: { userId: string; date: string },
): Promise<IntakeEventRow[]> {
  const rows = await ctx.db
    .query("intakeEvents")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .collect();
  return rows
    .filter((r) => r.deletedAt === undefined)
    .sort((a, b) => b.takenAt - a.takenAt);
}

// ---------------------------------------------------------------------------
// Convex wrappers
// ---------------------------------------------------------------------------

export const logIntake = mutation({
  args: {
    userId: v.string(),
    medicationId: v.id("medications"),
    date: v.string(),
    source: sourceValidator,
    clientRequestId: v.string(),
    takenAt: v.optional(v.number()),
  },
  returns: v.object({
    id: v.string(),
    deduped: v.boolean(),
    source: sourceValidator,
  }),
  handler: async (ctx, args) => {
    return logIntakeHandler(ctx as unknown as IntakeCtx, {
      ...args,
      medicationId: String(args.medicationId),
    });
  },
});

export const softDeleteIntake = mutation({
  args: {
    id: v.id("intakeEvents"),
    userId: v.string(),
  },
  returns: v.object({ id: v.string(), alreadyDeleted: v.boolean() }),
  handler: async (ctx, args) => {
    return softDeleteIntakeHandler(ctx as unknown as IntakeCtx, {
      id: String(args.id),
      userId: args.userId,
    });
  },
});

export const listIntakeEvents = query({
  args: {
    userId: v.string(),
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    return listIntakeEventsHandler(ctx as unknown as IntakeCtx, args);
  },
});

export const listIntakeEventsByDate = query({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return listIntakeEventsByDateHandler(ctx as unknown as IntakeCtx, args);
  },
});
