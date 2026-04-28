/**
 * ADR-020 cost guard for the LLM metric extraction route.
 *
 * Every call to POST /api/check-in/extract first invokes
 * `incrementAndCheck` here. The mutation increments the per-user-per-day
 * row in `extractAttempts` and returns whether the daily cap (5 attempts)
 * has been reached. The route returns 429 with code
 * `extract.daily_cap_reached` when it has.
 *
 * Mirrors the convex/checkIns.ts pattern: the actual work lives in an
 * extracted plain-async handler (`incrementAndCheckHandler`) that takes
 * a structurally-typed mock ctx, so unit tests can drive it without
 * `convex-test`. The real Convex wrapper underneath casts ctx to satisfy
 * the structural shape — no runtime effect.
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";

/** Locked daily attempt cap per ADR-020. The 6th call returns 429. */
export const DAILY_CAP = 5;

export type ExtractAttemptRow = {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  count: number;
  lastAttemptAt: number;
};

export type IncrementAndCheckArgs = {
  userId: string;
  date: string;
};

export type IncrementAndCheckResult = {
  /** Total attempts for (userId, date) AFTER this increment. */
  count: number;
  /** True iff `count > DAILY_CAP` — caller should refuse to proceed. */
  capReached: boolean;
};

type IndexBuilder = {
  eq: (field: "userId" | "date", value: string) => IndexBuilder;
};

type MutationHandlerCtx = {
  db: {
    query: (table: "extractAttempts") => {
      withIndex: (
        name: "by_user_date",
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        unique: () => Promise<ExtractAttemptRow | null>;
      };
    };
    insert: (
      table: "extractAttempts",
      doc: Omit<ExtractAttemptRow, "_id">,
    ) => Promise<string>;
    patch: (id: string, fields: Partial<ExtractAttemptRow>) => Promise<void>;
  };
};

export async function incrementAndCheckHandler(
  ctx: MutationHandlerCtx,
  args: IncrementAndCheckArgs,
  now: () => number = Date.now,
): Promise<IncrementAndCheckResult> {
  const existing = await ctx.db
    .query("extractAttempts")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", args.userId).eq("date", args.date),
    )
    .unique();

  const ts = now();

  if (existing === null) {
    await ctx.db.insert("extractAttempts", {
      userId: args.userId,
      date: args.date,
      count: 1,
      lastAttemptAt: ts,
    });
    return { count: 1, capReached: 1 > DAILY_CAP };
  }

  const newCount = existing.count + 1;
  await ctx.db.patch(existing._id, {
    count: newCount,
    lastAttemptAt: ts,
  });
  return { count: newCount, capReached: newCount > DAILY_CAP };
}

export const incrementAndCheck = mutation({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  returns: v.object({
    count: v.number(),
    capReached: v.boolean(),
  }),
  handler: async (ctx, args) => {
    return incrementAndCheckHandler(
      ctx as unknown as MutationHandlerCtx,
      args,
    );
  },
});

/**
 * Dev helper: delete the `(userId, date)` row so the cost-guard counter
 * resets to zero before the next call. Used to recover a smoke session
 * after the daily cap has been burned by prior testing without waiting
 * for the device-local-time date boundary. Narrow contract — no bulk
 * delete, no userId-only sweep.
 */
export const resetForUserOnDate = mutation({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  returns: v.object({
    deleted: v.boolean(),
    priorCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("extractAttempts")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .unique();
    if (existing === null) {
      return { deleted: false, priorCount: 0 };
    }
    await ctx.db.delete(existing._id);
    return { deleted: true, priorCount: existing.count };
  },
});
