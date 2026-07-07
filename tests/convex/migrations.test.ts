/**
 * Handler tests for `convex/migrations.ts` — backfillBloodWorkMarkers
 * (ADR-037 / housekeeping #13).
 *
 * Mock ctx mirrors the structural-ctx approach of the other convex handler
 * tests, with a cursor-based `paginate` over an in-memory parent list so
 * the batching contract (isDone / continueCursor) is actually exercised.
 */

import { describe, it, expect } from "vitest";
import {
  backfillBloodWorkMarkersHandler,
  type BackfillBloodWorkMarkersArgs,
} from "@/convex/migrations";
import type { BloodWorkRow, BloodWorkMarkerRow } from "@/convex/bloodWork";

function makeMigrationCtx(parents: BloodWorkRow[]) {
  const markerRows: BloodWorkMarkerRow[] = [];
  let nextId = 1;

  const ctx = {
    db: {
      query: (table: "bloodWork" | "bloodWorkMarkers") => {
        if (table === "bloodWork") {
          return {
            paginate: async ({
              cursor,
              numItems,
            }: {
              cursor: string | null;
              numItems: number;
            }) => {
              const start = cursor === null ? 0 : Number(cursor);
              const page = parents.slice(start, start + numItems);
              const end = start + page.length;
              return {
                page,
                isDone: end >= parents.length,
                continueCursor: String(end),
              };
            },
          };
        }
        return {
          withIndex: (
            _name: string,
            cb: (q: {
              eq: (field: string, value: unknown) => unknown;
            }) => unknown,
          ) => {
            const preds: Array<(row: Record<string, unknown>) => boolean> =
              [];
            const builder = {
              eq(field: string, value: unknown) {
                preds.push((row) => row[field] === value);
                return builder;
              },
            };
            cb(builder);
            return {
              first: async () =>
                markerRows.find((r) =>
                  preds.every((p) =>
                    p(r as unknown as Record<string, unknown>),
                  ),
                ) ?? null,
            };
          },
        };
      },
      insert: async (
        _table: "bloodWorkMarkers",
        doc: Omit<BloodWorkMarkerRow, "_id">,
      ): Promise<string> => {
        const id = `bwm_${nextId++}`;
        markerRows.push({ ...doc, _id: id });
        return id;
      },
    },
  };
  return { ctx, markerRows };
}

type Ctx = Parameters<typeof backfillBloodWorkMarkersHandler>[0];

function parent(overrides: Partial<BloodWorkRow> = {}): BloodWorkRow {
  return {
    _id: `bw_${Math.random().toString(36).slice(2, 8)}`,
    userId: "user_A",
    date: "2026-04-30",
    markers: [{ name: "CRP", value: 5.2, unit: "mg/L" }],
    source: "module",
    clientRequestId: "req_1",
    createdAt: 1_745_000_000_000,
    ...overrides,
  };
}

async function run(
  ctx: unknown,
  args: BackfillBloodWorkMarkersArgs = {},
) {
  return backfillBloodWorkMarkersHandler(ctx as Ctx, args);
}

describe("backfillBloodWorkMarkersHandler", () => {
  it("flattens un-migrated parents and reports counts", async () => {
    const parents = [
      parent({
        _id: "bw_1",
        markers: [
          { name: "crp", value: 5, unit: "mg/L" },
          {
            name: "ESR",
            value: 25,
            unit: "mm/hr",
            refRangeLow: 0,
            refRangeHigh: 20,
            abnormal: true,
          },
        ],
      }),
      parent({ _id: "bw_2", date: "2026-05-01", clientRequestId: "req_2" }),
    ];
    const { ctx, markerRows } = makeMigrationCtx(parents);

    const result = await run(ctx);
    expect(result).toEqual({
      scanned: 2,
      backfilled: 2,
      skipped: 0,
      markerRowsInserted: 3,
      isDone: true,
      continueCursor: null,
    });

    expect(markerRows).toHaveLength(3);
    // Canonicalization applied — "crp" lands on "CRP".
    expect(markerRows[0].name).toBe("CRP");
    expect(markerRows[0].bloodWorkId).toBe("bw_1");
    expect(markerRows[0].date).toBe("2026-04-30");
    // Ref ranges + abnormal carried through.
    expect(markerRows[1]).toMatchObject({
      name: "ESR",
      refRangeLow: 0,
      refRangeHigh: 20,
      abnormal: true,
    });
    // Second parent's denormalized date.
    expect(markerRows[2].date).toBe("2026-05-01");
  });

  it("is idempotent — second run skips already-flattened parents", async () => {
    const parents = [parent({ _id: "bw_1" }), parent({ _id: "bw_2" })];
    const { ctx, markerRows } = makeMigrationCtx(parents);

    await run(ctx);
    expect(markerRows).toHaveLength(2);

    const second = await run(ctx);
    expect(second).toMatchObject({
      scanned: 2,
      backfilled: 0,
      skipped: 2,
      markerRowsInserted: 0,
      isDone: true,
    });
    expect(markerRows).toHaveLength(2);
  });

  it("skips parents already covered by the dual-write", async () => {
    const parents = [parent({ _id: "bw_1" }), parent({ _id: "bw_2" })];
    const { ctx, markerRows } = makeMigrationCtx(parents);
    // Simulate the dual-write having already flattened bw_1.
    markerRows.push({
      _id: "bwm_pre",
      userId: "user_A",
      bloodWorkId: "bw_1",
      date: "2026-04-30",
      name: "CRP",
      value: 5.2,
      unit: "mg/L",
    });

    const result = await run(ctx);
    expect(result).toMatchObject({
      backfilled: 1,
      skipped: 1,
      markerRowsInserted: 1,
    });
    expect(
      markerRows.filter((r) => r.bloodWorkId === "bw_1"),
    ).toHaveLength(1);
  });

  it("mirrors the parent's deletedAt onto backfilled rows", async () => {
    const deletedAt = 1_746_000_000_000;
    const parents = [parent({ _id: "bw_1", deletedAt })];
    const { ctx, markerRows } = makeMigrationCtx(parents);

    await run(ctx);
    expect(markerRows[0].deletedAt).toBe(deletedAt);
  });

  it("paginates — resumes from continueCursor until isDone", async () => {
    const parents = [
      parent({ _id: "bw_1" }),
      parent({ _id: "bw_2" }),
      parent({ _id: "bw_3" }),
    ];
    const { ctx, markerRows } = makeMigrationCtx(parents);

    const first = await run(ctx, { batchSize: 2 });
    expect(first.isDone).toBe(false);
    expect(first.scanned).toBe(2);
    expect(first.continueCursor).not.toBeNull();

    const second = await run(ctx, {
      batchSize: 2,
      cursor: first.continueCursor,
    });
    expect(second).toMatchObject({
      scanned: 1,
      backfilled: 1,
      isDone: true,
      continueCursor: null,
    });
    expect(markerRows).toHaveLength(3);
  });
});
