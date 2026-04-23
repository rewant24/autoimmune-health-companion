import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Simple RFC-5322-ish check — good enough for a waitlist.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const addEmail = mutation({
  args: { email: v.string() },
  returns: v.object({
    ok: v.boolean(),
    alreadyOnList: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing !== null) {
      return { ok: true, alreadyOnList: true };
    }

    await ctx.db.insert("waitlist", {
      email,
      createdAt: Date.now(),
    });

    return { ok: true, alreadyOnList: false };
  },
});
