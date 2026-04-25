/**
 * Convex query `getContinuityState` — feeds the opener/closer rules engine.
 *
 * Computes a `ContinuityState` snapshot from the last 30 days of `checkIns`
 * for `userId`. The snapshot is a small denormalised view: yesterday's
 * read, the running streak, days since the last check-in, the rolling
 * `ongoing` flare count, and a `isFirstEverCheckin` flag.
 *
 * Pure-function handler (`getContinuityStateHandler`) is exported so the
 * test suite can drive it with a mock ctx (no Convex runtime).
 *
 * `upcomingEvent` is always `null` in Cycle 2 — F08 (Journey) hasn't shipped
 * an events store yet. The opener/closer engines treat `null` as "no event".
 *
 * Date math: dates are YYYY-MM-DD strings stored in the user's local
 * timezone (per pre-flight schema note). Day arithmetic uses
 * `Date.UTC(...)` parsing to avoid local-zone DST surprises in the
 * computation, since the strings are already day-bucketed.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import type {
  ContinuityState,
  Mood,
  FlareState,
} from "../lib/checkin/types";

// Structural row type the handler reads. Mirrors the slice of
// `CheckinRow` we actually need so tests can supply lightweight fixtures.
export type ContinuityRow = {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  pain?: number;
  mood?: Mood;
  flare?: FlareState;
  deletedAt?: number;
};

type IndexBuilder = {
  eq: (field: "userId" | "date", value: string) => IndexBuilder;
};

type ContinuityCtx = {
  db: {
    query: (table: "checkIns") => {
      withIndex: (
        name: "by_user_date",
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        collect: () => Promise<ContinuityRow[]>;
      };
    };
  };
};

/** Return a YYYY-MM-DD string offset by `daysBack` days from `todayIso`. */
function addDays(todayIso: string, daysBack: number): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  // Use UTC so the day arithmetic is timezone-agnostic — the strings
  // are already canonical day buckets.
  const t = Date.UTC(y, m - 1, d);
  const out = new Date(t - daysBack * 24 * 60 * 60 * 1000);
  const yy = out.getUTCFullYear();
  const mm = String(out.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(out.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Days between two YYYY-MM-DD strings (b - a, treating both as UTC days). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / (24 * 60 * 60 * 1000));
}

export async function getContinuityStateHandler(
  ctx: ContinuityCtx,
  args: { userId: string; todayIso: string },
): Promise<ContinuityState> {
  // Read the last 30 days for this user. The Convex index is
  // `by_user_date`; we filter on userId via the eq() builder and
  // post-filter by date range + soft-delete in code (consistent with
  // existing `listCheckinsHandler` style).
  const all = await ctx.db
    .query("checkIns")
    .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
    .collect();

  const fromDate = addDays(args.todayIso, 30);
  const rows = all
    .filter((r) => r.deletedAt === undefined)
    .filter((r) => r.date >= fromDate && r.date <= args.todayIso)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // desc

  if (rows.length === 0) {
    return {
      yesterday: null,
      streakDays: 0,
      lastCheckinDaysAgo: Number.POSITIVE_INFINITY,
      upcomingEvent: null,
      flareOngoingDays: 0,
      isFirstEverCheckin: true,
    };
  }

  // Most recent row.
  const newest = rows[0];
  const lastCheckinDaysAgo = daysBetween(newest.date, args.todayIso);

  // Yesterday block — only populated if there's a row exactly 1 day
  // before todayIso. (A row for today doesn't shift "yesterday" — we
  // still want to surface the prior day's state when the user is
  // re-entering on the same day.)
  const yesterdayDate = addDays(args.todayIso, 1);
  const yesterdayRow = rows.find((r) => r.date === yesterdayDate) ?? null;

  const yesterday: ContinuityState["yesterday"] = yesterdayRow
    ? {
        date: yesterdayRow.date,
        pain: yesterdayRow.pain ?? null,
        mood: yesterdayRow.mood ?? null,
        flare: yesterdayRow.flare ?? null,
        isRoughDay:
          (yesterdayRow.pain !== undefined && yesterdayRow.pain >= 8) ||
          yesterdayRow.flare === "yes",
      }
    : null;

  // Streak: consecutive days ending at the most recent row, walking
  // backwards. A gap of >1 day breaks the streak.
  let streakDays = 1;
  for (let i = 1; i < rows.length; i++) {
    const expected = addDays(rows[i - 1].date, 1);
    if (rows[i].date === expected) {
      streakDays += 1;
    } else {
      break;
    }
  }

  // Flare-ongoing run: count consecutive `flare === 'ongoing'` rows
  // walking back from yesterday. A `'no'`/`'yes'` row breaks it.
  // Matches the engine's use: `flareOngoingDays` is the count Saumya
  // would gently stop referencing once it hits 5 (per scoping § Safety
  // rails).
  let flareOngoingDays = 0;
  if (yesterdayRow !== null && yesterdayRow.flare === "ongoing") {
    flareOngoingDays = 1;
    let cursor = yesterdayRow.date;
    for (const r of rows) {
      if (r.date >= yesterdayRow.date) continue; // skip yesterday + today
      const expected = addDays(cursor, 1);
      if (r.date === expected && r.flare === "ongoing") {
        flareOngoingDays += 1;
        cursor = r.date;
      } else {
        break;
      }
    }
  }

  return {
    yesterday,
    streakDays,
    lastCheckinDaysAgo,
    upcomingEvent: null, // F08 stub — wired in a later cycle.
    flareOngoingDays,
    isFirstEverCheckin: false,
  };
}

export const getContinuityState = query({
  args: {
    userId: v.string(),
    todayIso: v.string(),
  },
  handler: async (ctx, args) => {
    return getContinuityStateHandler(
      ctx as unknown as ContinuityCtx,
      args,
    );
  },
});
