import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getHistory = internalQuery({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("conversationMessages")
      .withIndex("by_session_timestamp", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const getBySession = query({
  args: {
    sessionId: v.id("learningSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session) return [];

    const child = await ctx.db.get(session.childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) return [];

    const query = ctx.db
      .query("conversationMessages")
      .withIndex("by_session_timestamp", (q) => q.eq("sessionId", args.sessionId))
      .order("asc");

    if (args.limit) {
      return query.take(args.limit);
    }

    return query.collect();
  },
});

export const addMessage = internalMutation({
  args: {
    sessionId: v.id("learningSessions"),
    childId: v.id("childProfiles"),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant")
    ),
    content: v.string(),
    tokenCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("conversationMessages", {
      sessionId: args.sessionId,
      childId: args.childId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      tokenCount: args.tokenCount,
      filtered: false,
      ageAppropriate: true,
    });
  },
});

export const send = mutation({
  args: {
    sessionId: v.id("learningSessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify session ownership
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const child = await ctx.db.get(session.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.userId !== userId) {
      throw new Error("Not authorized");
    }

    // Add the user message
    return ctx.db.insert("conversationMessages", {
      sessionId: args.sessionId,
      childId: session.childId,
      role: "user",
      content: args.content,
      timestamp: Date.now(),
      filtered: false,
      ageAppropriate: true,
    });
  },
});
