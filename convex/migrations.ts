/**
 * One-off data migrations. Each migration is an `internalMutation` — not
 * callable from the browser; run by an operator via the CLI:
 *
 *   npx convex run migrations:backfillBloodWorkMarkers        (dev)
 *   npx convex run migrations:backfillBloodWorkMarkers --prod (prod)
 *
 * Migrations here must be IDEMPOTENT (safe to run twice) and batched so a
 * single invocation stays well inside Convex mutation limits.
 *
 * ADR-037 / housekeeping #13 — backfillBloodWorkMarkers:
 * Walks existing `bloodWork` docs and inserts the flattened
 * `bloodWorkMarkers` projection rows for parents created BEFORE the
 * dual-write shipped. Parents that already have any marker rows are
 * skipped (the dual-write or a previous backfill run covered them).
 * Soft-deleted parents get rows with `deletedAt` mirrored, keeping parity
 * with what the dual-write would have produced.
 *
 * Pagination: processes `batchSize` parents per invocation (default 50)
 * and returns `{ isDone, continueCursor }`. If `isDone` is false, re-run
 * with `'{"cursor": "<continueCursor>"}'` until it is true. At current
 * prod scale one invocation finishes the whole table.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { canonicalMarkerName } from "./markerNames";
import type { BloodWorkMarkerRow, BloodWorkRow } from "./bloodWork";

// ---------------------------------------------------------------------------
// Structural ctx — same testability approach as convex/bloodWork.ts:
// plain async handler driven by a mock ctx in tests; the real Convex ctx
// satisfies the shape, the cast in the wrapper has no runtime effect.
// ---------------------------------------------------------------------------

type MigrationCtx = {
  db: {
    query: {
      (table: "bloodWork"): {
        paginate: (opts: {
          cursor: string | null;
          numItems: number;
        }) => Promise<{
          page: BloodWorkRow[];
          isDone: boolean;
          continueCursor: string;
        }>;
      };
      (table: "bloodWorkMarkers"): {
        withIndex: (
          name: string,
          cb: (q: {
            eq: (field: string, value: unknown) => unknown;
          }) => unknown,
        ) => {
          first: () => Promise<BloodWorkMarkerRow | null>;
        };
      };
    };
    insert: (
      table: "bloodWorkMarkers",
      doc: Omit<BloodWorkMarkerRow, "_id">,
    ) => Promise<string>;
  };
};

export type BackfillBloodWorkMarkersArgs = {
  cursor?: string | null;
  batchSize?: number;
};

export type BackfillBloodWorkMarkersResult = {
  scanned: number;
  backfilled: number;
  skipped: number;
  markerRowsInserted: number;
  isDone: boolean;
  continueCursor: string | null;
};

export async function backfillBloodWorkMarkersHandler(
  ctx: MigrationCtx,
  args: BackfillBloodWorkMarkersArgs,
): Promise<BackfillBloodWorkMarkersResult> {
  const batchSize = args.batchSize ?? 50;
  const { page, isDone, continueCursor } = await ctx.db
    .query("bloodWork")
    .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

  let backfilled = 0;
  let skipped = 0;
  let markerRowsInserted = 0;

  for (const parent of page) {
    // Idempotency: any existing projection row for this parent means the
    // dual-write (or an earlier backfill run) already covered it.
    const existing = await ctx.db
      .query("bloodWorkMarkers")
      .withIndex("by_blood_work", (q) =>
        q.eq("bloodWorkId", String(parent._id)),
      )
      .first();
    if (existing !== null) {
      skipped += 1;
      continue;
    }

    for (const m of parent.markers) {
      const doc: Omit<BloodWorkMarkerRow, "_id"> = {
        userId: parent.userId,
        bloodWorkId: String(parent._id),
        date: parent.date,
        name: canonicalMarkerName(m.name),
        value: m.value,
        unit: m.unit,
      };
      if (m.refRangeLow !== undefined) doc.refRangeLow = m.refRangeLow;
      if (m.refRangeHigh !== undefined) doc.refRangeHigh = m.refRangeHigh;
      if (m.abnormal !== undefined) doc.abnormal = m.abnormal;
      // Soft-delete parity: mirror the parent's deletedAt so trend
      // queries never see markers of a deleted entry.
      if (parent.deletedAt !== undefined) doc.deletedAt = parent.deletedAt;
      await ctx.db.insert("bloodWorkMarkers", doc);
      markerRowsInserted += 1;
    }
    backfilled += 1;
  }

  return {
    scanned: page.length,
    backfilled,
    skipped,
    markerRowsInserted,
    isDone,
    continueCursor: isDone ? null : continueCursor,
  };
}

export const backfillBloodWorkMarkers = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    backfilled: v.number(),
    skipped: v.number(),
    markerRowsInserted: v.number(),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    return backfillBloodWorkMarkersHandler(
      ctx as unknown as MigrationCtx,
      args,
    );
  },
});
