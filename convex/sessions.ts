import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";

// Helper to verify child ownership
async function verifyChildOwnership(ctx: any, childId: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const child = await ctx.db.get(childId);
  if (!child) throw new Error("Child not found");

  const family = await ctx.db.get(child.familyId);
  if (!family || family.clerkUserId !== identity.subject) {
    throw new Error("Not authorized");
  }

  return { identity, child, family };
}

export const getActive = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const child = await ctx.db.get(args.childId);
    if (!child) return null;

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) return null;

    return ctx.db
      .query("learningSessions")
      .withIndex("by_child_state", (q) =>
        q.eq("childId", args.childId).eq("state", "active")
      )
      .first();
  },
});

export const getByChild = query({
  args: {
    childId: v.id("childProfiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const child = await ctx.db.get(args.childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) return [];

    const query = ctx.db
      .query("learningSessions")
      .withIndex("by_child", (q) => q.eq("childId", args.childId))
      .order("desc");

    if (args.limit) {
      return query.take(args.limit);
    }

    return query.collect();
  },
});

export const getById = query({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const child = await ctx.db.get(session.childId);
    if (!child) return null;

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) return null;

    return session;
  },
});

export const create = mutation({
  args: {
    childId: v.id("childProfiles"),
    sessionType: v.union(
      v.literal("assessment"),
      v.literal("lesson"),
      v.literal("practice"),
      v.literal("review")
    ),
    subject: v.string(),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyChildOwnership(ctx, args.childId);

    return ctx.db.insert("learningSessions", {
      childId: args.childId,
      sessionType: args.sessionType,
      subject: args.subject,
      topic: args.topic,
      state: "not_started",
      durationMinutes: 0,
      objectives: [],
      progressMarkers: [],
      interactionCount: 0,
    });
  },
});

export const start = mutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    await ctx.db.patch(args.sessionId, {
      state: "active",
      startTime: Date.now(),
    });

    return args.sessionId;
  },
});

export const pause = mutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    await ctx.db.patch(args.sessionId, { state: "paused" });
    return args.sessionId;
  },
});

export const resume = mutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    await ctx.db.patch(args.sessionId, { state: "active" });
    return args.sessionId;
  },
});

export const startBreak = mutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    await ctx.db.patch(args.sessionId, { state: "break" });
    return args.sessionId;
  },
});

export const complete = mutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    const endTime = Date.now();
    const durationMinutes = session.startTime
      ? Math.round((endTime - session.startTime) / 60000)
      : 0;

    await ctx.db.patch(args.sessionId, {
      state: "completed",
      endTime,
      durationMinutes,
    });

    return args.sessionId;
  },
});

export const abandon = mutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    const endTime = Date.now();
    const durationMinutes = session.startTime
      ? Math.round((endTime - session.startTime) / 60000)
      : 0;

    await ctx.db.patch(args.sessionId, {
      state: "abandoned",
      endTime,
      durationMinutes,
    });

    return args.sessionId;
  },
});

export const addObjective = mutation({
  args: {
    sessionId: v.id("learningSessions"),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    const newObjective = {
      id: `obj_${Date.now()}`,
      description: args.description,
      completed: false,
    };

    await ctx.db.patch(args.sessionId, {
      objectives: [...session.objectives, newObjective],
    });

    return newObjective.id;
  },
});

export const completeObjective = mutation({
  args: {
    sessionId: v.id("learningSessions"),
    objectiveId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    const objectives = session.objectives.map((obj) =>
      obj.id === args.objectiveId
        ? { ...obj, completed: true, completedAt: Date.now() }
        : obj
    );

    await ctx.db.patch(args.sessionId, { objectives });
    return args.objectiveId;
  },
});

export const incrementInteraction = mutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await verifyChildOwnership(ctx, session.childId);

    await ctx.db.patch(args.sessionId, {
      interactionCount: session.interactionCount + 1,
    });
  },
});

// Internal functions for AI integration
export const getByIdInternal = internalQuery({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.sessionId);
  },
});

export const incrementInteractionInternal = internalMutation({
  args: { sessionId: v.id("learningSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    await ctx.db.patch(args.sessionId, {
      interactionCount: session.interactionCount + 1,
    });
  },
});
