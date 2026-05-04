import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  eventFromCheckin,
  eventFromIntake,
  type IntakeEventRow,
  type IntakeMedication,
  type MemoryEvent,
} from "../lib/memory/event-types";

// Mood enum (scoping-verbatim: heavy | flat | okay | bright | great).
const moodValidator = v.union(
  v.literal("heavy"),
  v.literal("flat"),
  v.literal("okay"),
  v.literal("bright"),
  v.literal("great"),
);

const stageValidator = v.union(
  v.literal("open"),
  v.literal("scripted"),
  v.literal("hybrid"),
);

// Tri-state flare validator (Cycle 2 — replaces boolean per scoping).
const flareValidator = v.union(
  v.literal("no"),
  v.literal("yes"),
  v.literal("ongoing"),
);

// Declined metrics array (Cycle 2 — distinct from "not captured").
const metricLiteralValidator = v.union(
  v.literal("pain"),
  v.literal("mood"),
  v.literal("adherenceTaken"),
  v.literal("flare"),
  v.literal("energy"),
);

// Structural row type used by the extracted handlers so they can be
// exercised with a mock ctx in tests without depending on `Doc<"checkIns">`
// from the Convex generated types.
//
// Cycle 2 update (2026-04-25):
// - All five metrics now optional (undefined = declined or not captured).
//   Code MUST treat undefined and "in declined[]" together as "skipped".
// - `flare` migrated from boolean → 'no'|'yes'|'ongoing'.
// - Added `declined: Metric[]` and `appendedTo: id('checkIns')`.
export type CheckinRow = {
  _id: string;
  userId: string;
  date: string;
  createdAt: number;
  pain?: number;
  mood?: "heavy" | "flat" | "okay" | "bright" | "great";
  adherenceTaken?: boolean;
  flare?: "no" | "yes" | "ongoing";
  energy?: number;
  declined?: Array<"pain" | "mood" | "adherenceTaken" | "flare" | "energy">;
  appendedTo?: string;
  transcript: string;
  stage: "open" | "scripted" | "hybrid";
  durationMs: number;
  providerUsed: string;
  clientRequestId: string;
  editedAt?: number;
  deletedAt?: number;
};

export type CreateCheckinArgs = {
  userId: string;
  date: string;
  pain?: number;
  mood?: CheckinRow["mood"];
  adherenceTaken?: boolean;
  flare?: CheckinRow["flare"];
  energy?: number;
  declined?: CheckinRow["declined"];
  appendedTo?: string;
  transcript: string;
  stage: CheckinRow["stage"];
  durationMs: number;
  providerUsed: string;
  clientRequestId: string;
};

export type ListCheckinsArgs = {
  userId: string;
  limit?: number;
  cursor?: string;
  fromDate?: string;
  toDate?: string;
};

// Minimal ctx shape the handlers actually use. The real Convex ctx
// satisfies this structurally.
type IndexBuilder = {
  eq: (field: "userId" | "date", value: string) => IndexBuilder;
};

// Minimal medication shape needed for the Memory intake projection — name
// and dose for the row title/meta. The real `medications` table doc has
// more fields; this is the structural subset our handler reads.
export type MedicationRowForMemory = {
  _id: string;
  userId: string;
  name: string;
  dose: string;
};

// Minimal intake-event row shape — mirrors `IntakeEventRow` from the
// memory event-types module + the `userId`/`deletedAt` fields the handler
// filters on.
export type IntakeEventDbRow = IntakeEventRow & {
  userId: string;
  deletedAt?: number;
};

type Queryable<Row> = {
  withIndex: (
    name: "by_user_date" | "by_user",
    cb: (q: IndexBuilder) => IndexBuilder,
  ) => {
    collect: () => Promise<Row[]>;
  };
};

type MutationHandlerCtx = {
  db: {
    // Overloads — each table returns its own row type. Tests pass a mock
    // ctx that branches on the table arg (see tests/memory/list-events-query.test.ts).
    query: {
      (table: "checkIns"): Queryable<CheckinRow>;
      (table: "intakeEvents"): Queryable<IntakeEventDbRow>;
      (table: "medications"): Queryable<MedicationRowForMemory>;
    };
    insert: (
      table: "checkIns",
      doc: Omit<CheckinRow, "_id">,
    ) => Promise<string>;
    get: (id: string) => Promise<CheckinRow | null>;
  };
};

type QueryHandlerCtx = MutationHandlerCtx;

// Extracted handler bodies — plain async functions so they can be called
// from vitest with a mock ctx, and also by the Convex wrappers below.

export async function createCheckinHandler(
  ctx: MutationHandlerCtx,
  args: CreateCheckinArgs,
  now: () => number = Date.now,
): Promise<{ id: string; date: string }> {
  // Range validation runs only when the metric was captured. `undefined`
  // means the metric was either declined (then it's also in `declined[]`)
  // or never captured — both are valid.
  if (args.pain !== undefined) {
    if (!Number.isFinite(args.pain) || args.pain < 1 || args.pain > 10) {
      throw new ConvexError({
        code: "checkin.invalid_range",
        message: "Invalid range for pain/energy",
      });
    }
  }
  if (args.energy !== undefined) {
    if (!Number.isFinite(args.energy) || args.energy < 1 || args.energy > 10) {
      throw new ConvexError({
        code: "checkin.invalid_range",
        message: "Invalid range for pain/energy",
      });
    }
  }

  // We fetch all rows matching (userId, date) via the index and skip
  // soft-deleted rows in code — simpler than composing Convex's
  // `.filter()` predicate and easier to mock in tests.
  //
  // Same-day re-entry (Cycle 2 chunk 2.F): when `args.appendedTo` is set,
  // the row IS an append block referencing the original. Multiple rows
  // for the same (userId, date) are allowed in this case. Idempotency
  // still applies — a retry with the same `clientRequestId` returns the
  // existing row (matched across the whole append chain), not a new one.
  const candidates = await ctx.db
    .query("checkIns")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .collect();
  const live = candidates.filter((r) => r.deletedAt === undefined);

  // Idempotency check spans the whole append chain, not just the original.
  const idempotentMatch = live.find(
    (r) => r.clientRequestId === args.clientRequestId,
  );
  if (idempotentMatch !== undefined) {
    return { id: String(idempotentMatch._id), date: idempotentMatch.date };
  }

  // Without `appendedTo`, a second create for (userId, date) is a duplicate.
  // With `appendedTo`, this is an explicit append block — proceed to insert.
  if (args.appendedTo === undefined && live.length > 0) {
    throw new ConvexError({
      code: "checkin.duplicate",
      message: "A check-in already exists for this user and date.",
    });
  }

  const id = await ctx.db.insert("checkIns", {
    userId: args.userId,
    date: args.date,
    createdAt: now(),
    pain: args.pain,
    mood: args.mood,
    adherenceTaken: args.adherenceTaken,
    flare: args.flare,
    energy: args.energy,
    declined: args.declined,
    appendedTo: args.appendedTo,
    transcript: args.transcript,
    stage: args.stage,
    durationMs: args.durationMs,
    providerUsed: args.providerUsed,
    clientRequestId: args.clientRequestId,
  });

  return { id: String(id), date: args.date };
}

// Pagination approach:
//   Cursor-on-date — the cursor IS the next row's `date` string.
//   Simpler than Convex's paginationOpts for a date-sorted feed and
//   trivial to mock in tests. Results are ordered by `date desc`;
//   `nextCursor` is the `date` of the last returned row when more rows
//   remain, else `null`.
export async function listCheckinsHandler(
  ctx: QueryHandlerCtx,
  args: ListCheckinsArgs,
): Promise<{ items: CheckinRow[]; nextCursor: string | null }> {
  const limit = args.limit ?? 20;

  // Guard: non-positive limit returns empty page immediately.
  // (Review finding R3-1: limit:0 previously crashed on nextCursor = undefined.date.)
  if (limit <= 0) {
    return { items: [], nextCursor: null };
  }

  const all = await ctx.db
    .query("checkIns")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();

  const filtered = all
    .filter((row) => row.deletedAt === undefined)
    .filter((row) =>
      args.fromDate !== undefined ? row.date >= args.fromDate : true,
    )
    .filter((row) =>
      args.toDate !== undefined ? row.date <= args.toDate : true,
    )
    .filter((row) =>
      args.cursor !== undefined ? row.date < args.cursor : true,
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].date : null;

  return { items: page, nextCursor };
}

export async function getCheckinHandler(
  ctx: QueryHandlerCtx,
  args: { id: string },
): Promise<CheckinRow | null> {
  const row = await ctx.db.get(args.id);
  if (row === null) return null;
  if (row.deletedAt !== undefined) return null;
  return row;
}

// ---- Convex wrappers ----
//
// AUTH (Cycle 2, chunk 1.F): these wrappers currently trust the `userId`
// arg from the client. Cycle 2 replaces this with Convex auth —
// `ctx.auth.getUserIdentity()` → tokenIdentifier → app userId, and the
// `userId` arg is dropped. Tracked in docs/post-mvp-backlog.md
// ("Auth enforcement for check-in endpoints").

export const createCheckin = mutation({
  args: {
    userId: v.string(),
    date: v.string(),
    // All five metrics optional — undefined = declined or not captured.
    // Pair with `declined[]` to distinguish "skipped" from "not captured".
    pain: v.optional(v.number()),
    mood: v.optional(moodValidator),
    adherenceTaken: v.optional(v.boolean()),
    flare: v.optional(flareValidator),
    energy: v.optional(v.number()),
    declined: v.optional(v.array(metricLiteralValidator)),
    // Same-day re-entry block reference (Cycle 2 chunk 2.F).
    appendedTo: v.optional(v.id("checkIns")),
    transcript: v.string(),
    stage: stageValidator,
    durationMs: v.number(),
    providerUsed: v.string(),
    clientRequestId: v.string(),
  },
  returns: v.object({ id: v.string(), date: v.string() }),
  handler: async (ctx, args) => {
    // The real Convex ctx satisfies MutationHandlerCtx structurally.
    // Cast narrows the unbounded generic DB reader type to the shape
    // the extracted handler needs. No runtime effect.
    return createCheckinHandler(
      ctx as unknown as MutationHandlerCtx,
      args,
    );
  },
});

export const listCheckins = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return listCheckinsHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});

export const getCheckin = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return getCheckinHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});

// ---- F01 Cycle 2 chunk 2.F: same-day re-entry detection ----
//
// `getTodayCheckin` is the additive Convex query owned by chunk 2.F. The
// page calls it on mount with the device-local YYYY-MM-DD; if it returns
// a row, the page picks the `re-entry-same-day` opener variant and — on
// save — calls `buildAppendPayload(existing, ...)` to insert a new row
// with `appendedTo` pointing at the original. Soft-deleted rows are
// excluded so a discarded morning check-in doesn't trigger re-entry copy.

export type GetTodayCheckinArgs = {
  userId: string;
  date: string;
};

export async function getTodayCheckinHandler(
  ctx: QueryHandlerCtx,
  args: GetTodayCheckinArgs,
): Promise<CheckinRow | null> {
  const candidates = await ctx.db
    .query("checkIns")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .collect();
  // Skip soft-deleted rows (matches createCheckin / listCheckins policy).
  // If multiple rows exist for (userId, date) — i.e. an append chain
  // already started today — return the original (the row without
  // `appendedTo` set). Re-entry past the second block still chains off
  // the first row so the timestamped block list stays in order.
  const live = candidates.filter((r) => r.deletedAt === undefined);
  if (live.length === 0) return null;
  const original = live.find((r) => r.appendedTo === undefined);
  return original ?? live[0];
}

export const getTodayCheckin = query({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return getTodayCheckinHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});

// ---- F02 Memory: listEventsByRange ----
//
// Returns mixed MemoryEvents in [fromDate, toDate] reverse-chronological by
// (date desc, time desc). Reads `checkIns` (F02) + `intakeEvents` (F04 C1).
// F05 (visits + bloodWork) extends the merge later. No tier clamp (no free
// tier per locked decision 2026-04-25). Soft-deleted rows are excluded
// from both tables — same policy as listCheckinsHandler.

export type ListEventsByRangeArgs = {
  userId: string;
  fromDate: string;
  toDate: string;
};

export async function listEventsByRangeHandler(
  ctx: QueryHandlerCtx,
  args: ListEventsByRangeArgs,
): Promise<{ events: MemoryEvent[] }> {
  // 1. Check-in rows → CheckInEvent (and optionally a paired FlareEvent).
  const checkinRows = await ctx.db
    .query("checkIns")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();

  const inRangeCheckins = checkinRows.filter(
    (row) =>
      row.deletedAt === undefined &&
      row.date >= args.fromDate &&
      row.date <= args.toDate,
  );

  const events: MemoryEvent[] = [];
  for (const row of inRangeCheckins) {
    events.push(...eventFromCheckin(row));
  }

  // 2. Intake events → IntakeEvent. We need the medication name + dose to
  //    render the row title/meta, so fetch the regimen once and look up
  //    each intake's medication by id. ALL meds (active + inactive) are
  //    pulled — historical intakes for now-deactivated meds must still
  //    project (the user did take them at the time).
  const intakeRows = await ctx.db
    .query("intakeEvents")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();

  const inRangeIntakes = intakeRows.filter(
    (row) =>
      row.deletedAt === undefined &&
      row.date >= args.fromDate &&
      row.date <= args.toDate,
  );

  if (inRangeIntakes.length > 0) {
    const medRows = await ctx.db
      .query("medications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const medById = new Map<string, IntakeMedication>(
      medRows.map((m) => [m._id, { _id: m._id, name: m.name, dose: m.dose }]),
    );
    for (const row of inRangeIntakes) {
      const med = medById.get(row.medicationId);
      if (med === undefined) continue; // defensive — medication row missing
      const projected = eventFromIntake(row as IntakeEventRow, med);
      if (projected !== null) events.push(projected);
    }
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.time !== b.time) return a.time < b.time ? 1 : -1;
    return 0;
  });

  return { events };
}

export const listEventsByRange = query({
  args: {
    userId: v.string(),
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    return listEventsByRangeHandler(ctx as unknown as QueryHandlerCtx, args);
  },
});
