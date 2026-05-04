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
  // the Vercel AI Gateway. Above 5 attempts/user/day in production
  // (50 in dev/preview per backlog item 22.4), the route returns 429 with
  // code `extract.daily_cap_reached`.
  extractAttempts: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD in device-local timezone
    count: v.number(),
    lastAttemptAt: v.number(),
  }).index("by_user_date", ["userId", "date"]),

  // Feature 04 Cycle 1 — Medications regimen.
  //
  // One row per medication a user has on their regimen. `isActive` flips
  // to false (and `deactivatedAt` is set) when the user removes a med
  // rather than hard-deleting; doing so preserves intake event + dose
  // change history that may reference this row.
  //
  // Fields per scoping § Medications module: name, dose, frequency,
  // category, delivery. Free-form `dose` and `frequency` strings keep the
  // entry surface light — voice-first regimen capture (F04 C2) will
  // structure these further. ADR-030 locks the Hybrid (Option D) shape.
  medications: defineTable({
    userId: v.string(),
    name: v.string(),
    dose: v.string(), // e.g. "15mg", "1 tablet"
    frequency: v.string(), // e.g. "once daily", "twice weekly"
    category: v.union(
      v.literal("arthritis-focused"),
      v.literal("immunosuppressant"),
      v.literal("steroid"),
      v.literal("nsaid"),
      v.literal("antidepressant"),
      v.literal("supplement"),
      v.literal("other"),
    ),
    delivery: v.union(
      v.literal("oral"),
      v.literal("injectable"),
      v.literal("iv"),
      v.literal("other"),
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    deactivatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  // Feature 04 Cycle 1 — Medication intake events (first-class).
  //
  // Every dose taken is its own row. Two capture paths feed this table:
  //   - 'home-tap'  — user tapped the IntakeTapList card on /home
  //   - 'check-in'  — voice flow extracted "I took my morning meds"
  //   - 'module'    — explicit log inside /medications
  // Idempotency mirrors checkIns: `clientRequestId` collapses retries.
  // Dedupe across paths is enforced in the mutation handler — a same-day
  // intake for (userId, medicationId) on path A skips the path-B insert.
  intakeEvents: defineTable({
    userId: v.string(),
    medicationId: v.id("medications"),
    takenAt: v.number(),
    date: v.string(), // YYYY-MM-DD device-local
    source: v.union(
      v.literal("home-tap"),
      v.literal("check-in"),
      v.literal("module"),
    ),
    clientRequestId: v.string(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_med_date", ["userId", "medicationId", "date"]),

  // Feature 04 Cycle 1 — Dosage change audit trail.
  //
  // Every time a doctor changes a dose, a row is appended. Captured via
  // the Medications module directly (`source: 'module'`) or opportunistically
  // from the voice check-in (`source: 'check-in'` + `checkInId` link).
  // Reason is optional — patients often relay the change without the
  // clinician's rationale.
  dosageChanges: defineTable({
    userId: v.string(),
    medicationId: v.id("medications"),
    oldDose: v.string(),
    newDose: v.string(),
    changedAt: v.number(),
    reason: v.optional(v.string()),
    source: v.union(v.literal("module"), v.literal("check-in")),
    checkInId: v.optional(v.id("checkIns")),
  })
    .index("by_user_med", ["userId", "medicationId"])
    .index("by_user_changed_at", ["userId", "changedAt"]),

  // Feature 05 Cycle 1 — Doctor visits as first-class timeline events.
  //
  // Manual capture via /visits/new OR opportunistic voice extraction during
  // a check-in (then `source: 'check-in'` + `checkInId` link, and
  // `transcript` may be left undefined since the linked check-in already
  // holds it). Visits become Memory timeline markers and anchor points
  // for the F06 Doctor Report's auto-window. Soft-delete via `deletedAt`
  // matches the checkIns convention. ADR-031 locks first-class shape.
  doctorVisits: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    doctorName: v.string(),
    specialty: v.optional(v.string()),
    visitType: v.union(
      v.literal("consultation"),
      v.literal("follow-up"),
      v.literal("urgent"),
      v.literal("other"),
    ),
    notes: v.optional(v.string()),
    source: v.union(v.literal("module"), v.literal("check-in")),
    checkInId: v.optional(v.id("checkIns")),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_user_date", ["userId", "date"]),

  // Feature 05 Cycle 1 — Blood work results (structured markers).
  //
  // Markers are stored inline as an array. MVP common defaults — CRP, ESR,
  // WBC, Hb — are surfaced in the form but not enforced; users can add
  // free-form markers. Reference ranges are optional fields per marker so
  // the Doctor Report appendix can show abnormal-flagging when present.
  // PDF/image attachment + OCR are post-MVP backlog item 3.
  bloodWork: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    markers: v.array(
      v.object({
        name: v.string(), // CRP, ESR, WBC, Hb, or free-form
        value: v.number(),
        unit: v.string(),
        refRangeLow: v.optional(v.number()),
        refRangeHigh: v.optional(v.number()),
        abnormal: v.optional(v.boolean()),
      }),
    ),
    notes: v.optional(v.string()),
    source: v.union(v.literal("module"), v.literal("check-in")),
    checkInId: v.optional(v.id("checkIns")),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_user_date", ["userId", "date"]),
});
