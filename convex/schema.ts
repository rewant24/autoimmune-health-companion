import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Feature 01 Cycle 1 + Cycle 2 — daily voice check-in records.
  //
  // Range validation for pain/energy (1–10) is enforced in the mutation
  // handler (`createCheckin`) rather than at the schema level, because
  // Convex validators don't express numeric bounds declaratively.
  //
  // Cycle 2 schema migration (2026-04-25, F01 C2 pre-flight):
  // - All five metrics (pain, mood, adherenceTaken, flare, energy) became
  //   optional. `null` (or undefined) means the user declined that metric
  //   today — distinct from "not captured." See ADR-021.
  // - `flare` migrated from boolean → tri-state union ('no'|'yes'|'ongoing')
  //   to capture rolling flares that span multiple days.
  // - Added `declined: string[]` so the pattern engine can render
  //   "skipped today" distinctly from "not captured."
  // - Added `appendedTo` to link same-day re-entry blocks to the original
  //   check-in (Cycle 2 chunk 2.F).
  // - `date` is YYYY-MM-DD computed in the user's device local timezone
  //   (Q3 locked 2026-04-25 — narrow scope: applies to the same-day
  //   re-entry path only; Memory's IST-hardcoded scrubber stays until F02 C2).
  checkIns: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD in device-local timezone
    createdAt: v.number(),
    pain: v.optional(v.number()),
    mood: v.optional(
      v.union(
        v.literal("heavy"),
        v.literal("flat"),
        v.literal("okay"),
        v.literal("bright"),
        v.literal("great"),
      ),
    ),
    adherenceTaken: v.optional(v.boolean()),
    flare: v.optional(
      v.union(v.literal("no"), v.literal("yes"), v.literal("ongoing")),
    ),
    energy: v.optional(v.number()),
    declined: v.optional(
      v.array(
        v.union(
          v.literal("pain"),
          v.literal("mood"),
          v.literal("adherenceTaken"),
          v.literal("flare"),
          v.literal("energy"),
        ),
      ),
    ),
    appendedTo: v.optional(v.id("checkIns")),
    transcript: v.string(),
    stage: v.union(
      v.literal("open"),
      v.literal("scripted"),
      v.literal("hybrid"),
    ),
    durationMs: v.number(),
    providerUsed: v.string(),
    clientRequestId: v.string(),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  }).index("by_user_date", ["userId", "date"]),

  // Feature 01 Cycle 2 — per-user-per-day extraction attempt counter
  // for the ADR-020 cost guard. The route handler at
  // app/api/check-in/extract/route.ts increments this row before invoking
  // the Vercel AI Gateway. Above 5 attempts/user/day, the route returns
  // 429 with code `extract.daily_cap_reached`.
  extractAttempts: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD in device-local timezone
    count: v.number(),
    lastAttemptAt: v.number(),
  }).index("by_user_date", ["userId", "date"]),
});
