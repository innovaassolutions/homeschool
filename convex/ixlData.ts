import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Save IXL diagnostic data (called by Claude Code after extracting from IXL)
export const saveDiagnostic = mutation({
  args: {
    childId: v.id("childProfiles"),
    subject: v.string(),
    overallLevel: v.optional(v.number()),
    strands: v.array(v.object({
      name: v.string(),
      level: v.number(),
      gradeEquivalent: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    return ctx.db.insert("ixlDiagnostics", {
      childId: args.childId,
      subject: args.subject,
      extractedAt: Date.now(),
      overallLevel: args.overallLevel,
      strands: args.strands,
    });
  },
});

// Save IXL recommendations (called by Claude Code after extracting from IXL)
export const saveRecommendations = mutation({
  args: {
    childId: v.id("childProfiles"),
    subject: v.string(),
    recommendations: v.array(v.object({
      skillId: v.string(),
      skillName: v.string(),
      strand: v.string(),
      priority: v.number(),
      description: v.optional(v.string()),
      url: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    // Check if existing recommendations for this child/subject
    const existing = await ctx.db
      .query("ixlRecommendations")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", args.childId).eq("subject", args.subject)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        recommendations: args.recommendations,
        extractedAt: Date.now(),
        syncedToSchedule: false,
      });
      return existing._id;
    }

    // Create new
    return ctx.db.insert("ixlRecommendations", {
      childId: args.childId,
      subject: args.subject,
      extractedAt: Date.now(),
      recommendations: args.recommendations,
      syncedToSchedule: false,
    });
  },
});

// Get latest diagnostics for a child
export const getDiagnostics = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify ownership
    const child = await ctx.db.get(childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) return [];

    // Get latest diagnostic for each subject
    const mathDiag = await ctx.db
      .query("ixlDiagnostics")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", childId).eq("subject", "math")
      )
      .order("desc")
      .first();

    const elaDiag = await ctx.db
      .query("ixlDiagnostics")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", childId).eq("subject", "ela")
      )
      .order("desc")
      .first();

    return [mathDiag, elaDiag].filter(Boolean);
  },
});

// Get diagnostic history for a child (for tracking improvement)
export const getDiagnosticHistory = query({
  args: {
    childId: v.id("childProfiles"),
    subject: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) return [];

    return ctx.db
      .query("ixlDiagnostics")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", args.childId).eq("subject", args.subject)
      )
      .order("desc")
      .take(args.limit ?? 10);
  },
});

// Get current recommendations for a child
export const getRecommendations = query({
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
      .query("ixlRecommendations")
      .withIndex("by_child", (q) => q.eq("childId", childId))
      .collect();
  },
});

// Mark recommendations as synced to schedule
export const markRecommendationsSynced = mutation({
  args: {
    childId: v.id("childProfiles"),
    subject: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rec = await ctx.db
      .query("ixlRecommendations")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", args.childId).eq("subject", args.subject)
      )
      .first();

    if (rec) {
      await ctx.db.patch(rec._id, { syncedToSchedule: true });
    }
  },
});

// Apply recommendations to weekly schedule
export const applyRecommendationsToSchedule = mutation({
  args: {
    childId: v.id("childProfiles"),
    subject: v.string(),
    dayOfWeek: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) throw new Error("Not authorized");

    // Get recommendations
    const rec = await ctx.db
      .query("ixlRecommendations")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", args.childId).eq("subject", args.subject)
      )
      .first();

    if (!rec || rec.recommendations.length === 0) {
      throw new Error("No recommendations found for this subject");
    }

    // Get weekly plan for this day
    const plan = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", args.childId).eq("dayOfWeek", args.dayOfWeek)
      )
      .first();

    if (!plan) {
      throw new Error("No schedule found for this day");
    }

    // Update blocks for this subject with recommendation info
    const topRecs = rec.recommendations.slice(0, 3);
    const instructions = `IXL Recommendations:\n${topRecs
      .map((r, i) => `${i + 1}. ${r.skillName} (${r.strand})`)
      .join("\n")}`;

    const updatedBlocks = plan.blocks.map((block) => {
      if (block.subject === args.subject && block.type === "lesson") {
        return {
          ...block,
          instructions,
          resource: {
            platform: "ixl",
            name: `IXL ${args.subject === "math" ? "Math" : "Language Arts"} - ${topRecs[0]?.skillName || "Recommendations"}`,
            url: topRecs[0]?.url || `https://www.ixl.com/diagnostic/arena?subject=${args.subject}`,
          },
        };
      }
      return block;
    });

    await ctx.db.patch(plan._id, {
      blocks: updatedBlocks,
      updatedAt: Date.now(),
    });

    // Mark as synced
    await ctx.db.patch(rec._id, { syncedToSchedule: true });

    return { success: true, updatedBlocks: updatedBlocks.length };
  },
});

// Get all children's IXL status (for parent dashboard)
export const getAllChildrenIxlStatus = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const family = await ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!family) return [];

    const children = await ctx.db
      .query("childProfiles")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    const results = await Promise.all(
      children.map(async (child) => {
        const mathDiag = await ctx.db
          .query("ixlDiagnostics")
          .withIndex("by_child_subject", (q) =>
            q.eq("childId", child._id).eq("subject", "math")
          )
          .order("desc")
          .first();

        const elaDiag = await ctx.db
          .query("ixlDiagnostics")
          .withIndex("by_child_subject", (q) =>
            q.eq("childId", child._id).eq("subject", "ela")
          )
          .order("desc")
          .first();

        const mathRec = await ctx.db
          .query("ixlRecommendations")
          .withIndex("by_child_subject", (q) =>
            q.eq("childId", child._id).eq("subject", "math")
          )
          .first();

        const elaRec = await ctx.db
          .query("ixlRecommendations")
          .withIndex("by_child_subject", (q) =>
            q.eq("childId", child._id).eq("subject", "ela")
          )
          .first();

        return {
          childId: child._id,
          childName: child.name,
          avatarEmoji: child.avatarEmoji,
          ageGroup: child.ageGroup,
          math: {
            diagnosticLevel: mathDiag?.overallLevel,
            lastUpdated: mathDiag?.extractedAt,
            recommendations: mathRec?.recommendations?.length ?? 0,
            syncedToSchedule: mathRec?.syncedToSchedule ?? false,
          },
          ela: {
            diagnosticLevel: elaDiag?.overallLevel,
            lastUpdated: elaDiag?.extractedAt,
            recommendations: elaRec?.recommendations?.length ?? 0,
            syncedToSchedule: elaRec?.syncedToSchedule ?? false,
          },
        };
      })
    );

    return results;
  },
});
