import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

// Mood enum (scoping-verbatim: heavy | flat | okay | bright | great).
const moodValidator = v.union(
  v.literal("heavy"),
  v.literal("flat"),
  v.literal("okay"),
  v.literal("bright"),
  v.literal("great"),
);

const stageValidator = v.union(
  v.literal("open"),
  v.literal("scripted"),
  v.literal("hybrid"),
);

export const createCheckin = mutation({
  args: {
    userId: v.string(),
    date: v.string(),
    pain: v.number(),
    mood: moodValidator,
    adherenceTaken: v.boolean(),
    flare: v.boolean(),
    energy: v.number(),
    transcript: v.string(),
    stage: stageValidator,
    durationMs: v.number(),
    providerUsed: v.string(),
    clientRequestId: v.string(),
  },
  returns: v.object({ id: v.string(), date: v.string() }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.pain) || args.pain < 1 || args.pain > 10) {
      throw new ConvexError({
        code: "checkin.invalid_range",
        message: "Invalid range for pain/energy",
      });
    }
    if (!Number.isFinite(args.energy) || args.energy < 1 || args.energy > 10) {
      throw new ConvexError({
        code: "checkin.invalid_range",
        message: "Invalid range for pain/energy",
      });
    }

    // Idempotency check: look up existing row for this (userId, date).
    const existing = await ctx.db
      .query("checkIns")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (existing !== null) {
      if (existing.clientRequestId === args.clientRequestId) {
        // Same client-retry → idempotent success.
        return { id: String(existing._id), date: existing.date };
      }
      throw new ConvexError({
        code: "checkin.duplicate",
        message: "A check-in already exists for this user and date.",
      });
    }

    const id = await ctx.db.insert("checkIns", {
      userId: args.userId,
      date: args.date,
      createdAt: Date.now(),
      pain: args.pain,
      mood: args.mood,
      adherenceTaken: args.adherenceTaken,
      flare: args.flare,
      energy: args.energy,
      transcript: args.transcript,
      stage: args.stage,
      durationMs: args.durationMs,
      providerUsed: args.providerUsed,
      clientRequestId: args.clientRequestId,
    });

    return { id: String(id), date: args.date };
  },
});
