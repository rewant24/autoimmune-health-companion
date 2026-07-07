/**
 * Feature 05 Cycle 1 — Blood work results (structured markers).
 *
 * Owned by chunk 5.A. Pattern mirrors `convex/doctorVisits.ts` and
 * `convex/medications.ts`:
 *   - Plain async `*Handler` functions driven by structurally-typed mock
 *     ctx in tests. The real Convex ctx satisfies the shape; the cast in
 *     the wrappers has no runtime effect.
 *   - Soft-delete via `deletedAt`. Hard delete is post-MVP.
 *   - `clientRequestId` collapses retries on create.
 *
 * Marker validation: each marker has name + finite value + unit. When
 * both refRangeLow + refRangeHigh are present, `abnormal` is derived at
 * write time (`value < low || value > high`). On update, if new bounds
 * are provided, `abnormal` is recomputed. If the caller provides an
 * explicit `abnormal`, it's trusted (manual override).
 *
 * PDF/image attachment + OCR are post-MVP backlog item 3.
 *
 * Stories owned: US-5.A.2 blood-work CRUD, US-5.A.3 soft-delete idempotency.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canonicalMarkerName } from "./markerNames";

// ---------------------------------------------------------------------------
// Validators / types
// ---------------------------------------------------------------------------

const sourceValidator = v.union(
  v.literal("module"),
  v.literal("check-in"),
);

const markerValidator = v.object({
  name: v.string(),
  value: v.number(),
  unit: v.string(),
  refRangeLow: v.optional(v.number()),
  refRangeHigh: v.optional(v.number()),
  abnormal: v.optional(v.boolean()),
});

export type BloodWorkSource = "module" | "check-in";

export type BloodWorkMarkerInput = {
  name: string;
  value: number;
  unit: string;
  refRangeLow?: number;
  refRangeHigh?: number;
  abnormal?: boolean;
};

export type BloodWorkMarker = {
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
  date: string;
  markers: BloodWorkMarker[];
  notes?: string;
  source: BloodWorkSource;
  checkInId?: string;
  clientRequestId: string;
  createdAt: number;
  deletedAt?: number;
};

/**
 * ADR-037 — flattened marker row (`bloodWorkMarkers` table). A relational
 * projection of the parent's embedded `markers[]`: `name` is canonical
 * (convex/markerNames.ts), `date` is denormalized from the parent, and
 * `deletedAt` mirrors the parent's soft-delete. F05 read surfaces never
 * touch this table — it exists for F08 per-marker trend queries.
 */
export type BloodWorkMarkerRow = {
  _id: string;
  userId: string;
  bloodWorkId: string;
  date: string;
  name: string;
  value: number;
  unit: string;
  refRangeLow?: number;
  refRangeHigh?: number;
  abnormal?: boolean;
  deletedAt?: number;
};

export type CreateBloodWorkArgs = {
  userId: string;
  date: string;
  markers: BloodWorkMarkerInput[];
  notes?: string;
  source: BloodWorkSource;
  checkInId?: string;
  clientRequestId: string;
};

export type UpdateBloodWorkArgs = {
  bloodWorkId: string;
  userId: string;
  date?: string;
  markers?: BloodWorkMarkerInput[];
  notes?: string;
};

export type SoftDeleteBloodWorkArgs = {
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Structural ctx — same approach as convex/doctorVisits.ts.
type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
  // W2-2: range bounds ride the index (feedback_memory_aggregation_index_bounds).
  gte: (field: string, value: unknown) => IndexBuilder;
  lte: (field: string, value: unknown) => IndexBuilder;
};

// ADR-037: handlers now touch two tables — the parent `bloodWork` docs and
// the flattened `bloodWorkMarkers` projection rows.
type BloodWorkTables = {
  bloodWork: BloodWorkRow;
  bloodWorkMarkers: BloodWorkMarkerRow;
};

type BloodWorkCtx = {
  db: {
    query: <T extends keyof BloodWorkTables>(table: T) => {
      withIndex: (
        name: string,
        cb: (q: IndexBuilder) => IndexBuilder,
      ) => {
        collect: () => Promise<Array<BloodWorkTables[T]>>;
      };
    };
    insert: <T extends keyof BloodWorkTables>(
      table: T,
      doc: Omit<BloodWorkTables[T], "_id">,
    ) => Promise<string>;
    get: (id: string) => Promise<BloodWorkRow | null>;
    patch: (
      id: string,
      fields: Partial<BloodWorkRow> | Partial<BloodWorkMarkerRow>,
    ) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Compute today's YYYY-MM-DD in IST from a UTC ms timestamp. Test-injectable
 * so future-date assertions stay deterministic. Mirrors the same formatter
 * used in `convex/checkIns.ts` and `BloodWorkForm`.
 */
function todayIstFromMs(nowMs: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
}

function assertBloodWorkDate(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new ConvexError({
      code: "bloodWork.bad_date_format",
      message: "Blood-work date must be YYYY-MM-DD.",
    });
  }
}

/**
 * Defense-in-depth on the form-level future-date guard. Blood work is by
 * definition a record of a test that already happened, so future dates are
 * nonsensical and would produce confusing taskState/Memory ordering. Called
 * only from write paths (create + update); the read paths (`get*`) intentionally
 * accept any well-formed date so they can answer "what's there" honestly.
 */
function assertBloodWorkDateNotFuture(date: string, nowMs: number): void {
  const today = todayIstFromMs(nowMs);
  if (date > today) {
    throw new ConvexError({
      code: "bloodWork.future_date",
      message: "Blood-work date cannot be in the future.",
    });
  }
}

function assertSourceCheckInInvariant(
  source: BloodWorkSource,
  checkInId: string | undefined,
): void {
  // checkInId is best-effort when source='check-in'. The check-in row may
  // not yet be persisted at the moment a confirm-card fires (cards are
  // non-blocking), so we accept the omission. We still reject empty-string
  // checkInId as a likely bug, and reject checkInId on source='module'
  // since the module path has no associated check-in.
  if (source === "check-in" && checkInId === "") {
    throw new ConvexError({
      code: "bloodWork.empty_check_in_id",
      message: "checkInId, when provided, must be non-empty.",
    });
  }
  if (source === "module" && checkInId !== undefined) {
    throw new ConvexError({
      code: "bloodWork.unexpected_check_in_id",
      message: "checkInId must be absent when source is 'module'.",
    });
  }
}

function normalizeMarkers(
  raw: BloodWorkMarkerInput[],
): BloodWorkMarker[] {
  if (raw.length === 0) {
    throw new ConvexError({
      code: "bloodWork.no_markers",
      message: "At least one marker is required.",
    });
  }
  return raw.map((m) => {
    const name = m.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "bloodWork.bad_marker_name",
        message: "Marker name is required.",
      });
    }
    if (!Number.isFinite(m.value)) {
      throw new ConvexError({
        code: "bloodWork.bad_marker_value",
        message: `Marker '${name}' has a non-finite value.`,
      });
    }
    const unit = m.unit.trim();
    if (unit.length === 0) {
      throw new ConvexError({
        code: "bloodWork.bad_marker_unit",
        message: `Marker '${name}' is missing a unit.`,
      });
    }
    if (
      m.refRangeLow !== undefined &&
      m.refRangeHigh !== undefined &&
      m.refRangeLow > m.refRangeHigh
    ) {
      throw new ConvexError({
        code: "bloodWork.bad_ref_range",
        message: `Marker '${name}' has refRangeLow > refRangeHigh.`,
      });
    }
    const out: BloodWorkMarker = {
      name,
      value: m.value,
      unit,
    };
    if (m.refRangeLow !== undefined) out.refRangeLow = m.refRangeLow;
    if (m.refRangeHigh !== undefined) out.refRangeHigh = m.refRangeHigh;

    // Trust caller-provided `abnormal` if explicit; otherwise derive when
    // both bounds are present.
    if (m.abnormal !== undefined) {
      out.abnormal = m.abnormal;
    } else if (
      m.refRangeLow !== undefined &&
      m.refRangeHigh !== undefined
    ) {
      out.abnormal = m.value < m.refRangeLow || m.value > m.refRangeHigh;
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Flattened marker-row helpers (ADR-037 dual-write)
// ---------------------------------------------------------------------------

async function loadMarkerRows(
  ctx: BloodWorkCtx,
  bloodWorkId: string,
): Promise<BloodWorkMarkerRow[]> {
  return ctx.db
    .query("bloodWorkMarkers")
    .withIndex("by_blood_work", (q) => q.eq("bloodWorkId", bloodWorkId))
    .collect();
}

/**
 * Insert one `bloodWorkMarkers` row per (already-normalized) marker.
 * `name` goes through `canonicalMarkerName` so trend queries don't
 * fragment on spelling ("crp" vs "CRP" vs "C-reactive protein").
 */
async function insertMarkerRows(
  ctx: BloodWorkCtx,
  parent: { bloodWorkId: string; userId: string; date: string },
  markers: BloodWorkMarker[],
): Promise<void> {
  for (const m of markers) {
    const doc: Omit<BloodWorkMarkerRow, "_id"> = {
      userId: parent.userId,
      bloodWorkId: parent.bloodWorkId,
      date: parent.date,
      name: canonicalMarkerName(m.name),
      value: m.value,
      unit: m.unit,
    };
    if (m.refRangeLow !== undefined) doc.refRangeLow = m.refRangeLow;
    if (m.refRangeHigh !== undefined) doc.refRangeHigh = m.refRangeHigh;
    if (m.abnormal !== undefined) doc.abnormal = m.abnormal;
    await ctx.db.insert("bloodWorkMarkers", doc);
  }
}

/**
 * Replace the flattened projection rows for a parent after its embedded
 * `markers[]` changed. Stale projection rows are HARD-deleted (they have
 * no independent lifecycle — the embedded array is the source of truth;
 * see ADR-037), then re-inserted from the new array.
 */
async function replaceMarkerRows(
  ctx: BloodWorkCtx,
  parent: { bloodWorkId: string; userId: string; date: string },
  markers: BloodWorkMarker[],
): Promise<void> {
  const stale = await loadMarkerRows(ctx, parent.bloodWorkId);
  for (const row of stale) {
    await ctx.db.delete(row._id);
  }
  await insertMarkerRows(ctx, parent, markers);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function createBloodWorkHandler(
  ctx: BloodWorkCtx,
  args: CreateBloodWorkArgs,
  now: () => number = Date.now,
): Promise<{ bloodWorkId: string; deduped: boolean }> {
  assertBloodWorkDate(args.date);
  assertBloodWorkDateNotFuture(args.date, now());
  assertSourceCheckInInvariant(args.source, args.checkInId);
  const markers = normalizeMarkers(args.markers);

  // Idempotency on clientRequestId — scoped to userId. Skip soft-deleted.
  // W2-2: point lookup on the new by_user_client_request index instead of
  // scanning the user's whole blood-work history.
  const existing = await ctx.db
    .query("bloodWork")
    .withIndex("by_user_client_request", (q) =>
      q.eq("userId", args.userId).eq("clientRequestId", args.clientRequestId),
    )
    .collect();
  const idem = existing.find(
    (r) =>
      r.deletedAt === undefined &&
      r.clientRequestId === args.clientRequestId,
  );
  if (idem !== undefined) {
    return { bloodWorkId: String(idem._id), deduped: true };
  }

  const notes = args.notes !== undefined ? args.notes.trim() : undefined;

  const doc: Omit<BloodWorkRow, "_id"> = {
    userId: args.userId,
    date: args.date,
    markers,
    source: args.source,
    clientRequestId: args.clientRequestId,
    createdAt: now(),
  };
  if (notes !== undefined && notes.length > 0) {
    doc.notes = notes;
  }
  if (args.checkInId !== undefined) {
    doc.checkInId = args.checkInId;
  }

  const id = await ctx.db.insert("bloodWork", doc);

  // ADR-037 dual-write: flattened projection rows for F08 trend queries.
  // Sits AFTER the idempotency early-return above, so a retried
  // clientRequestId never double-inserts marker rows.
  await insertMarkerRows(
    ctx,
    { bloodWorkId: String(id), userId: args.userId, date: args.date },
    markers,
  );

  return { bloodWorkId: String(id), deduped: false };
}

export async function updateBloodWorkHandler(
  ctx: BloodWorkCtx,
  args: UpdateBloodWorkArgs,
  now: () => number = Date.now,
): Promise<{ bloodWorkId: string }> {
  const row = await ctx.db.get(args.bloodWorkId);
  if (row === null) {
    throw new ConvexError({
      code: "bloodWork.not_found",
      message: "Blood-work entry not found.",
    });
  }
  if (row.userId !== args.userId) {
    throw new ConvexError({
      code: "bloodWork.forbidden",
      message: "Blood-work entry does not belong to this user.",
    });
  }
  if (row.deletedAt !== undefined) {
    throw new ConvexError({
      code: "bloodWork.deleted",
      message: "Cannot update a soft-deleted blood-work entry.",
    });
  }

  const patch: Partial<BloodWorkRow> = {};

  if (args.date !== undefined) {
    assertBloodWorkDate(args.date);
    assertBloodWorkDateNotFuture(args.date, now());
    patch.date = args.date;
  }
  if (args.markers !== undefined) {
    patch.markers = normalizeMarkers(args.markers);
  }
  if (args.notes !== undefined) {
    const notes = args.notes.trim();
    patch.notes = notes.length === 0 ? undefined : notes;
  }

  // Capture before patching — `row` may alias the stored doc.
  const previousDate = row.date;

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(args.bloodWorkId, patch);
  }

  // ADR-037 dual-write: keep the flattened projection in lockstep.
  const effectiveDate = patch.date ?? previousDate;
  if (patch.markers !== undefined) {
    // Embedded array changed → rebuild the projection rows.
    await replaceMarkerRows(
      ctx,
      {
        bloodWorkId: String(args.bloodWorkId),
        userId: row.userId,
        date: effectiveDate,
      },
      patch.markers,
    );
  } else if (patch.date !== undefined && patch.date !== previousDate) {
    // Date-only change → sync the denormalized date on existing rows.
    const markerRows = await loadMarkerRows(ctx, String(args.bloodWorkId));
    for (const markerRow of markerRows) {
      await ctx.db.patch(markerRow._id, { date: patch.date });
    }
  }

  return { bloodWorkId: String(args.bloodWorkId) };
}

export async function softDeleteBloodWorkHandler(
  ctx: BloodWorkCtx,
  args: SoftDeleteBloodWorkArgs,
  now: () => number = Date.now,
): Promise<{ bloodWorkId: string; alreadyDeleted: boolean }> {
  const row = await ctx.db.get(args.bloodWorkId);
  if (row === null) {
    throw new ConvexError({
      code: "bloodWork.not_found",
      message: "Blood-work entry not found.",
    });
  }
  if (row.userId !== args.userId) {
    throw new ConvexError({
      code: "bloodWork.forbidden",
      message: "Blood-work entry does not belong to this user.",
    });
  }
  if (row.deletedAt !== undefined) {
    return { bloodWorkId: String(args.bloodWorkId), alreadyDeleted: true };
  }
  const deletedAt = now();
  await ctx.db.patch(args.bloodWorkId, { deletedAt });

  // ADR-037 soft-delete parity: mirror the same timestamp onto the
  // flattened rows so future trend queries (which filter deletedAt) never
  // see markers whose parent entry was deleted.
  const markerRows = await loadMarkerRows(ctx, String(args.bloodWorkId));
  for (const markerRow of markerRows) {
    if (markerRow.deletedAt === undefined) {
      await ctx.db.patch(markerRow._id, { deletedAt });
    }
  }

  return { bloodWorkId: String(args.bloodWorkId), alreadyDeleted: false };
}

export async function listBloodWorkHandler(
  ctx: BloodWorkCtx,
  args: ListBloodWorkArgs,
): Promise<BloodWorkRow[]> {
  // W2-2: optional bounds ride the index; JS filters stay as defense.
  const rows = await ctx.db
    .query("bloodWork")
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

export async function getBloodWorkByDateHandler(
  ctx: BloodWorkCtx,
  args: GetBloodWorkByDateArgs,
): Promise<BloodWorkRow[]> {
  assertBloodWorkDate(args.date);
  const rows = await ctx.db
    .query("bloodWork")
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
  returns: v.object({ bloodWorkId: v.string(), deduped: v.boolean() }),
  handler: async (ctx, args) => {
    return createBloodWorkHandler(ctx as unknown as BloodWorkCtx, {
      ...args,
      checkInId:
        args.checkInId === undefined ? undefined : String(args.checkInId),
    });
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
  returns: v.object({ bloodWorkId: v.string() }),
  handler: async (ctx, args) => {
    return updateBloodWorkHandler(ctx as unknown as BloodWorkCtx, {
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
  returns: v.object({ bloodWorkId: v.string(), alreadyDeleted: v.boolean() }),
  handler: async (ctx, args) => {
    return softDeleteBloodWorkHandler(ctx as unknown as BloodWorkCtx, {
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
    return listBloodWorkHandler(ctx as unknown as BloodWorkCtx, args);
  },
});

export const getBloodWorkByDate = query({
  args: {
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return getBloodWorkByDateHandler(ctx as unknown as BloodWorkCtx, args);
  },
});
