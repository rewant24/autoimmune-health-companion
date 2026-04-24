import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Feature 01 Cycle 1 — daily voice check-in records.
  // Range validation for pain/energy (1–10) is enforced in the mutation
  // handler (`createCheckin`) rather than at the schema level, because
  // Convex validators don't express numeric bounds declaratively.
  checkIns: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD in IST
    createdAt: v.number(),
    pain: v.number(),
    mood: v.union(
      v.literal("heavy"),
      v.literal("flat"),
      v.literal("okay"),
      v.literal("bright"),
      v.literal("great"),
    ),
    adherenceTaken: v.boolean(),
    flare: v.boolean(),
    energy: v.number(),
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
});
