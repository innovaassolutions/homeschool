import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Families (extends users from Convex Auth)
  families: defineTable({
    userId: v.id("users"),
    name: v.string(),
    subscriptionTier: v.optional(v.string()),
    coppaConsentDate: v.optional(v.number()),
    coppaConsentVersion: v.optional(v.string()),
    privacySettings: v.optional(v.object({
      dataRetentionDays: v.number(),
      shareProgressWithPartners: v.boolean(),
      allowAnonymousAnalytics: v.boolean(),
    })),
  }).index("by_user", ["userId"]),

  // Child profiles
  childProfiles: defineTable({
    familyId: v.id("families"),
    name: v.string(),
    ageGroup: v.union(
      v.literal("ages6to9"),
      v.literal("ages10to13"),
      v.literal("ages14to16")
    ),
    privacyLevel: v.optional(v.string()),
    learningPreferences: v.optional(v.object({
      preferredSubjects: v.array(v.string()),
      learningStyle: v.string(),
      pacePreference: v.string(),
    })),
    parentalControls: v.object({
      voiceRecordingsAllowed: v.boolean(),
      cameraUploadsAllowed: v.boolean(),
      aiInteractionsLogged: v.boolean(),
      progressSharingEnabled: v.boolean(),
      realTimeMonitoring: v.boolean(),
    }),
    lastActive: v.optional(v.number()),
  }).index("by_family", ["familyId"]),

  // Learning sessions
  learningSessions: defineTable({
    childId: v.id("childProfiles"),
    sessionType: v.union(
      v.literal("assessment"),
      v.literal("lesson"),
      v.literal("practice"),
      v.literal("review")
    ),
    subject: v.string(),
    topic: v.optional(v.string()),
    state: v.union(
      v.literal("not_started"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("break"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    durationMinutes: v.number(),
    objectives: v.array(v.object({
      id: v.string(),
      description: v.string(),
      completed: v.boolean(),
      completedAt: v.optional(v.number()),
    })),
    progressMarkers: v.array(v.object({
      id: v.string(),
      type: v.string(),
      description: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })),
    engagementScore: v.optional(v.number()),
    interactionCount: v.number(),
  })
    .index("by_child", ["childId"])
    .index("by_child_state", ["childId", "state"])
    .index("by_child_subject", ["childId", "subject"]),

  // Conversation messages
  conversationMessages: defineTable({
    sessionId: v.id("learningSessions"),
    childId: v.id("childProfiles"),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant")
    ),
    content: v.string(),
    timestamp: v.number(),
    tokenCount: v.optional(v.number()),
    filtered: v.boolean(),
    ageAppropriate: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_timestamp", ["sessionId", "timestamp"]),

  // Skill mastery
  skillMastery: defineTable({
    childId: v.id("childProfiles"),
    skillId: v.string(),
    skillName: v.string(),
    subject: v.string(),
    masteryLevel: v.union(
      v.literal("not_started"),
      v.literal("introduced"),
      v.literal("practicing"),
      v.literal("proficient"),
      v.literal("mastered")
    ),
    practiceCount: v.number(),
    successRate: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_child", ["childId"])
    .index("by_child_subject", ["childId", "subject"]),

  // Progress snapshots
  progressSnapshots: defineTable({
    childId: v.id("childProfiles"),
    date: v.string(),
    totalMinutes: v.number(),
    sessionsCompleted: v.number(),
    objectivesCompleted: v.number(),
    subjectBreakdown: v.array(v.object({
      subject: v.string(),
      minutes: v.number(),
      objectivesCompleted: v.number(),
    })),
  })
    .index("by_child", ["childId"])
    .index("by_child_date", ["childId", "date"]),
});
