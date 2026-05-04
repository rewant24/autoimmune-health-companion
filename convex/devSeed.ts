/**
 * Dev-only check-in seed for pattern smoke tests.
 *
 * Writes 15 days of realistic check-in rows for one user, modelling a
 * believable autoimmune flare cycle so the Memory tab + (future) Patterns
 * surface have something representative to render.
 *
 * Shape of the 15-day window (anchored to today IST):
 *   - day 1–3 (oldest): baseline (pain 3–4, mood okay/bright/great, flare no)
 *   - day 4–5: pre-flare warning (pain 5–6, mood okay/flat, flare no)
 *   - day 6:   main flare onset (pain 7, mood heavy, flare yes)
 *   - day 7:   main flare worst — adherence missed (pain 8, mood heavy,
 *              flare ongoing, adherenceTaken false)
 *   - day 8:   main flare tail (pain 7, mood flat, flare ongoing)
 *   - day 9–12: recovery + baseline (pain 3–5, mood improving)
 *   - day 13:  mini-flare (pain 6, mood flat, flare yes)
 *   - day 14:  recovery (pain 4)
 *   - day 15 (today): baseline good (pain 3, mood bright)
 *
 * Idempotent: always deletes existing rows with `providerUsed === 'seed'`
 * for the target userId before inserting. Re-runs are safe and reset to
 * the canonical 15-day pattern.
 *
 * Run from the repo root with the dev backend selected:
 *
 *   npx convex run devSeed:seedCheckins '{"userId":"<uuid>"}'
 *
 * Returns { deleted, inserted } counts for sanity-checking.
 *
 * Safety: this is an internalMutation — not callable from the browser.
 * Only `npx convex run` (which uses the deploy key) or another Convex
 * function can invoke it.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

interface SeedDay {
  /** Days back from today (IST). 0 = today, 14 = oldest. */
  offset: number;
  /** Hour of day IST (0–23) the user did the check-in. */
  istHour: number;
  istMinute: number;
  pain: number;
  mood: "heavy" | "flat" | "okay" | "bright" | "great";
  adherenceTaken: boolean;
  flare: "no" | "yes" | "ongoing";
  energy: number;
  transcript: string;
  /** Realistic check-in length — flare days run longer. */
  durationMs: number;
}

// Newest first → oldest last, so seed[0].offset === 0 is today.
const SEED_DAYS: SeedDay[] = [
  // Today — baseline good
  {
    offset: 0,
    istHour: 21,
    istMinute: 5,
    pain: 3,
    mood: "bright",
    adherenceTaken: true,
    flare: "no",
    energy: 8,
    transcript: "Feeling steady today. Took meds with breakfast. Light walk planned for the evening.",
    durationMs: 38_000,
  },
  // Yesterday — recovery from mini-flare
  {
    offset: 1,
    istHour: 22,
    istMinute: 12,
    pain: 4,
    mood: "okay",
    adherenceTaken: true,
    flare: "no",
    energy: 6,
    transcript: "Knee a lot better today. Took everything on time.",
    durationMs: 31_000,
  },
  // Mini-flare day
  {
    offset: 2,
    istHour: 20,
    istMinute: 40,
    pain: 6,
    mood: "flat",
    adherenceTaken: true,
    flare: "yes",
    energy: 4,
    transcript: "Right knee acting up after lunch, swollen by evening. Hope it's not another full flare. Took the methotrexate as usual.",
    durationMs: 58_000,
  },
  // Baseline quiet
  {
    offset: 3,
    istHour: 21,
    istMinute: 30,
    pain: 3,
    mood: "okay",
    adherenceTaken: true,
    flare: "no",
    energy: 7,
    transcript: "Quiet day. Nothing to flag.",
    durationMs: 22_000,
  },
  // Baseline good
  {
    offset: 4,
    istHour: 19,
    istMinute: 50,
    pain: 3,
    mood: "bright",
    adherenceTaken: true,
    flare: "no",
    energy: 7,
    transcript: "Good day. Walked in the park for half an hour, knees held up well.",
    durationMs: 36_000,
  },
  // Recovery day
  {
    offset: 5,
    istHour: 21,
    istMinute: 0,
    pain: 4,
    mood: "okay",
    adherenceTaken: true,
    flare: "no",
    energy: 6,
    transcript: "Almost back to normal. Took all meds.",
    durationMs: 28_000,
  },
  // Recovery day
  {
    offset: 6,
    istHour: 21,
    istMinute: 18,
    pain: 5,
    mood: "okay",
    adherenceTaken: true,
    flare: "no",
    energy: 5,
    transcript: "Better than yesterday. Knees still a bit tender but moving fine.",
    durationMs: 33_000,
  },
  // Main flare tail (day 3 of the flare)
  {
    offset: 7,
    istHour: 22,
    istMinute: 30,
    pain: 7,
    mood: "flat",
    adherenceTaken: true,
    flare: "ongoing",
    energy: 3,
    transcript: "Wrists still swollen, less than yesterday. Took everything today including the methotrexate I missed.",
    durationMs: 71_000,
  },
  // Main flare WORST — adherence missed
  {
    offset: 8,
    istHour: 22,
    istMinute: 50,
    pain: 8,
    mood: "heavy",
    adherenceTaken: false,
    flare: "ongoing",
    energy: 2,
    transcript: "Worst day this month. Stayed in bed mostly. Couldn't open jars. Forgot the methotrexate, will take tomorrow with the next one.",
    durationMs: 92_000,
  },
  // Main flare onset
  {
    offset: 9,
    istHour: 21,
    istMinute: 45,
    pain: 7,
    mood: "heavy",
    adherenceTaken: true,
    flare: "yes",
    energy: 3,
    transcript: "Both wrists and right knee are bad. Couldn't open the kettle this morning. Took meds but feeling rough.",
    durationMs: 84_000,
  },
  // Pre-flare warning rising
  {
    offset: 10,
    istHour: 20,
    istMinute: 30,
    pain: 6,
    mood: "flat",
    adherenceTaken: true,
    flare: "no",
    energy: 4,
    transcript: "Wrist worse than yesterday. Took an extra paracetamol after lunch. Going to bed early.",
    durationMs: 47_000,
  },
  // Pre-flare warning
  {
    offset: 11,
    istHour: 21,
    istMinute: 25,
    pain: 5,
    mood: "okay",
    adherenceTaken: true,
    flare: "no",
    energy: 5,
    transcript: "Right wrist a bit swollen. Hoping it passes overnight.",
    durationMs: 32_000,
  },
  // Baseline great
  {
    offset: 12,
    istHour: 20,
    istMinute: 10,
    pain: 3,
    mood: "great",
    adherenceTaken: true,
    flare: "no",
    energy: 8,
    transcript: "Best I've felt all week. Walked to the store and back without issues.",
    durationMs: 41_000,
  },
  // Baseline good
  {
    offset: 13,
    istHour: 21,
    istMinute: 0,
    pain: 4,
    mood: "bright",
    adherenceTaken: true,
    flare: "no",
    energy: 7,
    transcript: "Slept well. Knees a little stiff in the morning but managed everything.",
    durationMs: 35_000,
  },
  // Oldest — baseline okay
  {
    offset: 14,
    istHour: 21,
    istMinute: 15,
    pain: 3,
    mood: "okay",
    adherenceTaken: true,
    flare: "no",
    energy: 7,
    transcript: "Quiet day. Took meds in the morning.",
    durationMs: 27_000,
  },
];

/**
 * IST = UTC+5:30 with no DST. The check-in `date` field is YYYY-MM-DD
 * in device-local (IST) tz. We compute today IST from `Date.now()`,
 * then walk back N days. Each row's `createdAt` is the UTC ms for
 * the chosen IST time-of-day on that date.
 */
function todayIstYmd(): { y: number; m: number; d: number } {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return {
    y: istNow.getUTCFullYear(),
    m: istNow.getUTCMonth() + 1,
    d: istNow.getUTCDate(),
  };
}

function ymdString(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysBack(
  base: { y: number; m: number; d: number },
  n: number,
): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(base.y, base.m - 1, base.d));
  dt.setUTCDate(dt.getUTCDate() - n);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

/**
 * UTC ms for a given IST date + IST hour/minute. IST = UTC+5:30, so to
 * land at e.g. 21:00 IST on YYYY-MM-DD we subtract 5:30 from the IST
 * wall-clock to get the UTC instant.
 */
function utcMsForIst(
  y: number,
  m: number,
  d: number,
  istHour: number,
  istMinute: number,
): number {
  const utcHour = istHour - 5;
  const utcMinute = istMinute - 30;
  return Date.UTC(y, m - 1, d, utcHour, utcMinute, 0, 0);
}

export const seedCheckins = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Wipe any prior seed rows for this user — re-runs return to the
    //    canonical 15-day pattern.
    const existing = await ctx.db
      .query("checkIns")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .collect();
    let deleted = 0;
    for (const row of existing) {
      if (row.providerUsed === "seed") {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }

    // 2. Insert 15 fresh rows.
    const today = todayIstYmd();
    let inserted = 0;
    for (const day of SEED_DAYS) {
      const date = daysBack(today, day.offset);
      const dateStr = ymdString(date.y, date.m, date.d);
      const createdAt = utcMsForIst(
        date.y,
        date.m,
        date.d,
        day.istHour,
        day.istMinute,
      );
      await ctx.db.insert("checkIns", {
        userId: args.userId,
        date: dateStr,
        createdAt,
        pain: day.pain,
        mood: day.mood,
        adherenceTaken: day.adherenceTaken,
        flare: day.flare,
        energy: day.energy,
        transcript: day.transcript,
        stage: "open",
        durationMs: day.durationMs,
        providerUsed: "seed",
        clientRequestId: `seed_${args.userId}_${dateStr}`,
      });
      inserted++;
    }

    return { deleted, inserted };
  },
});

/**
 * Companion: wipe seeded rows without re-inserting. For when you want
 * to start fresh from a real-data smoke.
 *
 *   npx convex run devSeed:wipeSeed '{"userId":"<uuid>"}'
 */
export const wipeSeed = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("checkIns")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .collect();
    let deleted = 0;
    for (const row of rows) {
      if (row.providerUsed === "seed") {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
