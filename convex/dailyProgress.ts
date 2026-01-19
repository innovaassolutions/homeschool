import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper to get today's date string
function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

// Get today's progress for a child (for child view - no parent auth needed)
export const getTodayForChild = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const today = getTodayString();

    // Get or create today's progress record
    let progress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", childId).eq("date", today)
      )
      .first();

    if (progress) return progress;

    // If no progress record, return null - it will be created when child starts
    return null;
  },
});

// Get progress by date for parent view
export const getByChildAndDate = query({
  args: {
    childId: v.id("childProfiles"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) return null;

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) return null;

    return ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", args.childId).eq("date", args.date)
      )
      .first();
  },
});

// Get all children's progress for today (parent status dashboard)
export const getAllChildrenTodayProgress = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const family = await ctx.db
      .query("families")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!family) return [];

    const today = getTodayString();
    const dayOfWeek = new Date().getDay();

    // Get all children
    const children = await ctx.db
      .query("childProfiles")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    // Get all progress for this family today
    const allProgress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_family_date", (q) =>
        q.eq("familyId", family._id).eq("date", today)
      )
      .collect();

    // Build status for each child
    const results = await Promise.all(
      children.map(async (child) => {
        const progress = allProgress.find((p) => p.childId === child._id);

        // Get weekly plan to show current activity details
        const weeklyPlan = await ctx.db
          .query("weeklyPlans")
          .withIndex("by_child_day", (q) =>
            q.eq("childId", child._id).eq("dayOfWeek", dayOfWeek)
          )
          .first();

        // Get current block info
        let currentBlock = null;
        let currentBlockStatus = null;
        if (weeklyPlan && progress) {
          const planBlock = weeklyPlan.blocks[progress.currentBlockIndex];
          const progressBlock = progress.blocks[progress.currentBlockIndex];
          if (planBlock) {
            currentBlock = {
              type: planBlock.type,
              subject: planBlock.subject,
              durationMinutes: planBlock.durationMinutes,
              instructions: planBlock.instructions,
            };
            currentBlockStatus = progressBlock?.status ?? "pending";
          }
        }

        // Calculate completed count
        const completedCount = progress?.blocks.filter(
          (b) => b.status === "completed" || b.status === "skipped"
        ).length ?? 0;
        const totalBlocks = weeklyPlan?.blocks.length ?? 0;

        return {
          childId: child._id,
          childName: child.name,
          childAgeGroup: child.ageGroup,
          childAvatarEmoji: child.avatarEmoji ?? "👤",
          hasSchedule: !!weeklyPlan && weeklyPlan.blocks.length > 0,
          overallStatus: progress?.overallStatus ?? "not_started",
          currentBlockIndex: progress?.currentBlockIndex ?? 0,
          currentBlock,
          currentBlockStatus,
          completedCount,
          totalBlocks,
          startedAt: progress?.startedAt,
          completedAt: progress?.completedAt,
          lastSeen: progress?.lastSeen,
        };
      })
    );

    return results;
  },
});

// Initialize today's progress from weekly plan (called when child starts their day)
export const initializeToday = mutation({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const today = getTodayString();
    const dayOfWeek = new Date().getDay();

    // Check if progress already exists
    const existing = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", childId).eq("date", today)
      )
      .first();

    if (existing) return existing._id;

    // Get the weekly plan for today
    const weeklyPlan = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", childId).eq("dayOfWeek", dayOfWeek)
      )
      .first();

    // Get child's family ID
    const child = await ctx.db.get(childId);
    if (!child) throw new Error("Child not found");

    // Create progress record
    const blocks = (weeklyPlan?.blocks ?? []).map((block) => ({
      blockId: block.id,
      status: "pending" as const,
    }));

    return ctx.db.insert("dailyProgress", {
      childId,
      familyId: child.familyId,
      date: today,
      weeklyPlanId: weeklyPlan?._id,
      blocks,
      currentBlockIndex: 0,
      overallStatus: "not_started",
    });
  },
});

// Start a block (mark as in_progress)
export const startBlock = mutation({
  args: {
    childId: v.id("childProfiles"),
    blockId: v.string(),
  },
  handler: async (ctx, { childId, blockId }) => {
    const today = getTodayString();

    const progress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", childId).eq("date", today)
      )
      .first();

    if (!progress) throw new Error("Progress not found. Initialize first.");

    const now = Date.now();
    const blockIndex = progress.blocks.findIndex((b) => b.blockId === blockId);
    if (blockIndex === -1) throw new Error("Block not found");

    const updatedBlocks = [...progress.blocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      status: "in_progress",
      startedAt: now,
    };

    await ctx.db.patch(progress._id, {
      blocks: updatedBlocks,
      currentBlockIndex: blockIndex,
      overallStatus: "in_progress",
      startedAt: progress.startedAt ?? now,
    });

    return progress._id;
  },
});

// Complete a block
export const completeBlock = mutation({
  args: {
    childId: v.id("childProfiles"),
    blockId: v.string(),
  },
  handler: async (ctx, { childId, blockId }) => {
    const today = getTodayString();

    const progress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", childId).eq("date", today)
      )
      .first();

    if (!progress) throw new Error("Progress not found");

    const now = Date.now();
    const blockIndex = progress.blocks.findIndex((b) => b.blockId === blockId);
    if (blockIndex === -1) throw new Error("Block not found");

    const block = progress.blocks[blockIndex];
    const actualDuration = block.startedAt
      ? Math.round((now - block.startedAt) / 60000)
      : 0;

    const updatedBlocks = [...progress.blocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      status: "completed",
      completedAt: now,
      actualDurationMinutes: actualDuration,
    };

    // Check if all blocks are completed
    const allCompleted = updatedBlocks.every(
      (b) => b.status === "completed" || b.status === "skipped"
    );

    // Find next pending block
    const nextBlockIndex = updatedBlocks.findIndex(
      (b, i) => i > blockIndex && b.status === "pending"
    );

    await ctx.db.patch(progress._id, {
      blocks: updatedBlocks,
      currentBlockIndex: nextBlockIndex >= 0 ? nextBlockIndex : blockIndex,
      overallStatus: allCompleted ? "completed" : "in_progress",
      completedAt: allCompleted ? now : undefined,
    });

    return {
      progressId: progress._id,
      allCompleted,
      nextBlockIndex,
    };
  },
});

// Heartbeat - update lastSeen timestamp (called periodically from child's /today page)
export const heartbeat = mutation({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const today = getTodayString();

    const progress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", childId).eq("date", today)
      )
      .first();

    if (progress) {
      await ctx.db.patch(progress._id, {
        lastSeen: Date.now(),
      });
    }
  },
});

// Skip a block
export const skipBlock = mutation({
  args: {
    childId: v.id("childProfiles"),
    blockId: v.string(),
  },
  handler: async (ctx, { childId, blockId }) => {
    const today = getTodayString();

    const progress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", childId).eq("date", today)
      )
      .first();

    if (!progress) throw new Error("Progress not found");

    const now = Date.now();
    const blockIndex = progress.blocks.findIndex((b) => b.blockId === blockId);
    if (blockIndex === -1) throw new Error("Block not found");

    const updatedBlocks = [...progress.blocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      status: "skipped",
      completedAt: now,
    };

    // Check if all blocks are done
    const allDone = updatedBlocks.every(
      (b) => b.status === "completed" || b.status === "skipped"
    );

    // Find next pending block
    const nextBlockIndex = updatedBlocks.findIndex(
      (b, i) => i > blockIndex && b.status === "pending"
    );

    await ctx.db.patch(progress._id, {
      blocks: updatedBlocks,
      currentBlockIndex: nextBlockIndex >= 0 ? nextBlockIndex : blockIndex,
      overallStatus: allDone ? "completed" : "in_progress",
      completedAt: allDone ? now : undefined,
    });
  },
});

// Get combined view: today's plan + progress (for child daily view)
export const getTodayWithPlan = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const today = getTodayString();
    const dayOfWeek = new Date().getDay();

    // Get weekly plan for today
    const weeklyPlan = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", childId).eq("dayOfWeek", dayOfWeek)
      )
      .first();

    // Get progress for today
    const progress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", childId).eq("date", today)
      )
      .first();

    // Get child info
    const child = await ctx.db.get(childId);

    if (!weeklyPlan || !weeklyPlan.isActive) {
      return {
        hasSchedule: false,
        child: child ? {
          name: child.name,
          avatarEmoji: child.avatarEmoji,
          ageGroup: child.ageGroup,
        } : null,
        blocks: [],
        progress: null,
      };
    }

    // Combine plan blocks with progress
    const blocksWithProgress = weeklyPlan.blocks.map((planBlock) => {
      const progressBlock = progress?.blocks.find(
        (p) => p.blockId === planBlock.id
      );
      return {
        ...planBlock,
        status: progressBlock?.status ?? "pending",
        startedAt: progressBlock?.startedAt,
        completedAt: progressBlock?.completedAt,
        actualDurationMinutes: progressBlock?.actualDurationMinutes,
      };
    });

    return {
      hasSchedule: true,
      child: child ? {
        name: child.name,
        avatarEmoji: child.avatarEmoji,
        ageGroup: child.ageGroup,
      } : null,
      blocks: blocksWithProgress,
      progress: progress ? {
        _id: progress._id,
        overallStatus: progress.overallStatus,
        currentBlockIndex: progress.currentBlockIndex,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
      } : null,
      weeklyPlanId: weeklyPlan._id,
    };
  },
});
