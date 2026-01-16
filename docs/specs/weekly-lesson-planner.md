# Weekly Lesson Planner Spec

> Created: 2026-01-16
> Status: Planning

## Overview

Enable parents to create weekly lesson plans for each child using IXL resources, with a guided timer interface for kids that auto-advances through tasks and sends push notifications to both parent and children's devices at each transition (including break times).

## User Stories

### Parent: Weekly Planning

As a parent, I want to plan my children's weekly lessons in one session, so that I don't have to think about scheduling every day.

**Workflow:**
1. Parent opens "Plan Week" for a specific child
2. Selects days of the week (e.g., Mon-Fri)
3. For each day, adds time blocks:
   - Subject (Math, Language Arts, etc.)
   - Resource (IXL skill/section)
   - Duration (15, 20, 30 min, etc.)
   - Break times between blocks
4. Saves the weekly plan
5. Plan repeats each week until modified

### Child: Daily Execution

As a child, I want to see exactly what I need to do right now, so that I can focus on one thing at a time without confusion.

**Workflow:**
1. Child logs in and sees "Today's Learning"
2. Current task is prominently displayed with:
   - Subject and activity name
   - Countdown timer
   - "Start" button (opens IXL in new tab)
   - "I'm Done" button
3. When timer ends or child marks complete:
   - Notification sent
   - Auto-advances to next task (or break)
4. Break times show fun "Take a Break!" screen with countdown
5. Day ends with completion celebration

### Parent: Monitoring

As a parent, I want to receive notifications when my child transitions between activities, so that I know learning is happening without hovering.

**Workflow:**
1. Parent receives push notification:
   - "Emma started Math (15 min)"
   - "Emma completed Math - Break time!"
   - "Jake hasn't started yet (10 min overdue)"
2. Can view real-time status in parent dashboard
3. End-of-day summary notification

## Spec Scope

1. **Weekly Planner UI** - Parent interface to create/edit weekly schedules per child
2. **Daily Schedule View** - Child interface showing today's tasks with guided timers
3. **Timer System** - Countdown timers with auto-advance between tasks
4. **Push Notifications** - Real-time alerts to parent and child devices
5. **IXL Integration** - Deep links to specific IXL skills/sections
6. **Break Time Management** - Scheduled breaks between learning blocks

## Out of Scope

- AI tutor integration (future phase)
- Resources beyond IXL (future phase)
- Progress tracking from IXL (no API available)
- Curriculum recommendations (parent manually selects)
- Multi-week planning (one week at a time)

## Expected Deliverables

1. Parent can create a weekly schedule for each child with subjects, durations, and breaks
2. Child sees a guided daily view with current task, timer, and "Start"/"Done" buttons
3. Timer auto-advances to next task when complete or time expires
4. Both parent and child receive push notifications at each transition
5. Parent dashboard shows real-time status of all children's progress

---

## Technical Specification

### Tech Stack (Existing)

- **Frontend:** Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend:** Convex (queries, mutations, actions)
- **Auth:** @convex-dev/auth
- **Notifications:** Web Push API + Service Worker

### New Dependencies

| Package | Purpose | Justification |
|---------|---------|---------------|
| `web-push` | Server-side push notifications | Industry standard for Web Push Protocol |
| `date-fns` | Date/time manipulation | Lightweight, tree-shakeable date library |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│  /dashboard/planner      - Parent weekly planner UI          │
│  /dashboard/today        - Child daily guided view           │
│  /dashboard/status       - Parent real-time monitoring       │
├─────────────────────────────────────────────────────────────┤
│                        Convex Backend                        │
├─────────────────────────────────────────────────────────────┤
│  weeklyPlans             - CRUD for weekly schedules         │
│  dailyProgress           - Track daily task completion       │
│  notifications           - Push notification management      │
│  pushSubscriptions       - Store device push tokens          │
├─────────────────────────────────────────────────────────────┤
│                     Service Worker                           │
├─────────────────────────────────────────────────────────────┤
│  Push event listener     - Handle incoming notifications     │
│  Background sync         - Offline support                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Convex Tables

```typescript
// convex/schema.ts additions

// Weekly schedule template
weeklyPlans: defineTable({
  childId: v.id("childProfiles"),
  familyId: v.id("families"),
  dayOfWeek: v.number(), // 0=Sunday, 1=Monday, etc.
  blocks: v.array(v.object({
    id: v.string(),
    order: v.number(),
    type: v.union(v.literal("lesson"), v.literal("break")),
    subject: v.optional(v.string()), // "Math", "Language Arts", etc.
    resource: v.optional(v.object({
      platform: v.string(), // "ixl"
      name: v.string(), // "Grade 5 Math - Section A.3"
      url: v.string(), // Deep link to IXL
    })),
    durationMinutes: v.number(),
    startTime: v.optional(v.string()), // "09:00" - optional fixed start time
  })),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_child", ["childId"])
  .index("by_child_day", ["childId", "dayOfWeek"]),

// Daily progress tracking
dailyProgress: defineTable({
  childId: v.id("childProfiles"),
  date: v.string(), // "2026-01-16"
  weeklyPlanId: v.id("weeklyPlans"),
  blocks: v.array(v.object({
    blockId: v.string(), // matches weeklyPlans.blocks[].id
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
  overallStatus: v.union(
    v.literal("not_started"),
    v.literal("in_progress"),
    v.literal("completed")
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_child_date", ["childId", "date"]),

// Push notification subscriptions
pushSubscriptions: defineTable({
  userId: v.string(), // From Convex auth
  childId: v.optional(v.id("childProfiles")), // If child device
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
  .index("by_user", ["userId"]),

// Notification log
notificationLog: defineTable({
  recipientUserId: v.string(),
  childId: v.id("childProfiles"),
  type: v.union(
    v.literal("task_started"),
    v.literal("task_completed"),
    v.literal("break_started"),
    v.literal("day_completed"),
    v.literal("overdue_reminder")
  ),
  title: v.string(),
  body: v.string(),
  sentAt: v.number(),
  delivered: v.boolean(),
})
  .index("by_recipient", ["recipientUserId"])
  .index("by_child", ["childId"]),
```

---

## UI Specifications

### Parent: Weekly Planner (`/dashboard/planner`)

```
┌─────────────────────────────────────────────────────────────┐
│  Plan Week: Emma (Age 6)                    [Save Plan]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ Sun │ │ Mon │ │ Tue │ │ Wed │ │ Thu │ │ Fri │ │ Sat │  │
│  │     │ │  ●  │ │  ●  │ │  ●  │ │  ●  │ │  ●  │ │     │  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
│                                                             │
│  MONDAY                                                     │
│  ────────────────────────────────────────────────────────  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📐 Math                                    15 min   │   │
│  │    IXL Grade 1 - Addition facts to 10               │   │
│  │    [Edit] [Remove]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☕ Break                                   10 min   │   │
│  │    [Edit] [Remove]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                         ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📖 Reading                                 20 min   │   │
│  │    IXL Grade 1 - Reading comprehension              │   │
│  │    [Edit] [Remove]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [+ Add Lesson Block]  [+ Add Break]                       │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Total learning time: 35 min + 10 min break                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Add Block Modal:**
```
┌─────────────────────────────────────────┐
│  Add Lesson Block                   [X] │
├─────────────────────────────────────────┤
│                                         │
│  Subject                                │
│  ┌─────────────────────────────────┐   │
│  │ Math                          ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  IXL Section                            │
│  ┌─────────────────────────────────┐   │
│  │ Grade 1 - Addition facts      ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Duration                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 15m │ │ 20m │ │ 30m │ │ 45m │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                         │
│            [Cancel]  [Add Block]        │
│                                         │
└─────────────────────────────────────────┘
```

### Child: Daily View (`/dashboard/today`)

**Current Task State:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Good Morning, Emma!                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │                       📐                            │   │
│  │                                                     │   │
│  │                      MATH                           │   │
│  │              Addition facts to 10                   │   │
│  │                                                     │   │
│  │                    ┌───────┐                        │   │
│  │                    │ 12:34 │                        │   │
│  │                    └───────┘                        │   │
│  │                  minutes left                       │   │
│  │                                                     │   │
│  │     ┌─────────────────────────────────────┐        │   │
│  │     │         🚀 START LESSON             │        │   │
│  │     └─────────────────────────────────────┘        │   │
│  │                                                     │   │
│  │     ┌─────────────────────────────────────┐        │   │
│  │     │           ✓ I'M DONE                │        │   │
│  │     └─────────────────────────────────────┘        │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  Today: ●○○○○  1 of 5 activities                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Break State:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     🎉 BREAK TIME! 🎉                       │
│                                                             │
│                   Great job on Math!                        │
│                                                             │
│                      ┌───────┐                              │
│                      │ 08:45 │                              │
│                      └───────┘                              │
│                                                             │
│            Stretch, get water, rest your eyes               │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  Next up: 📖 Reading                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Completion State:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🏆 ALL DONE! 🏆                          │
│                                                             │
│              Amazing work today, Emma!                      │
│                                                             │
│                 You completed 5 activities                  │
│                    in 45 minutes                            │
│                                                             │
│                        ⭐⭐⭐⭐⭐                            │
│                                                             │
│               [Tell Mom & Dad I'm Done!]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Parent: Status Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Today's Progress                           Thu, Jan 16     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Emma (6)                              ●●●○○  3/5    │   │
│  │ Currently: Break (5 min left)                       │   │
│  │ Next: Reading                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Jake (10)                             ●●●●●  Done!  │   │
│  │ Completed at 10:34 AM                               │   │
│  │ Total time: 52 minutes                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Mia (13)                              ○○○○○  0/6    │   │
│  │ Not started yet                                     │   │
│  │ [Send Reminder]                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Notification Specification

### Notification Types

| Event | To Parent | To Child |
|-------|-----------|----------|
| Task Started | "Emma started Math (15 min)" | - |
| Task Completed | "Emma completed Math!" | "Great job! Break time!" |
| Break Started | - | "Break time! 10 minutes to relax" |
| Break Ended | - | "Break's over! Time for Reading" |
| Day Completed | "Emma finished all activities!" | "You're all done! Tell your parents!" |
| Overdue (5 min) | "Emma hasn't started Math yet" | "Time to start Math!" |

### Push Notification Implementation

```typescript
// Service Worker registration (app/layout.tsx or dedicated hook)
useEffect(() => {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);

// Request permission and subscribe
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  // Save to Convex
  await savePushSubscription({ subscription: subscription.toJSON() });
}
```

---

## Convex Functions

### Weekly Plans

```typescript
// convex/weeklyPlans.ts

export const getByChild = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    // Return all 7 days for this child
  },
});

export const getByChildAndDay = query({
  args: { childId: v.id("childProfiles"), dayOfWeek: v.number() },
  handler: async (ctx, { childId, dayOfWeek }) => {
    // Return specific day's plan
  },
});

export const upsert = mutation({
  args: {
    childId: v.id("childProfiles"),
    dayOfWeek: v.number(),
    blocks: v.array(/* block schema */),
  },
  handler: async (ctx, args) => {
    // Create or update day's plan
  },
});

export const addBlock = mutation({
  args: {
    planId: v.id("weeklyPlans"),
    block: /* block schema */,
  },
  handler: async (ctx, args) => {
    // Add block to existing plan
  },
});

export const removeBlock = mutation({
  args: {
    planId: v.id("weeklyPlans"),
    blockId: v.string(),
  },
  handler: async (ctx, args) => {
    // Remove block from plan
  },
});

export const reorderBlocks = mutation({
  args: {
    planId: v.id("weeklyPlans"),
    blockIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Reorder blocks
  },
});
```

### Daily Progress

```typescript
// convex/dailyProgress.ts

export const getTodayForChild = query({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    // Get or create today's progress record
  },
});

export const startBlock = mutation({
  args: {
    progressId: v.id("dailyProgress"),
    blockId: v.string(),
  },
  handler: async (ctx, args) => {
    // Mark block as in_progress, send notification
  },
});

export const completeBlock = mutation({
  args: {
    progressId: v.id("dailyProgress"),
    blockId: v.string(),
  },
  handler: async (ctx, args) => {
    // Mark block complete, advance to next, send notifications
  },
});

export const skipBlock = mutation({
  args: {
    progressId: v.id("dailyProgress"),
    blockId: v.string(),
  },
  handler: async (ctx, args) => {
    // Skip current block (parent override)
  },
});
```

### Notifications

```typescript
// convex/notifications.ts

export const sendPush = action({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    childId: v.id("childProfiles"),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user's push subscriptions
    // Send via web-push library
    // Log notification
  },
});

export const subscribe = mutation({
  args: {
    subscription: v.object({
      endpoint: v.string(),
      keys: v.object({
        p256dh: v.string(),
        auth: v.string(),
      }),
    }),
    childId: v.optional(v.id("childProfiles")),
  },
  handler: async (ctx, args) => {
    // Save push subscription
  },
});
```

---

## Tasks

### Task 1: Database Schema & Core Functions
- [ ] 1.1 Add new tables to convex/schema.ts (weeklyPlans, dailyProgress, pushSubscriptions, notificationLog)
- [ ] 1.2 Create convex/weeklyPlans.ts with CRUD operations
- [ ] 1.3 Create convex/dailyProgress.ts with progress tracking
- [ ] 1.4 Write tests for schema and functions
- [ ] 1.5 Verify all tests pass

### Task 2: Push Notification Infrastructure
- [ ] 2.1 Install web-push dependency
- [ ] 2.2 Generate VAPID keys and add to environment
- [ ] 2.3 Create service worker (public/sw.js)
- [ ] 2.4 Create convex/notifications.ts action
- [ ] 2.5 Create useNotifications hook for subscription
- [ ] 2.6 Test push notifications end-to-end

### Task 3: Parent Weekly Planner UI
- [ ] 3.1 Create /dashboard/planner/[childId] page
- [ ] 3.2 Build DaySelector component (Sun-Sat tabs)
- [ ] 3.3 Build BlockList component (draggable blocks)
- [ ] 3.4 Build AddBlockModal component
- [ ] 3.5 Build EditBlockModal component
- [ ] 3.6 Integrate with weeklyPlans Convex functions
- [ ] 3.7 Add copy day-to-day functionality

### Task 4: Child Daily View UI
- [ ] 4.1 Create /dashboard/today page
- [ ] 4.2 Build CurrentTaskCard component with timer
- [ ] 4.3 Build BreakScreen component
- [ ] 4.4 Build CompletionScreen component
- [ ] 4.5 Build ProgressIndicator component (dots)
- [ ] 4.6 Implement timer logic with auto-advance
- [ ] 4.7 Integrate with dailyProgress Convex functions
- [ ] 4.8 Add age-appropriate styling (6 vs 10 vs 13)

### Task 5: Parent Status Dashboard
- [ ] 5.1 Create /dashboard/status page
- [ ] 5.2 Build ChildStatusCard component
- [ ] 5.3 Add real-time updates via Convex subscriptions
- [ ] 5.4 Build SendReminderButton component
- [ ] 5.5 Add daily summary view

### Task 6: Integration & Polish
- [ ] 6.1 Connect notification triggers to block transitions
- [ ] 6.2 Add notification permission request flow
- [ ] 6.3 Handle offline/reconnection gracefully
- [ ] 6.4 Add loading and error states
- [ ] 6.5 Mobile-responsive testing
- [ ] 6.6 End-to-end testing with all three children

---

## IXL Integration Strategy

### The Problem with Specific Skills

IXL's Real-Time Diagnostic provides personalized recommendations that change as children complete skills. If we hardcode specific skills in our planner:
- Recommendations become stale
- We might assign skills at the wrong level
- We lose IXL's adaptive benefit

### Solution: Work WITH IXL's Recommendations

Instead of assigning specific skills, we assign **learning sessions** that leverage IXL's built-in recommendations.

### Assignment Modes

```typescript
// lib/ixl-integration.ts

export type IXLAssignmentMode =
  | "recommendations"  // Use IXL's diagnostic recommendations
  | "strand_focus"     // Focus on a specific strand's recommendations
  | "specific_skill";  // (Fallback) Assign a specific skill

export const ixlSubjects = {
  math: {
    name: "Math",
    recommendationsUrl: "https://www.ixl.com/diagnostic/arena?subject=math",
    strands: [
      { id: "number_sense", name: "Number Sense" },
      { id: "patterns_algebra", name: "Patterns & Algebra" },
      { id: "geometry_measurement", name: "Geometry & Measurement" },
      { id: "data_statistics", name: "Data, Statistics & Probability" },
    ],
  },
  ela: {
    name: "Language Arts",
    recommendationsUrl: "https://www.ixl.com/diagnostic/arena?subject=ela",
    strands: [
      { id: "reading_strategies", name: "Reading Strategies" },
      { id: "vocabulary", name: "Vocabulary" },
      { id: "writing_strategies", name: "Writing Strategies" },
      { id: "grammar_mechanics", name: "Grammar & Mechanics" },
    ],
  },
};
```

### Block Types

```typescript
// Standard recommendation-based block (PREFERRED)
{
  type: "lesson",
  subject: "math",
  mode: "recommendations",
  durationMinutes: 15,
  url: "https://www.ixl.com/diagnostic/arena?subject=math",
  instructions: "Work on your IXL Math recommendations"
}

// Strand-focused block (when targeting weak areas)
{
  type: "lesson",
  subject: "math",
  mode: "strand_focus",
  strand: "geometry_measurement",
  durationMinutes: 15,
  url: "https://www.ixl.com/math/skill-plans/...",
  instructions: "Focus on Geometry today"
}
```

### Parent Planning UI

When adding a block, parent chooses:

```
┌─────────────────────────────────────────┐
│  Add Learning Block                 [X] │
├─────────────────────────────────────────┤
│                                         │
│  Subject                                │
│  ┌─────────────────────────────────┐   │
│  │ Math                          ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Mode                                   │
│  ○ IXL Recommendations (Recommended)   │
│    Child works on whatever IXL suggests │
│                                         │
│  ○ Focus on a strand                   │
│    ┌─────────────────────────────┐     │
│    │ Geometry & Measurement    ▼ │     │
│    └─────────────────────────────┘     │
│    Good for targeting weak areas       │
│                                         │
│  Duration                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 15m │ │ 20m │ │ 30m │ │ 45m │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                         │
│            [Cancel]  [Add Block]        │
│                                         │
└─────────────────────────────────────────┘
```

### Diagnostic Report Sync (Future Enhancement)

Allow parents to upload IXL diagnostic PDFs to:
1. Track diagnostic levels over time in the app
2. See strand-level weaknesses at a glance
3. Get suggestions for which strands need focus

```typescript
// Future: Parse uploaded diagnostic PDFs
childDiagnostics: defineTable({
  childId: v.id("childProfiles"),
  reportDate: v.string(),
  subject: v.string(),
  overallLevel: v.number(),
  strandLevels: v.array(v.object({
    strand: v.string(),
    level: v.number(),
    recommendedSkills: v.array(v.string()),
  })),
  uploadedAt: v.number(),
})
```

---

## Success Criteria

1. **Parent can plan a full week** in under 10 minutes
2. **Child sees only current task** - no overwhelm, no decisions
3. **Notifications arrive within 5 seconds** of transitions
4. **Parent can see real-time status** of all children from one screen
5. **System works on mobile** for both parent and child devices
