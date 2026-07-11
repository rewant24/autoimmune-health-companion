/**
 * F04 C1 — Layer 1 integration tests against real dev Convex.
 *
 * Talks to `https://hardy-hamster-888.convex.cloud` via `ConvexHttpClient`.
 * Covers the eight regimen / intake / dosage / cross-table cases that the
 * unit-test layer (which uses mock ctxs) cannot exercise — schema validators,
 * real indexes, transactional patches, and the Convex runtime's `v.id()`
 * coercion all run for real here.
 *
 * Cleanup model: each test gets a fresh synthetic userId of the form
 * `qa_<uuid>` and calls `devSeed:wipeUser` in `afterEach`. `wipeUser` is
 * implemented as a public mutation gated on the `qa_` prefix — see the
 * comment in `convex/devSeed.ts` for why it isn't `internalMutation`.
 *
 * Function-name notes vs. the QA plan:
 *   - `intakeEvents.logIntake` returns `{ id, deduped, source }` (not
 *     `{ intakeEventId, ... }`). Tests assert against the actual shape.
 *   - `medications.getTodayAdherence` returns
 *     `Array<{ medication, takenToday, lastTakenAt? }>` — `medication` is
 *     a nested object, not flattened.
 *   - There is no `checkIns.listMemory`. The merged feed is
 *     `checkIns.listEventsByRange` returning `{ events: MemoryEvent[] }`
 *     where each event has a `type` discriminator (`'check-in'` |
 *     `'flare'` | `'intake'` | `'visit'`). Test 7 asserts on `type`.
 *   - The check-in mutation is `checkIns.createCheckin` (the QA plan said
 *     `checkIns.append`).
 *   - `dosageChanges.recordDosageChange` requires `oldDose !== newDose` —
 *     test 5 honors that.
 */

// Load `.env.local` (Next.js convention) — dotenv's default `.env` would miss it.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });
loadDotenv(); // also pick up `.env` if present

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SUITE_ENABLED = Boolean(CONVEX_URL);

// One client per file. ConvexHttpClient is stateful (queues mutations) so
// we don't share it across files — but within a file is fine since tests
// run in sequence (singleThread: true).
let client: ConvexHttpClient;

// Track every userId created in this file so `afterEach` can wipe them
// even if a test threw before pushing its own cleanup.
const createdUsers = new Set<string>();

function newQaUser(): string {
  const id = `qa_${randomUUID()}`;
  createdUsers.add(id);
  return id;
}

function todayYmd(): string {
  // Plain UTC YYYY-MM-DD. Date math correctness isn't what we're testing
  // here — we just need a stable string the schema accepts.
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

beforeAll(() => {
  if (!SUITE_ENABLED) return;
  client = new ConvexHttpClient(CONVEX_URL!);
});

afterEach(async () => {
  if (!SUITE_ENABLED) return;
  // Wipe every user touched in this file, then reset the set.
  const users = Array.from(createdUsers);
  createdUsers.clear();
  for (const userId of users) {
    try {
      await client.mutation(api.devSeed.wipeUser, { userId });
    } catch (err) {
      // Best-effort cleanup — log and move on so a transient error doesn't
      // mask the actual test failure.
      console.warn(`[wipeUser] ${userId} failed:`, err);
    }
  }
});

describe.skipIf(!SUITE_ENABLED)("F04 C1 — medications integration", () => {
  it("1. regimen CRUD round-trip", async () => {
    const userId = newQaUser();

    const created = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Methotrexate",
      dose: "15mg",
      frequency: "weekly",
      category: "immunosuppressant",
      delivery: "oral",
    })) as { id: Id<"medications"> };
    expect(created.id).toBeTruthy();

    let active = (await client.query(api.medications.listActiveMedications, {
      userId,
    })) as Array<{ _id: string; dose: string; isActive: boolean }>;
    expect(active.map((r) => r._id)).toContain(created.id);
    expect(active.find((r) => r._id === created.id)?.dose).toBe("15mg");

    await client.mutation(api.medications.updateMedication, {
      medicationId: created.id,
      userId,
      dose: "20mg",
    });

    active = (await client.query(api.medications.listActiveMedications, {
      userId,
    })) as Array<{ _id: string; dose: string; isActive: boolean }>;
    expect(active.find((r) => r._id === created.id)?.dose).toBe("20mg");

    const deactivated = (await client.mutation(
      api.medications.deactivateMedication,
      { medicationId: created.id, userId },
    )) as { alreadyInactive: boolean };
    expect(deactivated.alreadyInactive).toBe(false);

    active = (await client.query(api.medications.listActiveMedications, {
      userId,
    })) as Array<{ _id: string; dose: string; isActive: boolean }>;
    expect(active.map((r) => r._id)).not.toContain(created.id);

    const all = (await client.query(api.medications.listAllMedications, {
      userId,
    })) as Array<{ _id: string; isActive: boolean }>;
    const row = all.find((r) => r._id === created.id);
    expect(row).toBeDefined();
    expect(row?.isActive).toBe(false);
  });

  it("2. logIntake happy path + getTodayAdherence reflects it", async () => {
    const userId = newQaUser();
    const date = todayYmd();

    const med = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Hydroxychloroquine",
      dose: "200mg",
      frequency: "twice daily",
      category: "arthritis-focused",
      delivery: "oral",
    })) as { id: Id<"medications"> };

    const takenAt = Date.now();
    const intake = (await client.mutation(api.intakeEvents.logIntake, {
      userId,
      medicationId: med.id,
      date,
      takenAt,
      source: "home-tap",
      clientRequestId: `qa-${randomUUID()}`,
    })) as { id: string; deduped: boolean; source: string };
    expect(intake.deduped).toBe(false);
    expect(intake.id).toBeTruthy();

    const adherence = (await client.query(
      api.medications.getTodayAdherence,
      { userId, date },
    )) as Array<{
      medication: { _id: string };
      takenToday: boolean;
      lastTakenAt?: number;
    }>;
    const row = adherence.find((r) => r.medication._id === med.id);
    expect(row).toBeDefined();
    expect(row?.takenToday).toBe(true);
    expect(typeof row?.lastTakenAt).toBe("number");
  });

  it("3. cross-path dedupe (home-tap then voice/check-in)", async () => {
    const userId = newQaUser();
    const date = todayYmd();

    const med = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Prednisone",
      dose: "5mg",
      frequency: "once daily",
      category: "steroid",
      delivery: "oral",
    })) as { id: Id<"medications"> };

    const first = (await client.mutation(api.intakeEvents.logIntake, {
      userId,
      medicationId: med.id,
      date,
      source: "home-tap",
      clientRequestId: `qa-${randomUUID()}`,
    })) as { id: string; deduped: boolean; source: string };
    expect(first.deduped).toBe(false);

    // Different clientRequestId, different source — must still dedupe and
    // return the FIRST row's id with the FIRST row's source preserved.
    const second = (await client.mutation(api.intakeEvents.logIntake, {
      userId,
      medicationId: med.id,
      date,
      source: "check-in",
      clientRequestId: `qa-${randomUUID()}`,
    })) as { id: string; deduped: boolean; source: string };
    expect(second.deduped).toBe(true);
    expect(second.id).toBe(first.id);
    expect(second.source).toBe("home-tap");

    const dayList = (await client.query(
      api.intakeEvents.listIntakeEventsByDate,
      { userId, date },
    )) as Array<{ _id: string }>;
    expect(dayList.length).toBe(1);
    expect(dayList[0]._id).toBe(first.id);
  });

  it("4. clientRequestId idempotency", async () => {
    const userId = newQaUser();
    const date = todayYmd();

    const med = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Sulfasalazine",
      dose: "500mg",
      frequency: "twice daily",
      category: "arthritis-focused",
      delivery: "oral",
    })) as { id: Id<"medications"> };

    const reqId = `qa-${randomUUID()}`;
    const first = (await client.mutation(api.intakeEvents.logIntake, {
      userId,
      medicationId: med.id,
      date,
      source: "home-tap",
      clientRequestId: reqId,
    })) as { id: string; deduped: boolean };
    expect(first.deduped).toBe(false);

    const replay = (await client.mutation(api.intakeEvents.logIntake, {
      userId,
      medicationId: med.id,
      date,
      source: "home-tap",
      clientRequestId: reqId,
    })) as { id: string; deduped: boolean };
    expect(replay.deduped).toBe(true);
    expect(replay.id).toBe(first.id);
  });

  it("5. recordDosageChange — 'check-in' accepts absent checkInId (best-effort linkage), 'module' forbids it, atomic patch+audit", async () => {
    const userId = newQaUser();
    const date = todayYmd();

    const med = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Methotrexate",
      dose: "15mg",
      frequency: "weekly",
      category: "immunosuppressant",
      delivery: "oral",
    })) as { id: Id<"medications"> };

    // A real check-in row: used to prove the 'module' rejection below fires
    // on the forbidden-rule, not on Id validation, and for linkage in (c).
    // The shipped mutation is `checkIns.createCheckin` (NOT `append` as the
    // QA plan stated).
    const checkin = (await client.mutation(api.checkIns.createCheckin, {
      userId,
      date,
      pain: 5,
      mood: "okay",
      adherenceTaken: true,
      flare: "no",
      energy: 6,
      transcript: "QA test transcript",
      stage: "open",
      durationMs: 30_000,
      providerUsed: "qa-integration",
      clientRequestId: `qa-${randomUUID()}`,
    })) as unknown as { id: Id<"checkIns"> };

    // (a) Source 'module' with a checkInId must reject
    //     (dosage.checkin_id_forbidden).
    await expect(
      client.mutation(api.dosageChanges.recordDosageChange, {
        userId,
        medicationId: med.id,
        oldDose: "15mg",
        newDose: "20mg",
        source: "module",
        checkInId: checkin.id,
      }),
    ).rejects.toThrow();

    // (b) Source 'check-in' WITHOUT checkInId records — confirm cards are
    //     non-blocking, the check-in row may not exist yet (PR #38 relaxed
    //     the handler to the documented best-effort intent; the old
    //     dosage.checkin_id_required rejection was the latent prod bug).
    await client.mutation(api.dosageChanges.recordDosageChange, {
      userId,
      medicationId: med.id,
      oldDose: "15mg",
      newDose: "20mg",
      source: "check-in",
    });

    // (c) Source 'check-in' WITH a real checkInId records with linkage.
    await client.mutation(api.dosageChanges.recordDosageChange, {
      userId,
      medicationId: med.id,
      oldDose: "20mg",
      newDose: "25mg",
      source: "check-in",
      checkInId: checkin.id,
    });

    // medication.dose patched through both changes
    const all = (await client.query(api.medications.listAllMedications, {
      userId,
    })) as Array<{ _id: string; dose: string }>;
    expect(all.find((r) => r._id === med.id)?.dose).toBe("25mg");

    // two audit rows: unlinked best-effort first, linked second
    const changes = (await client.query(
      api.dosageChanges.listDosageChanges,
      { userId, medicationId: med.id },
    )) as Array<{ oldDose: string; newDose: string; checkInId?: string }>;
    expect(changes.length).toBe(2);
    const unlinked = changes.find((c) => c.newDose === "20mg");
    expect(unlinked?.oldDose).toBe("15mg");
    expect(unlinked?.checkInId).toBeUndefined();
    const linked = changes.find((c) => c.newDose === "25mg");
    expect(linked?.oldDose).toBe("20mg");
    expect(linked?.checkInId).toBe(checkin.id);
  });

  it("6. getTodayAdherence shape — 2 meds, 1 logged", async () => {
    const userId = newQaUser();
    const date = todayYmd();

    const medA = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Med A",
      dose: "10mg",
      frequency: "once daily",
      category: "other",
      delivery: "oral",
    })) as { id: Id<"medications"> };
    const medB = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Med B",
      dose: "5mg",
      frequency: "once daily",
      category: "other",
      delivery: "oral",
    })) as { id: Id<"medications"> };

    await client.mutation(api.intakeEvents.logIntake, {
      userId,
      medicationId: medA.id,
      date,
      source: "home-tap",
      clientRequestId: `qa-${randomUUID()}`,
    });

    const adherence = (await client.query(
      api.medications.getTodayAdherence,
      { userId, date },
    )) as Array<{
      medication: { _id: string };
      takenToday: boolean;
      lastTakenAt?: number;
    }>;
    expect(adherence.length).toBe(2);

    const rowA = adherence.find((r) => r.medication._id === medA.id);
    const rowB = adherence.find((r) => r.medication._id === medB.id);
    expect(rowA?.takenToday).toBe(true);
    expect(typeof rowA?.lastTakenAt).toBe("number");
    expect(rowB?.takenToday).toBe(false);
    expect(rowB?.lastTakenAt).toBeUndefined();
  });

  it("7. listEventsByRange merges check-ins and intakes (QA plan called this listMemory)", async () => {
    const userId = newQaUser();
    const date = todayYmd();

    // Check-in first.
    await client.mutation(api.checkIns.createCheckin, {
      userId,
      date,
      pain: 4,
      mood: "okay",
      adherenceTaken: true,
      flare: "no",
      energy: 6,
      transcript: "QA merge test",
      stage: "open",
      durationMs: 25_000,
      providerUsed: "qa-integration",
      clientRequestId: `qa-${randomUUID()}`,
    });

    const med = (await client.mutation(api.medications.createMedication, {
      userId,
      name: "Methotrexate",
      dose: "15mg",
      frequency: "weekly",
      category: "immunosuppressant",
      delivery: "oral",
    })) as { id: Id<"medications"> };
    await client.mutation(api.intakeEvents.logIntake, {
      userId,
      medicationId: med.id,
      date,
      source: "home-tap",
      clientRequestId: `qa-${randomUUID()}`,
    });

    const result = (await client.query(api.checkIns.listEventsByRange, {
      userId,
      fromDate: date,
      toDate: date,
    })) as { events: Array<{ type: string; date: string; time: string }> };
    expect(result.events.length).toBeGreaterThanOrEqual(2);

    const types = new Set(result.events.map((e) => e.type));
    expect(types.has("check-in")).toBe(true);
    expect(types.has("intake")).toBe(true);

    // Sort assertion: (date desc, time desc). Same date here, so check time ordering.
    for (let i = 1; i < result.events.length; i++) {
      const prev = result.events[i - 1];
      const curr = result.events[i];
      if (prev.date === curr.date) {
        expect(prev.time >= curr.time).toBe(true);
      } else {
        expect(prev.date > curr.date).toBe(true);
      }
    }
  });

  it("8. ADR-019 defense-in-depth — cross-user updateMedication is rejected", async () => {
    const userA = newQaUser();
    const userB = newQaUser();

    const med = (await client.mutation(api.medications.createMedication, {
      userId: userA,
      name: "User A's med",
      dose: "10mg",
      frequency: "once daily",
      category: "other",
      delivery: "oral",
    })) as { id: Id<"medications"> };

    await expect(
      client.mutation(api.medications.updateMedication, {
        medicationId: med.id,
        userId: userB,
        dose: "999mg",
      }),
    ).rejects.toThrow();

    // Verify the dose was NOT mutated.
    const all = (await client.query(api.medications.listAllMedications, {
      userId: userA,
    })) as Array<{ _id: string; dose: string }>;
    expect(all.find((r) => r._id === med.id)?.dose).toBe("10mg");
  });
});
