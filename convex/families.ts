import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const get = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    coppaConsent: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if family already exists
    const existing = await ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing._id;
    }

    return ctx.db.insert("families", {
      userId,
      name: args.name,
      subscriptionTier: "free",
      coppaConsentDate: args.coppaConsent ? Date.now() : undefined,
      coppaConsentVersion: args.coppaConsent ? "1.0" : undefined,
    });
  },
});

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    privacySettings: v.optional(v.object({
      dataRetentionDays: v.number(),
      shareProgressWithPartners: v.boolean(),
      allowAnonymousAnalytics: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const family = await ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!family) throw new Error("Family not found");

    const updates: Record<string, unknown> = {};
    if (args.name) updates.name = args.name;
    if (args.privacySettings) updates.privacySettings = args.privacySettings;

    await ctx.db.patch(family._id, updates);
    return family._id;
  },
});
