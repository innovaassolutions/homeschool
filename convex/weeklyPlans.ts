import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// Block type definition for validation
const blockValidator = v.object({
  id: v.string(),
  order: v.number(),
  type: v.union(v.literal("lesson"), v.literal("break")),
  subject: v.optional(v.string()),
  mode: v.optional(v.union(
    v.literal("recommendations"),
    v.literal("strand_focus"),
    v.literal("specific_skill")
  )),
  strand: v.optional(v.string()),
  resource: v.optional(v.object({
    platform: v.string(),
    name: v.string(),
    url: v.string(),
  })),
  durationMinutes: v.number(),
  instructions: v.optional(v.string()),
});

// Get all weekly plans for a child (returns 7 days)
export const getByChild = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify ownership
    const child = await ctx.db.get(childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) return [];

    return ctx.db
      .query("weeklyPlans")
      .withIndex("by_child", (q) => q.eq("childId", childId))
      .collect();
  },
});

// Get plan for specific day
export const getByChildAndDay = query({
  args: {
    childId: v.id("childProfiles"),
    dayOfWeek: v.number(),
  },
  handler: async (ctx, { childId, dayOfWeek }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Verify ownership
    const child = await ctx.db.get(childId);
    if (!child) return null;

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) return null;

    return ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", childId).eq("dayOfWeek", dayOfWeek)
      )
      .first();
  },
});

// Get plan for child's today (no auth - for child login)
export const getTodayForChild = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.

    return ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", childId).eq("dayOfWeek", today)
      )
      .first();
  },
});

// Create or update a day's plan
export const upsert = mutation({
  args: {
    childId: v.id("childProfiles"),
    dayOfWeek: v.number(),
    blocks: v.array(blockValidator),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    // Check if plan already exists for this day
    const existing = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", args.childId).eq("dayOfWeek", args.dayOfWeek)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing plan
      await ctx.db.patch(existing._id, {
        blocks: args.blocks,
        isActive: args.isActive ?? existing.isActive,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new plan
      return ctx.db.insert("weeklyPlans", {
        childId: args.childId,
        familyId: child.familyId,
        dayOfWeek: args.dayOfWeek,
        blocks: args.blocks,
        isActive: args.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Add a single block to a day's plan
export const addBlock = mutation({
  args: {
    childId: v.id("childProfiles"),
    dayOfWeek: v.number(),
    block: blockValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    // Get existing plan
    let plan = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", args.childId).eq("dayOfWeek", args.dayOfWeek)
      )
      .first();

    const now = Date.now();

    if (plan) {
      // Add block to existing plan
      const newBlocks = [...plan.blocks, args.block];
      await ctx.db.patch(plan._id, {
        blocks: newBlocks,
        updatedAt: now,
      });
      return plan._id;
    } else {
      // Create new plan with this block
      return ctx.db.insert("weeklyPlans", {
        childId: args.childId,
        familyId: child.familyId,
        dayOfWeek: args.dayOfWeek,
        blocks: [args.block],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Remove a block from a day's plan
export const removeBlock = mutation({
  args: {
    planId: v.id("weeklyPlans"),
    blockId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found");

    // Verify ownership
    const child = await ctx.db.get(plan.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    const newBlocks = plan.blocks.filter((b) => b.id !== args.blockId);
    await ctx.db.patch(args.planId, {
      blocks: newBlocks,
      updatedAt: Date.now(),
    });
  },
});

// Reorder blocks within a plan
export const reorderBlocks = mutation({
  args: {
    planId: v.id("weeklyPlans"),
    blockIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found");

    // Verify ownership
    const child = await ctx.db.get(plan.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    // Reorder blocks based on blockIds array
    const blockMap = new Map(plan.blocks.map((b) => [b.id, b]));
    const reorderedBlocks = args.blockIds
      .map((id, index) => {
        const block = blockMap.get(id);
        return block ? { ...block, order: index } : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    await ctx.db.patch(args.planId, {
      blocks: reorderedBlocks,
      updatedAt: Date.now(),
    });
  },
});

// Copy a day's plan to another day
export const copyDay = mutation({
  args: {
    childId: v.id("childProfiles"),
    fromDayOfWeek: v.number(),
    toDayOfWeek: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    // Get source plan
    const sourcePlan = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", args.childId).eq("dayOfWeek", args.fromDayOfWeek)
      )
      .first();

    if (!sourcePlan) throw new Error("Source day has no plan");

    const now = Date.now();

    // Check if destination already has a plan
    const destPlan = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", args.childId).eq("dayOfWeek", args.toDayOfWeek)
      )
      .first();

    // Generate new IDs for copied blocks
    const copiedBlocks = sourcePlan.blocks.map((block) => ({
      ...block,
      id: `${block.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }));

    if (destPlan) {
      await ctx.db.patch(destPlan._id, {
        blocks: copiedBlocks,
        updatedAt: now,
      });
      return destPlan._id;
    } else {
      return ctx.db.insert("weeklyPlans", {
        childId: args.childId,
        familyId: child.familyId,
        dayOfWeek: args.toDayOfWeek,
        blocks: copiedBlocks,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
