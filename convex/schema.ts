import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Families - linked to Clerk user ID
  families: defineTable({
    clerkUserId: v.string(), // Clerk user ID
    name: v.string(),
    familyCode: v.string(), // Unique code for child login (e.g., "SMITH-7823")
    subscriptionTier: v.optional(v.string()),
    coppaConsentDate: v.optional(v.number()),
    coppaConsentVersion: v.optional(v.string()),
    privacySettings: v.optional(v.object({
      dataRetentionDays: v.number(),
      shareProgressWithPartners: v.boolean(),
      allowAnonymousAnalytics: v.boolean(),
    })),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_family_code", ["familyCode"]),

  // Child profiles
  childProfiles: defineTable({
    familyId: v.id("families"),
    name: v.string(),
    pin: v.string(), // 4-digit PIN for child login (stored as string)
    ageGroup: v.union(
      v.literal("ages6to9"),
      v.literal("ages10to13"),
      v.literal("ages14to16")
    ),
    avatarEmoji: v.optional(v.string()), // Fun emoji avatar for child
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

  // ============================================
  // WEEKLY LESSON PLANNER TABLES
  // ============================================

  // Weekly schedule template (one per child per day of week)
  weeklyPlans: defineTable({
    childId: v.id("childProfiles"),
    familyId: v.id("families"),
    dayOfWeek: v.number(), // 0=Sunday, 1=Monday, ... 6=Saturday
    blocks: v.array(v.object({
      id: v.string(),
      order: v.number(),
      type: v.union(v.literal("lesson"), v.literal("break")),
      subject: v.optional(v.string()), // "math", "ela", etc.
      mode: v.optional(v.union(
        v.literal("recommendations"),
        v.literal("strand_focus"),
        v.literal("specific_skill")
      )),
      strand: v.optional(v.string()), // For strand_focus mode
      resource: v.optional(v.object({
        platform: v.string(), // "ixl"
        name: v.string(), // Display name
        url: v.string(), // Link to resource
      })),
      durationMinutes: v.number(),
      instructions: v.optional(v.string()),
    })),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_child", ["childId"])
    .index("by_child_day", ["childId", "dayOfWeek"])
    .index("by_family", ["familyId"]),

  // Daily progress tracking
  dailyProgress: defineTable({
    childId: v.id("childProfiles"),
    familyId: v.id("families"),
    date: v.string(), // "2026-01-16"
    weeklyPlanId: v.optional(v.id("weeklyPlans")),
    blocks: v.array(v.object({
      blockId: v.string(), // Matches weeklyPlans.blocks[].id
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("skipped")
      ),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      actualDurationMinutes: v.optional(v.number()),
    })),
    currentBlockIndex: v.number(), // Which block is active
    overallStatus: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_child", ["childId"])
    .index("by_child_date", ["childId", "date"])
    .index("by_family_date", ["familyId", "date"]),

  // Push notification subscriptions
  pushSubscriptions: defineTable({
    recipientType: v.union(v.literal("parent"), v.literal("child")),
    clerkUserId: v.optional(v.string()), // Clerk user ID for parent
    childId: v.optional(v.id("childProfiles")), // For child
    familyId: v.id("families"),
    deviceName: v.optional(v.string()),
    subscription: v.object({
      endpoint: v.string(),
      keys: v.object({
        p256dh: v.string(),
        auth: v.string(),
      }),
    }),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_child", ["childId"])
    .index("by_family", ["familyId"]),

  // Notification log
  notificationLog: defineTable({
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
    sentAt: v.number(),
    delivered: v.boolean(),
  })
    .index("by_family", ["familyId"])
    .index("by_child", ["childId"]),

  // ============================================
  // IXL DIAGNOSTIC DATA (extracted via Claude Code)
  // ============================================

  // IXL diagnostic snapshots - stores diagnostic levels over time
  ixlDiagnostics: defineTable({
    childId: v.id("childProfiles"),
    subject: v.string(), // "math", "ela"
    extractedAt: v.number(), // Timestamp when data was extracted
    overallLevel: v.optional(v.number()), // 0-1300 overall diagnostic level
    strands: v.array(v.object({
      name: v.string(), // e.g., "Algebra", "Geometry", "Reading Comprehension"
      level: v.number(), // 0-1300 level for this strand
      gradeEquivalent: v.optional(v.string()), // e.g., "5th grade"
    })),
  })
    .index("by_child", ["childId"])
    .index("by_child_subject", ["childId", "subject"])
    .index("by_child_date", ["childId", "extractedAt"]),

  // IXL recommendations - current skills IXL recommends for each child
  ixlRecommendations: defineTable({
    childId: v.id("childProfiles"),
    subject: v.string(), // "math", "ela"
    extractedAt: v.number(),
    recommendations: v.array(v.object({
      skillId: v.string(), // IXL skill code (e.g., "L.1", "G.3")
      skillName: v.string(), // Display name
      strand: v.string(), // Category/strand
      priority: v.number(), // Order of recommendation (1 = top priority)
      description: v.optional(v.string()),
      url: v.optional(v.string()), // Direct link to skill
    })),
    syncedToSchedule: v.boolean(), // Whether these recommendations have been applied to weekly plan
  })
    .index("by_child", ["childId"])
    .index("by_child_subject", ["childId", "subject"]),
});
