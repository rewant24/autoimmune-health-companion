/**
 * Handler tests for `listEventsByRangeHandler` in `convex/checkIns.ts`.
 * Mirrors the mock-ctx pattern from tests/check-in/convex-checkins.test.ts.
 */
import { describe, it, expect } from "vitest";
import {
  listEventsByRangeHandler,
  type BloodWorkDbRow,
  type CheckinRow,
  type DoctorVisitDbRow,
  type IntakeEventDbRow,
  type MedicationRowForMemory,
} from "@/convex/checkIns";

type AnyRow =
  | CheckinRow
  | IntakeEventDbRow
  | MedicationRowForMemory
  | DoctorVisitDbRow
  | BloodWorkDbRow;

function makeCtx() {
  const rows: CheckinRow[] = [];
  const intakeRows: IntakeEventDbRow[] = [];
  const medicationRows: MedicationRowForMemory[] = [];
  const visitRows: DoctorVisitDbRow[] = [];
  const bloodWorkRows: BloodWorkDbRow[] = [];

  function buildQueryable<Row extends AnyRow>(source: Row[]) {
    return {
      withIndex: (
        _name: "by_user_date" | "by_user",
        cb: (q: {
          eq: (field: "userId" | "date", value: string) => unknown;
        }) => unknown,
      ) => {
        // W2-2: mock applies eq AND the range bounds (gte/lte/lt) so the
        // index-predicate narrowing is actually exercised in tests.
        const preds: Array<(row: Record<string, string>) => boolean> = [];
        type Builder = {
          eq: (f: "userId" | "date", v: string) => Builder;
          gte: (f: "date", v: string) => Builder;
          lte: (f: "date", v: string) => Builder;
          lt: (f: "date", v: string) => Builder;
        };
        const builder: Builder = {
          eq(field, value) {
            preds.push((row) => row[field] === value);
            return builder;
          },
          gte(field, value) {
            preds.push((row) => row[field] >= value);
            return builder;
          },
          lte(field, value) {
            preds.push((row) => row[field] <= value);
            return builder;
          },
          lt(field, value) {
            preds.push((row) => row[field] < value);
            return builder;
          },
        };
        cb(builder);
        return {
          collect: async () =>
            source.filter((row) =>
              preds.every((p) =>
                p(row as unknown as Record<string, string>),
              ),
            ),
        };
      },
    };
  }

  const ctx = {
    db: {
      query: (
        table:
          | "checkIns"
          | "intakeEvents"
          | "medications"
          | "doctorVisits"
          | "bloodWork",
      ) => {
        if (table === "checkIns") return buildQueryable<CheckinRow>(rows);
        if (table === "intakeEvents")
          return buildQueryable<IntakeEventDbRow>(intakeRows);
        if (table === "medications")
          return buildQueryable<MedicationRowForMemory>(medicationRows);
        if (table === "doctorVisits")
          return buildQueryable<DoctorVisitDbRow>(visitRows);
        if (table === "bloodWork")
          return buildQueryable<BloodWorkDbRow>(bloodWorkRows);
        throw new Error(`unmocked table: ${table as string}`);
      },
      // unused by listEventsByRangeHandler but required by the ctx shape:
      insert: async () => {
        throw new Error("not used");
      },
      get: async () => null,
    },
  };

  return { ctx, rows, intakeRows, medicationRows, visitRows, bloodWorkRows };
}

const seed = (overrides: Partial<CheckinRow> = {}): CheckinRow => ({
  _id: `id_${Math.random().toString(36).slice(2, 8)}`,
  userId: "user_A",
  date: "2026-04-25",
  // 09:00 UTC == 14:30 IST
  createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
  pain: 5,
  mood: "okay",
  adherenceTaken: true,
  flare: "no",
  energy: 6,
  transcript: "alright",
  stage: "open",
  durationMs: 42000,
  providerUsed: "web-speech",
  clientRequestId: "req_x",
  ...overrides,
});

type Ctx = Parameters<typeof listEventsByRangeHandler>[0];

describe("listEventsByRangeHandler", () => {
  it("empty store returns { events: [] }", async () => {
    const { ctx } = makeCtx();
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    });
    expect(result.events).toEqual([]);
  });

  it("excludes rows outside [fromDate, toDate]", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "a", date: "2026-04-20" }),
      seed({ _id: "b", date: "2026-04-22" }),
      seed({ _id: "c", date: "2026-04-24" }),
      seed({ _id: "d", date: "2026-04-26" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-22",
      toDate: "2026-04-24",
    });
    const dates = result.events.map((e) => e.date);
    expect(dates).toEqual(["2026-04-24", "2026-04-22"]);
  });

  it("sorts reverse-chronologically by (date desc, time desc)", async () => {
    const { ctx, rows } = makeCtx();
    // Same-day rows at different times — later time should come first.
    rows.push(
      seed({
        _id: "morning",
        date: "2026-04-25",
        createdAt: Date.UTC(2026, 3, 25, 3, 30, 0, 0), // 09:00 IST
      }),
      seed({
        _id: "evening",
        date: "2026-04-25",
        createdAt: Date.UTC(2026, 3, 25, 14, 30, 0, 0), // 20:00 IST
      }),
      seed({
        _id: "yesterday",
        date: "2026-04-24",
        createdAt: Date.UTC(2026, 3, 24, 12, 0, 0, 0), // 17:30 IST
      }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    });
    expect(result.events.map((e) => e.eventId)).toEqual([
      "checkin:evening",
      "checkin:morning",
      "checkin:yesterday",
    ]);
  });

  it("flare row produces 2 events at the same time", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "flarey", flare: "yes", date: "2026-04-25" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(2);
    const types = result.events.map((e) => e.type).sort();
    expect(types).toEqual(["check-in", "flare"]);
    // Both events share the same date + time.
    expect(result.events[0].time).toBe(result.events[1].time);
    expect(result.events[0].date).toBe(result.events[1].date);
  });

  it("scopes by userId — does not leak rows from other users", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "mine", userId: "user_A", date: "2026-04-25" }),
      seed({ _id: "theirs", userId: "user_B", date: "2026-04-25" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventId).toBe("checkin:mine");
  });

  it("excludes soft-deleted rows", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "live", date: "2026-04-25" }),
      seed({ _id: "deleted", date: "2026-04-25", deletedAt: 123 }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventId).toBe("checkin:live");
  });

  it("inclusive bounds: rows on fromDate and toDate are included", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      seed({ _id: "from", date: "2026-04-22" }),
      seed({ _id: "to", date: "2026-04-24" }),
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-22",
      toDate: "2026-04-24",
    });
    expect(result.events.map((e) => e.eventId)).toEqual([
      "checkin:to",
      "checkin:from",
    ]);
  });

  // ---- F05 chunk 5.C — visit + blood-work merge ---------------------------

  it("includes a doctorVisit on the given date with APPOINTMENT-shape fields", async () => {
    const { ctx, visitRows } = makeCtx();
    visitRows.push({
      _id: "visit_a",
      userId: "user_A",
      date: "2026-04-25",
      doctorName: "Dr. Mehta",
      specialty: "rheumatologist",
      visitType: "follow-up",
      notes: undefined,
      source: "check-in",
      createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0), // 14:30 IST
    });
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(1);
    const ev = result.events[0]!;
    expect(ev.type).toBe("visit");
    expect(ev.eventId).toBe("visit:visit_a");
    expect(ev.title).toBe("Doctor visit");
    expect(ev.meta).toBe("Dr. Mehta · Follow-up");
    expect(ev.taskState).toBe("done");
    if (ev.type === "visit") {
      expect(ev.payload.visitId).toBe("visit_a");
      expect(ev.payload.specialty).toBe("rheumatologist");
      expect(ev.payload.visitType).toBe("follow-up");
      expect(ev.payload.source).toBe("check-in");
    }
  });

  it("future-dated visit projects taskState='pending'; today/past project 'done'", async () => {
    // Pin nowMs to noon-IST on 2026-05-09 so the boundary is deterministic.
    const nowMs = Date.UTC(2026, 4, 9, 6, 30, 0, 0); // 12:00 IST
    const { ctx, visitRows } = makeCtx();
    visitRows.push(
      {
        _id: "visit_past",
        userId: "user_A",
        date: "2026-05-08", // yesterday → done
        doctorName: "Dr. A",
        specialty: undefined,
        visitType: "consultation",
        notes: undefined,
        source: "module",
        createdAt: Date.UTC(2026, 4, 8, 9, 0, 0, 0),
      },
      {
        _id: "visit_today",
        userId: "user_A",
        date: "2026-05-09", // today → done
        doctorName: "Dr. B",
        specialty: undefined,
        visitType: "consultation",
        notes: undefined,
        source: "module",
        createdAt: Date.UTC(2026, 4, 9, 4, 0, 0, 0),
      },
      {
        _id: "visit_future",
        userId: "user_A",
        date: "2026-05-12", // future → pending
        doctorName: "Dr. C",
        specialty: undefined,
        visitType: "follow-up",
        notes: undefined,
        source: "module",
        createdAt: Date.UTC(2026, 4, 9, 5, 0, 0, 0),
      },
    );
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-05-08",
      toDate: "2026-05-12",
      nowMs,
    });
    const byId = new Map(result.events.map((e) => [e.eventId, e]));
    expect(byId.get("visit:visit_past")?.taskState).toBe("done");
    expect(byId.get("visit:visit_today")?.taskState).toBe("done");
    expect(byId.get("visit:visit_future")?.taskState).toBe("pending");
  });

  it("includes a bloodWork entry with markerCount + abnormalCount", async () => {
    const { ctx, bloodWorkRows } = makeCtx();
    bloodWorkRows.push({
      _id: "bw_a",
      userId: "user_A",
      date: "2026-04-25",
      markers: [
        { name: "CRP", value: 12, unit: "mg/L", abnormal: true },
        { name: "ESR", value: 30, unit: "mm/hr", abnormal: true },
        { name: "Hb", value: 13.5, unit: "g/dL", abnormal: false },
      ],
      notes: undefined,
      source: "check-in",
      createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
    });
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(1);
    const ev = result.events[0]!;
    expect(ev.type).toBe("blood-work");
    expect(ev.eventId).toBe("bloodwork:bw_a");
    expect(ev.title).toBe("Blood work");
    expect(ev.meta).toBe("3 markers · 2 abnormal");
    expect(ev.taskState).toBe("done");
    if (ev.type === "blood-work") {
      expect(ev.payload.bloodWorkId).toBe("bw_a");
      expect(ev.payload.markerCount).toBe(3);
      expect(ev.payload.abnormalCount).toBe(2);
    }
  });

  it("blood-work meta omits the abnormal segment when abnormalCount is 0", async () => {
    const { ctx, bloodWorkRows } = makeCtx();
    bloodWorkRows.push({
      _id: "bw_b",
      userId: "user_A",
      date: "2026-04-25",
      markers: [
        { name: "CRP", value: 2, unit: "mg/L", abnormal: false },
      ],
      notes: undefined,
      source: "module",
      createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
    });
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events[0]!.meta).toBe("1 marker");
  });

  it("excludes soft-deleted visit + blood-work rows", async () => {
    const { ctx, visitRows, bloodWorkRows } = makeCtx();
    visitRows.push({
      _id: "visit_live",
      userId: "user_A",
      date: "2026-04-25",
      doctorName: "Dr. A",
      visitType: "consultation",
      source: "module",
      createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
    });
    visitRows.push({
      _id: "visit_deleted",
      userId: "user_A",
      date: "2026-04-25",
      doctorName: "Dr. B",
      visitType: "consultation",
      source: "module",
      createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
      deletedAt: 999,
    });
    bloodWorkRows.push({
      _id: "bw_deleted",
      userId: "user_A",
      date: "2026-04-25",
      markers: [{ name: "CRP", value: 2, unit: "mg/L" }],
      source: "module",
      createdAt: Date.UTC(2026, 3, 25, 9, 0, 0, 0),
      deletedAt: 999,
    });
    const result = await listEventsByRangeHandler(ctx as unknown as Ctx, {
      userId: "user_A",
      fromDate: "2026-04-25",
      toDate: "2026-04-25",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.eventId).toBe("visit:visit_live");
  });
});
