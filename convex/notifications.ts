import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Subscribe to push notifications (parent)
export const subscribeParent = mutation({
  args: {
    subscription: v.object({
      endpoint: v.string(),
      keys: v.object({
        p256dh: v.string(),
        auth: v.string(),
      }),
    }),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const family = await ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!family) throw new Error("Family not found");

    // Check if this endpoint is already subscribed
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingSub = existing.find(
      (s) => s.subscription.endpoint === args.subscription.endpoint
    );

    if (existingSub) {
      // Update existing subscription
      await ctx.db.patch(existingSub._id, {
        subscription: args.subscription,
        isActive: true,
        deviceName: args.deviceName,
      });
      return existingSub._id;
    }

    // Create new subscription
    return ctx.db.insert("pushSubscriptions", {
      recipientType: "parent",
      userId,
      familyId: family._id,
      subscription: args.subscription,
      deviceName: args.deviceName,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

// Subscribe to push notifications (child)
export const subscribeChild = mutation({
  args: {
    childId: v.id("childProfiles"),
    subscription: v.object({
      endpoint: v.string(),
      keys: v.object({
        p256dh: v.string(),
        auth: v.string(),
      }),
    }),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    // Check if this endpoint is already subscribed
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_child", (q) => q.eq("childId", args.childId))
      .collect();

    const existingSub = existing.find(
      (s) => s.subscription.endpoint === args.subscription.endpoint
    );

    if (existingSub) {
      // Update existing subscription
      await ctx.db.patch(existingSub._id, {
        subscription: args.subscription,
        isActive: true,
        deviceName: args.deviceName,
      });
      return existingSub._id;
    }

    // Create new subscription
    return ctx.db.insert("pushSubscriptions", {
      recipientType: "child",
      childId: args.childId,
      familyId: child.familyId,
      subscription: args.subscription,
      deviceName: args.deviceName,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

// Unsubscribe from push notifications
export const unsubscribe = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    // Find and deactivate the subscription
    const subs = await ctx.db
      .query("pushSubscriptions")
      .collect();

    const sub = subs.find((s) => s.subscription.endpoint === args.endpoint);

    if (sub) {
      await ctx.db.patch(sub._id, { isActive: false });
    }
  },
});

// Get parent's subscriptions
export const getParentSubscriptions = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get child's subscriptions
export const getChildSubscriptions = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    return ctx.db
      .query("pushSubscriptions")
      .withIndex("by_child", (q) => q.eq("childId", childId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Log notification (internal)
export const logNotification = internalMutation({
  args: {
    familyId: v.id("families"),
    childId: v.id("childProfiles"),
    recipientType: v.union(v.literal("parent"), v.literal("child")),
    type: v.union(
      v.literal("task_started"),
      v.literal("task_completed"),
      v.literal("break_started"),
      v.literal("break_ended"),
      v.literal("day_completed"),
      v.literal("overdue_reminder")
    ),
    title: v.string(),
    body: v.string(),
    delivered: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationLog", {
      ...args,
      sentAt: Date.now(),
    });
  },
});

// Get subscriptions for a family (for sending notifications)
export const getFamilySubscriptions = query({
  args: { familyId: v.id("families") },
  handler: async (ctx, { familyId }) => {
    return ctx.db
      .query("pushSubscriptions")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Trigger notification for task events (called from dailyProgress mutations)
export const triggerTaskNotification = action({
  args: {
    familyId: v.id("families"),
    childId: v.id("childProfiles"),
    childName: v.string(),
    eventType: v.union(
      v.literal("task_started"),
      v.literal("task_completed"),
      v.literal("break_started"),
      v.literal("break_ended"),
      v.literal("day_completed")
    ),
    taskName: v.string(),
    nextTaskName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get notification content based on event type
    let title = "";
    let body = "";

    switch (args.eventType) {
      case "task_started":
        title = `${args.childName} started learning`;
        body = `Now working on: ${args.taskName}`;
        break;
      case "task_completed":
        title = `${args.childName} finished ${args.taskName}!`;
        body = args.nextTaskName ? `Next up: ${args.nextTaskName}` : "Great work!";
        break;
      case "break_started":
        title = `Break time for ${args.childName}`;
        body = `Taking a well-deserved break`;
        break;
      case "break_ended":
        title = `Break's over for ${args.childName}`;
        body = args.nextTaskName ? `Time to start: ${args.nextTaskName}` : "Time to get back to learning";
        break;
      case "day_completed":
        title = `${args.childName} finished for today!`;
        body = `All activities completed`;
        break;
    }

    // Log the notification for parent
    await ctx.runMutation(internal.notifications.logNotification, {
      familyId: args.familyId,
      childId: args.childId,
      recipientType: "parent",
      type: args.eventType,
      title,
      body,
      delivered: true, // Will be updated based on actual delivery
    });

    // Log for child (different message for child)
    if (args.eventType === "break_ended") {
      await ctx.runMutation(internal.notifications.logNotification, {
        familyId: args.familyId,
        childId: args.childId,
        recipientType: "child",
        type: args.eventType,
        title: "Break's over!",
        body: args.nextTaskName ? `Time for ${args.nextTaskName}` : "Time to get back to learning",
        delivered: true,
      });
    }

    // Return notification details for frontend to send via Web Push
    return { title, body, eventType: args.eventType };
  },
});

// Get recent notifications for a family
export const getRecentNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const family = await ctx.db
      .query("families")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!family) return [];

    const notifications = await ctx.db
      .query("notificationLog")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .order("desc")
      .take(args.limit ?? 20);

    // Get child names
    const childIds = [...new Set(notifications.map((n) => n.childId))];
    const children = await Promise.all(childIds.map((id) => ctx.db.get(id)));
    const childMap = new Map(children.map((c) => [c?._id, c?.name]));

    return notifications.map((n) => ({
      ...n,
      childName: childMap.get(n.childId) ?? "Unknown",
    }));
  },
});
