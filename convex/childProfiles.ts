import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const family = await ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!family) return [];

    return ctx.db
      .query("childProfiles")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();
  },
});

export const getById = internalQuery({
  args: { id: v.id("childProfiles") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const get = query({
  args: { id: v.id("childProfiles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const child = await ctx.db.get(args.id);
    if (!child) return null;

    // Verify ownership
    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) return null;

    return child;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    ageGroup: v.union(
      v.literal("ages6to9"),
      v.literal("ages10to13"),
      v.literal("ages14to16")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const family = await ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!family) throw new Error("Family not found. Please complete registration first.");

    return ctx.db.insert("childProfiles", {
      familyId: family._id,
      name: args.name,
      ageGroup: args.ageGroup,
      parentalControls: {
        voiceRecordingsAllowed: true,
        cameraUploadsAllowed: true,
        aiInteractionsLogged: true,
        progressSharingEnabled: true,
        realTimeMonitoring: true,
      },
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("childProfiles"),
    name: v.optional(v.string()),
    ageGroup: v.optional(v.union(
      v.literal("ages6to9"),
      v.literal("ages10to13"),
      v.literal("ages14to16")
    )),
    learningPreferences: v.optional(v.object({
      preferredSubjects: v.array(v.string()),
      learningStyle: v.string(),
      pacePreference: v.string(),
    })),
    parentalControls: v.optional(v.object({
      voiceRecordingsAllowed: v.boolean(),
      cameraUploadsAllowed: v.boolean(),
      aiInteractionsLogged: v.boolean(),
      progressSharingEnabled: v.boolean(),
      realTimeMonitoring: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const child = await ctx.db.get(args.id);
    if (!child) throw new Error("Child profile not found");

    // Verify ownership
    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) {
      throw new Error("Not authorized");
    }

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...filteredUpdates,
      lastActive: Date.now(),
    });

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("childProfiles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const child = await ctx.db.get(args.id);
    if (!child) throw new Error("Child profile not found");

    // Verify ownership
    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.id);
  },
});
