import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  eventFromCheckin,
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

// Structural row type used by the extracted handlers so they can be
// exercised with a mock ctx in tests without depending on `Doc<"checkIns">`
// from the Convex generated types.
export type CheckinRow = {
  _id: string;
  userId: string;
  date: string;
  createdAt: number;
  pain: number;
  mood: "heavy" | "flat" | "okay" | "bright" | "great";
  adherenceTaken: boolean;
  flare: boolean;
  energy: number;
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
  pain: number;
  mood: CheckinRow["mood"];
  adherenceTaken: boolean;
  flare: boolean;
  energy: number;
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

type MutationHandlerCtx = {
  db: {
    query: (table: "checkIns") => {
      withIndex: (
        name: "by_user_date",
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        collect: () => Promise<CheckinRow[]>;
      };
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
  if (!Number.isFinite(args.pain) || args.pain < 1 || args.pain > 10) {
    throw new ConvexError({
      code: "checkin.invalid_range",
      message: "Invalid range for pain/energy",
    });
  }
  if (!Number.isFinite(args.energy) || args.energy < 1 || args.energy > 10) {
    throw new ConvexError({
      code: "checkin.invalid_range",
      message: "Invalid range for pain/energy",
    });
  }

  // We fetch the first row matching (userId, date) via the index and
  // skip soft-deleted rows in code — simpler than composing Convex's
  // `.filter()` predicate and easier to mock in tests.
  const candidates = await ctx.db
    .query("checkIns")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .collect();
  const existing = candidates.find((r) => r.deletedAt === undefined) ?? null;

  if (existing !== null) {
    if (existing.clientRequestId === args.clientRequestId) {
      return { id: String(existing._id), date: existing.date };
    }
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
    pain: v.number(),
    mood: moodValidator,
    adherenceTaken: v.boolean(),
    flare: v.boolean(),
    energy: v.number(),
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

// ---- F02 Memory: listEventsByRange ----
//
// Returns mixed MemoryEvents in [fromDate, toDate] reverse-chronological by
// (date desc, time desc). F02 C1 reads only `checkIns`; F04 (intake) and
// F05 (visits) will extend the merge. No tier clamp (no free tier per
// locked decision 2026-04-25). Soft-deleted rows are excluded — same
// policy as listCheckinsHandler — so behaviour is consistent if/when
// soft-delete is reintroduced (current ADR is hard-delete).

export type ListEventsByRangeArgs = {
  userId: string;
  fromDate: string;
  toDate: string;
};

export async function listEventsByRangeHandler(
  ctx: QueryHandlerCtx,
  args: ListEventsByRangeArgs,
): Promise<{ events: MemoryEvent[] }> {
  const rows = await ctx.db
    .query("checkIns")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();

  const inRange = rows.filter(
    (row) =>
      row.deletedAt === undefined &&
      row.date >= args.fromDate &&
      row.date <= args.toDate,
  );

  const events: MemoryEvent[] = [];
  for (const row of inRange) {
    events.push(...eventFromCheckin(row));
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
