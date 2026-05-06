/**
 * F04 C1 — Layer 3 QA: concurrent-write dedupe tests.
 *
 * Verifies the single-row-per-(userId, medicationId, date) invariant for
 * `intakeEvents.logIntake` under parallel load against the dev Convex
 * deployment `hardy-hamster-888`. A dedupe miss double-counts adherence
 * and corrupts the audit trail, so this is the highest-blast-radius
 * race condition in the F04 surface.
 *
 * Convex enforces serialisability via OCC (optimistic concurrency
 * control). 50 mutations contending on the same `by_user_med_date`
 * index slice will retry transparently until they serialise; per-test
 * wall-clock can run 5–15s. We bump testTimeout to 60s.
 *
 * If Convex surfaces a "transaction conflict" instead of retrying,
 * the test fails and that's the intended signal.
 *
 * ASSUMPTIONS (Layer 1 deliverables):
 *   1. `vitest.integration.config.ts` is wired up at the repo root and
 *      `pnpm test:integration` runs every file under `tests/integration/`.
 *   2. `convex/devSeed.ts` exports `wipeUser({ userId })` which deletes
 *      every row for that user across `medications`, `intakeEvents`, and
 *      any other F04 tables. Referenced as `api.devSeed.wipeUser`.
 *   3. `.env.local` defines `NEXT_PUBLIC_CONVEX_URL` pointing at the
 *      dev deployment.
 * If any of those aren't in place yet, this file will fail to import
 * cleanly — coordinate with Layer 1.
 */

import { config as loadDotenv } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";

// `.env.local` (not `.env`) is where NEXT_PUBLIC_CONVEX_URL lives in this repo.
// Match Layer 1's explicit-path pattern.
loadDotenv({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is required. Add it to .env.local before running pnpm test:integration.",
  );
}

const client = new ConvexHttpClient(CONVEX_URL);

/** YYYY-MM-DD in device-local timezone — matches what the app sends. */
function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Per-test synthetic user so cleanup is bounded. */
function freshUserId(): string {
  return `qa_${crypto.randomUUID()}`;
}

async function seedMedication(
  userId: string,
  name = "Methotrexate",
): Promise<string> {
  const { id } = await client.mutation(api.medications.createMedication, {
    userId,
    name,
    dose: "15mg",
    frequency: "once weekly",
    category: "immunosuppressant",
    delivery: "oral",
  });
  return id;
}

let activeUserId: string | null = null;

beforeAll(() => {
  if (!CONVEX_URL) return;
  // eslint-disable-next-line no-console
  console.log(`[concurrency] target Convex deployment: ${CONVEX_URL}`);
});

afterEach(async () => {
  if (activeUserId) {
    try {
      await client.mutation(api.devSeed.wipeUser, { userId: activeUserId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[concurrency] wipeUser failed for ${activeUserId}; rows may persist on dev:`,
        err,
      );
    }
    activeUserId = null;
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("F04 C1 logIntake — concurrent dedupe invariants", () => {
  // 50 parallel writes against dev Convex with OCC retries can run 5–15s
  // realistic, but cold-cache + network jitter has been observed to push past
  // the 30s default on Case 2 (50 distinct rows). Apply 60s to the whole suite.
  // Note: vi.setConfig() inside a test body does NOT change the current test's
  // timeout — it applies to subsequent tests only. Use the third positional
  // arg on test() instead so the timeout binds before the test starts.
  test("Case 1: 50 parallel calls on the same (user, med, date) collapse to 1 row", async () => {
    const userId = freshUserId();
    activeUserId = userId;
    const medicationId = await seedMedication(userId);
    const date = todayLocalYmd();

    const calls = Array.from({ length: 50 }, () => ({
      clientRequestId: crypto.randomUUID(),
      takenAt: Date.now(),
    }));

    const started = Date.now();
    const results = await Promise.all(
      calls.map((c) =>
        client.mutation(api.intakeEvents.logIntake, {
          userId,
          medicationId: medicationId as never,
          date,
          source: "home-tap",
          clientRequestId: c.clientRequestId,
          takenAt: c.takenAt,
        }),
      ),
    );
    const elapsedMs = Date.now() - started;
    // eslint-disable-next-line no-console
    console.log(`[concurrency:case1] 50 parallel calls in ${elapsedMs}ms`);

    const winners = results.filter((r) => r.deduped === false);
    const losers = results.filter((r) => r.deduped === true);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(49);

    // Telemetry: who won the race?
    const winnerIdx = results.findIndex((r) => r.deduped === false);
    // eslint-disable-next-line no-console
    console.log(
      `[concurrency:case1] winner clientRequestId=${calls[winnerIdx].clientRequestId} id=${winners[0].id}`,
    );

    // All 50 returned ids point at the same physical row.
    const uniqueIds = new Set(results.map((r) => r.id));
    expect(uniqueIds.size).toBe(1);

    // And the table actually contains exactly one live row.
    const rows = await client.query(api.intakeEvents.listIntakeEventsByDate, {
      userId,
      date,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(winners[0].id);
  }, 60_000);

  test("Case 2: 50 parallel calls on different medications, same user/date — no over-dedupe", async () => {
    const userId = freshUserId();
    activeUserId = userId;
    const date = todayLocalYmd();

    // Seed sequentially — `createMedication` doesn't race against itself
    // and we want stable medication ids before the parallel intake fan-out.
    const medicationIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const id = await seedMedication(userId, `QA-Med-${i + 1}`);
      medicationIds.push(id);
    }

    const started = Date.now();
    const results = await Promise.all(
      medicationIds.map((medicationId) =>
        client.mutation(api.intakeEvents.logIntake, {
          userId,
          medicationId: medicationId as never,
          date,
          source: "home-tap",
          clientRequestId: crypto.randomUUID(),
          takenAt: Date.now(),
        }),
      ),
    );
    const elapsedMs = Date.now() - started;
    // eslint-disable-next-line no-console
    console.log(`[concurrency:case2] 50 parallel calls in ${elapsedMs}ms`);

    // None should dedupe — each (user, med, date) triple is unique.
    const dedupedCount = results.filter((r) => r.deduped === true).length;
    expect(dedupedCount).toBe(0);

    // All 50 returned ids are distinct rows.
    const uniqueIds = new Set(results.map((r) => r.id));
    expect(uniqueIds.size).toBe(50);

    // Table reflects 50 rows for the day.
    const rows = await client.query(api.intakeEvents.listIntakeEventsByDate, {
      userId,
      date,
    });
    expect(rows).toHaveLength(50);
  }, 60_000);

  test("Case 3: 25 home-tap + 25 voice on same triple — first source wins", async () => {
    const userId = freshUserId();
    activeUserId = userId;
    const medicationId = await seedMedication(userId);
    const date = todayLocalYmd();

    // Convex public sources: 'home-tap' | 'check-in' | 'module'.
    // The task spec says 'home-tap' vs 'voice'; the voice path persists as
    // 'check-in' on the server (see convex/intakeEvents.ts header comment).
    const homeTapCalls = Array.from({ length: 25 }, () => ({
      source: "home-tap" as const,
      clientRequestId: crypto.randomUUID(),
    }));
    const voiceCalls = Array.from({ length: 25 }, () => ({
      source: "check-in" as const,
      clientRequestId: crypto.randomUUID(),
    }));

    const interleaved = [...homeTapCalls, ...voiceCalls];

    const started = Date.now();
    const results = await Promise.all(
      interleaved.map((c) =>
        client.mutation(api.intakeEvents.logIntake, {
          userId,
          medicationId: medicationId as never,
          date,
          source: c.source,
          clientRequestId: c.clientRequestId,
          takenAt: Date.now(),
        }),
      ),
    );
    const elapsedMs = Date.now() - started;
    // eslint-disable-next-line no-console
    console.log(`[concurrency:case3] 50 mixed-source parallel calls in ${elapsedMs}ms`);

    const winners = results.filter((r) => r.deduped === false);
    const losers = results.filter((r) => r.deduped === true);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(49);

    const rows = await client.query(api.intakeEvents.listIntakeEventsByDate, {
      userId,
      date,
    });
    expect(rows).toHaveLength(1);

    // Whichever source serialised first should be reflected on the surviving row.
    expect(["home-tap", "check-in"]).toContain(rows[0].source);
    expect(rows[0].source).toBe(winners[0].source);

    // eslint-disable-next-line no-console
    console.log(
      `[concurrency:case3] winning source=${rows[0].source} id=${rows[0]._id}`,
    );
  }, 60_000);
});
