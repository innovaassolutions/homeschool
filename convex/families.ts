import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Generate a unique family code (e.g., "SMITH-7823")
function generateFamilyCode(familyName: string): string {
  const prefix = familyName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6)
    .padEnd(4, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

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

// Look up family by family code (for child login)
export const getByFamilyCode = query({
  args: { familyCode: v.string() },
  handler: async (ctx, args) => {
    const family = await ctx.db
      .query("families")
      .withIndex("by_family_code", (q) => q.eq("familyCode", args.familyCode.toUpperCase()))
      .first();

    if (!family) return null;

    // Return limited info for child login screen
    return {
      _id: family._id,
      name: family.name,
    };
  },
});

// Get children for a family by family code (for child login)
export const getChildrenByFamilyCode = query({
  args: { familyCode: v.string() },
  handler: async (ctx, args) => {
    const family = await ctx.db
      .query("families")
      .withIndex("by_family_code", (q) => q.eq("familyCode", args.familyCode.toUpperCase()))
      .first();

    if (!family) return [];

    const children = await ctx.db
      .query("childProfiles")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    // Return limited info for login screen (no PIN!)
    return children.map((c) => ({
      _id: c._id,
      name: c.name,
      ageGroup: c.ageGroup,
      avatarEmoji: c.avatarEmoji || "👤",
    }));
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

    // Generate unique family code
    let familyCode = generateFamilyCode(args.name);
    let attempts = 0;
    while (attempts < 10) {
      const existingCode = await ctx.db
        .query("families")
        .withIndex("by_family_code", (q) => q.eq("familyCode", familyCode))
        .first();
      if (!existingCode) break;
      familyCode = generateFamilyCode(args.name);
      attempts++;
    }

    return ctx.db.insert("families", {
      userId,
      name: args.name,
      familyCode,
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
