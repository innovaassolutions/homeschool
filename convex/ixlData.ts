import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) throw new Error("Not authorized");

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) throw new Error("Not authorized");

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Verify ownership
    const child = await ctx.db.get(childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) return [];

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) return [];

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Verify ownership
    const child = await ctx.db.get(childId);
    if (!child) return [];

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) return [];

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify ownership
    const child = await ctx.db.get(args.childId);
    if (!child) throw new Error("Child not found");

    const family = await ctx.db.get(child.familyId);
    if (!family || family.clerkUserId !== identity.subject) throw new Error("Not authorized");

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const family = await ctx.db
      .query("families")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
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

// Import recommendations from markdown file
export const importFromMarkdown = mutation({
  args: {
    markdownContent: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get family and children
    const family = await ctx.db
      .query("families")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!family) throw new Error("Family not found");

    const children = await ctx.db
      .query("childProfiles")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    if (children.length === 0) {
      throw new Error("No children found. Please add children first.");
    }

    // Create a map of child names (lowercase) to child records
    const childMap = new Map<string, typeof children[0]>();
    for (const child of children) {
      childMap.set(child.name.toLowerCase(), child);
    }

    // Parse the markdown content
    const content = args.markdownContent;
    const lines = content.split("\n");

    let currentChild: typeof children[0] | null = null;
    let currentSubject: string | null = null;
    const recommendations: Map<string, Map<string, Array<{
      skillId: string;
      skillName: string;
      strand: string;
      priority: number;
      description?: string;
    }>>> = new Map();

    let priority = 1;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for child name (## ChildName or # ChildName)
      const childMatch = trimmedLine.match(/^#{1,2}\s+(.+)$/);
      if (childMatch) {
        const potentialName = childMatch[1].trim().toLowerCase();
        // Check if this matches a child name
        for (const [name, child] of childMap) {
          if (potentialName.includes(name) || name.includes(potentialName)) {
            currentChild = child;
            currentSubject = null;
            priority = 1;
            if (!recommendations.has(child._id)) {
              recommendations.set(child._id, new Map());
            }
            break;
          }
        }
        continue;
      }

      // Check for subject (### Math, ### English, ### Language Arts, ### Science, ### ELA)
      const subjectMatch = trimmedLine.match(/^#{2,3}\s+(.+)$/);
      if (subjectMatch && currentChild) {
        const subjectName = subjectMatch[1].trim().toLowerCase();
        if (subjectName.includes("math")) {
          currentSubject = "math";
        } else if (subjectName.includes("english") || subjectName.includes("ela") || subjectName.includes("language")) {
          currentSubject = "ela";
        } else if (subjectName.includes("science")) {
          currentSubject = "science";
        } else {
          currentSubject = subjectName;
        }
        priority = 1;
        const childRecs = recommendations.get(currentChild._id);
        if (childRecs && !childRecs.has(currentSubject)) {
          childRecs.set(currentSubject, []);
        }
        continue;
      }

      // Check for recommendation item (- Skill: Description or * Skill)
      const itemMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      if (itemMatch && currentChild && currentSubject) {
        const itemText = itemMatch[1].trim();

        // Try to parse skill name and description
        // Formats: "Skill name" or "Skill name: description" or "Skill name (Grade X)"
        let skillName = itemText;
        let description: string | undefined;
        let strand = currentSubject;

        // Check for colon separator
        const colonIdx = itemText.indexOf(":");
        if (colonIdx > 0) {
          skillName = itemText.slice(0, colonIdx).trim();
          description = itemText.slice(colonIdx + 1).trim();
        }

        // Check for grade level in parentheses
        const gradeMatch = itemText.match(/\(([^)]+)\)/);
        if (gradeMatch) {
          if (!description) {
            description = gradeMatch[1];
          }
          skillName = skillName.replace(/\s*\([^)]+\)\s*/, "").trim();
        }

        // Check for strand/category in brackets
        const strandMatch = itemText.match(/\[([^\]]+)\]/);
        if (strandMatch) {
          strand = strandMatch[1];
          skillName = skillName.replace(/\s*\[[^\]]+\]\s*/, "").trim();
        }

        const childRecs = recommendations.get(currentChild._id);
        const subjectRecs = childRecs?.get(currentSubject);
        if (subjectRecs) {
          subjectRecs.push({
            skillId: `imported_${Date.now()}_${priority}`,
            skillName,
            strand,
            priority,
            description,
          });
          priority++;
        }
        continue;
      }
    }

    // Save recommendations to database
    let childrenUpdated = 0;
    for (const [childIdStr, subjects] of recommendations) {
      const childId = childIdStr as Id<"childProfiles">;
      for (const [subject, recs] of subjects) {
        if (recs.length === 0) continue;

        // Check if existing recommendations for this child/subject
        const existing = await ctx.db
          .query("ixlRecommendations")
          .withIndex("by_child_subject", (q) =>
            q.eq("childId", childId).eq("subject", subject)
          )
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, {
            recommendations: recs,
            extractedAt: Date.now(),
            syncedToSchedule: false,
          });
        } else {
          await ctx.db.insert("ixlRecommendations", {
            childId,
            subject,
            extractedAt: Date.now(),
            recommendations: recs,
            syncedToSchedule: false,
          });
        }
      }
      childrenUpdated++;
    }

    return { childrenUpdated, success: true };
  },
});

// Helper function to parse level from string like "70-130" or "90"
function parseLevel(levelStr: string): number {
  const cleanStr = levelStr.replace(/[^0-9-]/g, "");
  if (cleanStr.includes("-")) {
    const [low, high] = cleanStr.split("-").map(Number);
    return Math.round((low + high) / 2); // Return average
  }
  return parseInt(cleanStr, 10) || 0;
}

// Helper function to convert day name to day of week number
function dayNameToNumber(dayName: string): number {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return days[dayName.toLowerCase()] ?? -1;
}

// Helper function to parse time string to minutes from midnight
function parseTime(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2] || "0", 10);
  const period = match[3]?.toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Helper function to determine subject from text
function determineSubject(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("math")) return "math";
  if (lower.includes("ela") || lower.includes("reading") || lower.includes("phonics") || lower.includes("writing")) return "ela";
  if (lower.includes("science")) return "science";
  if (lower.includes("social")) return "social_studies";
  if (lower.includes("break") || lower.includes("lunch")) return undefined;
  if (lower.includes("special") || lower.includes("art") || lower.includes("music") || lower.includes("pe")) return "specials";
  return undefined;
}

// Import full schedule from markdown file (4-week lesson plan format)
export const importScheduleFromMarkdown = mutation({
  args: {
    markdownContent: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get family and children
    const family = await ctx.db
      .query("families")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!family) throw new Error("Family not found");

    const children = await ctx.db
      .query("childProfiles")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    if (children.length === 0) {
      throw new Error("No children found. Please add children first.");
    }

    // Create a map of child names (lowercase) to child records
    const childMap = new Map<string, typeof children[0]>();
    for (const child of children) {
      childMap.set(child.name.toLowerCase(), child);
    }

    const content = args.markdownContent;
    const lines = content.split("\n");

    // Parse student profile section
    let studentName = "";
    let gradeLevel = "";
    const diagnosticLevels: Array<{ name: string; level: number; subject: string }> = [];

    // Parse daily schedule template
    const dailyTemplate: Array<{
      time: string;
      duration: number;
      subject: string;
    }> = [];

    // Parse weekly lesson plans
    const weeklyPlans: Map<number, Map<number, Array<{
      time: string;
      subject: string;
      skills: string;
    }>>> = new Map(); // week -> dayOfWeek -> activities

    // Weekly goals
    const weeklyGoals: Map<number, string[]> = new Map();

    let currentSection = "";
    let currentWeek = 0;
    let currentDay = -1;
    let inTable = false;
    let tableHeaders: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect section changes
      if (trimmedLine.startsWith("## STUDENT PROFILE")) {
        currentSection = "profile";
        continue;
      }
      if (trimmedLine.startsWith("### Current IXL Diagnostic Levels")) {
        currentSection = "diagnostics";
        continue;
      }
      if (trimmedLine.startsWith("## DAILY SCHEDULE TEMPLATE")) {
        currentSection = "template";
        continue;
      }
      if (trimmedLine.match(/^## WEEK (\d+):/)) {
        const match = trimmedLine.match(/^## WEEK (\d+):/);
        currentWeek = parseInt(match![1], 10);
        currentSection = "week";
        if (!weeklyPlans.has(currentWeek)) {
          weeklyPlans.set(currentWeek, new Map());
        }
        continue;
      }
      if (trimmedLine.match(/^#### (MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/i)) {
        const match = trimmedLine.match(/^#### (\w+)/i);
        if (match) {
          currentDay = dayNameToNumber(match[1]);
          const weekPlan = weeklyPlans.get(currentWeek);
          if (weekPlan && !weekPlan.has(currentDay)) {
            weekPlan.set(currentDay, []);
          }
        }
        continue;
      }
      if (trimmedLine.startsWith("### Week") && trimmedLine.includes("Goals Checklist")) {
        currentSection = "goals";
        continue;
      }

      // Parse student name from profile table
      if (currentSection === "profile" && trimmedLine.includes("**Name**")) {
        const parts = trimmedLine.split("|");
        if (parts.length >= 3) {
          studentName = parts[2].trim();
        }
        continue;
      }

      // Parse grade level
      if (currentSection === "profile" && trimmedLine.includes("**Grade Level**")) {
        const parts = trimmedLine.split("|");
        if (parts.length >= 3) {
          gradeLevel = parts[2].trim();
        }
        continue;
      }

      // Parse diagnostic levels
      if (currentSection === "diagnostics" && trimmedLine.startsWith("- **")) {
        const match = trimmedLine.match(/\*\*([^*]+)\*\*:\s*(.+)/);
        if (match) {
          const name = match[1].trim();
          const levelStr = match[2].trim();
          const level = parseLevel(levelStr);
          // Determine if it's math or ELA
          const isMath = name.toLowerCase().includes("math") ||
            name.toLowerCase().includes("geometry") ||
            name.toLowerCase().includes("number") ||
            name.toLowerCase().includes("algebra") ||
            name.toLowerCase().includes("data") ||
            name.toLowerCase().includes("patterns") ||
            name.toLowerCase().includes("statistics");
          const isEla = name.toLowerCase().includes("ela") ||
            name.toLowerCase().includes("reading") ||
            name.toLowerCase().includes("vocabulary");
          diagnosticLevels.push({
            name,
            level,
            subject: isMath ? "math" : isEla ? "ela" : "other",
          });
        }
        continue;
      }

      // Parse daily template table
      if (currentSection === "template" && trimmedLine.startsWith("|")) {
        if (trimmedLine.includes("Time") || trimmedLine.includes("---")) {
          continue; // Skip header rows
        }
        const parts = trimmedLine.split("|").map(p => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          const timeRange = parts[0];
          const durationStr = parts[1];
          const subject = parts[2];
          // Parse duration (e.g., "45 min")
          const durMatch = durationStr.match(/(\d+)\s*min/);
          const duration = durMatch ? parseInt(durMatch[1], 10) : 30;
          dailyTemplate.push({ time: timeRange, duration, subject });
        }
        continue;
      }

      // Parse weekly lesson plans (tables)
      if (currentSection === "week" && currentDay >= 0 && trimmedLine.startsWith("|")) {
        // Detect if this is a table header or separator
        if (trimmedLine.includes("Time") && trimmedLine.includes("Subject")) {
          tableHeaders = trimmedLine.split("|").map(h => h.trim()).filter(Boolean);
          inTable = true;
          continue;
        }
        if (trimmedLine.match(/^\|[\s-|]+\|$/)) {
          continue; // Skip separator row
        }
        if (inTable) {
          const parts = trimmedLine.split("|").map(p => p.trim()).filter(Boolean);
          if (parts.length >= 3) {
            const time = parts[0];
            const subject = parts[1];
            const skills = parts[2];
            const weekPlan = weeklyPlans.get(currentWeek);
            const dayPlan = weekPlan?.get(currentDay);
            if (dayPlan) {
              dayPlan.push({ time, subject, skills });
            }
          }
        }
        continue;
      }

      // Parse weekly goals
      if (currentSection === "goals" && trimmedLine.startsWith("- [")) {
        const goalMatch = trimmedLine.match(/\- \[.\]\s*(.+)/);
        if (goalMatch) {
          if (!weeklyGoals.has(currentWeek)) {
            weeklyGoals.set(currentWeek, []);
          }
          weeklyGoals.get(currentWeek)?.push(goalMatch[1].trim());
        }
        continue;
      }
    }

    // Match student to existing child
    const matchedChild = childMap.get(studentName.toLowerCase());
    if (!matchedChild) {
      return {
        success: false,
        error: `Child "${studentName}" not found. Available children: ${Array.from(childMap.keys()).join(", ")}`,
        childrenUpdated: 0,
        diagnosticsCreated: 0,
        weeklyPlansCreated: 0,
      };
    }

    // Store diagnostic levels
    let diagnosticsCreated = 0;
    const mathStrands: Array<{ name: string; level: number; gradeEquivalent?: string }> = [];
    const elaStrands: Array<{ name: string; level: number; gradeEquivalent?: string }> = [];
    let mathOverall: number | undefined;
    let elaOverall: number | undefined;

    for (const diag of diagnosticLevels) {
      if (diag.subject === "math") {
        if (diag.name.toLowerCase().includes("overall")) {
          mathOverall = diag.level;
        } else {
          mathStrands.push({ name: diag.name, level: diag.level, gradeEquivalent: gradeLevel });
        }
      } else if (diag.subject === "ela") {
        if (diag.name.toLowerCase().includes("overall")) {
          elaOverall = diag.level;
        } else {
          elaStrands.push({ name: diag.name, level: diag.level, gradeEquivalent: gradeLevel });
        }
      }
    }

    // Save math diagnostics
    if (mathStrands.length > 0 || mathOverall !== undefined) {
      await ctx.db.insert("ixlDiagnostics", {
        childId: matchedChild._id,
        subject: "math",
        extractedAt: Date.now(),
        overallLevel: mathOverall,
        strands: mathStrands,
      });
      diagnosticsCreated++;
    }

    // Save ELA diagnostics
    if (elaStrands.length > 0 || elaOverall !== undefined) {
      await ctx.db.insert("ixlDiagnostics", {
        childId: matchedChild._id,
        subject: "ela",
        extractedAt: Date.now(),
        overallLevel: elaOverall,
        strands: elaStrands,
      });
      diagnosticsCreated++;
    }

    // Create weekly plans
    let weeklyPlansCreated = 0;
    const now = Date.now();

    // Process each week's plan
    for (const [week, dayPlans] of weeklyPlans) {
      for (const [dayOfWeek, activities] of dayPlans) {
        if (activities.length === 0) continue;

        // Build blocks from activities
        const blocks: Array<{
          id: string;
          order: number;
          type: "lesson" | "break";
          subject?: string;
          durationMinutes: number;
          instructions?: string;
          resource?: {
            platform: string;
            name: string;
            url: string;
          };
        }> = [];

        let order = 0;
        for (const activity of activities) {
          const subject = determineSubject(activity.subject);
          const isBreak = activity.subject.toLowerCase().includes("break") ||
            activity.subject.toLowerCase().includes("lunch");

          // Parse time to estimate duration
          let duration = 30; // default
          const templateEntry = dailyTemplate.find(t =>
            t.time.startsWith(activity.time.split("-")[0])
          );
          if (templateEntry) {
            duration = templateEntry.duration;
          }

          blocks.push({
            id: `week${week}_day${dayOfWeek}_${order}`,
            order: order++,
            type: isBreak ? "break" : "lesson",
            subject: subject || undefined,
            durationMinutes: duration,
            instructions: activity.skills,
            resource: subject && !isBreak ? {
              platform: "ixl",
              name: activity.skills.split("/")[0].trim(),
              url: `https://www.ixl.com/${subject === "ela" ? "ela" : "math"}`,
            } : undefined,
          });
        }

        // Check for existing weekly plan for this child/day
        const existing = await ctx.db
          .query("weeklyPlans")
          .withIndex("by_child_day", (q) =>
            q.eq("childId", matchedChild._id).eq("dayOfWeek", dayOfWeek)
          )
          .first();

        if (existing) {
          // Update existing plan
          await ctx.db.patch(existing._id, {
            blocks,
            updatedAt: now,
          });
        } else {
          // Create new plan
          await ctx.db.insert("weeklyPlans", {
            childId: matchedChild._id,
            familyId: family._id,
            dayOfWeek,
            blocks,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
        }
        weeklyPlansCreated++;
      }
    }

    // Store recommendations from weekly plans (extract IXL skills)
    const mathRecommendations: Array<{
      skillId: string;
      skillName: string;
      strand: string;
      priority: number;
      description?: string;
    }> = [];
    const elaRecommendations: Array<{
      skillId: string;
      skillName: string;
      strand: string;
      priority: number;
      description?: string;
    }> = [];

    let mathPriority = 1;
    let elaPriority = 1;

    for (const [, dayPlans] of weeklyPlans) {
      for (const [, activities] of dayPlans) {
        for (const activity of activities) {
          const subject = determineSubject(activity.subject);
          if (!subject || subject === "specials" || subject === "social_studies") continue;

          // Parse skills from the activity
          const skillParts = activity.skills.split("/").map(s => s.trim().replace(/^"|"$/g, ""));
          for (const skill of skillParts) {
            if (skill.length < 3) continue; // Skip very short entries

            if (subject === "math") {
              // Avoid duplicates
              if (!mathRecommendations.find(r => r.skillName === skill)) {
                mathRecommendations.push({
                  skillId: `imported_math_${mathPriority}`,
                  skillName: skill,
                  strand: "math",
                  priority: mathPriority++,
                });
              }
            } else if (subject === "ela") {
              if (!elaRecommendations.find(r => r.skillName === skill)) {
                elaRecommendations.push({
                  skillId: `imported_ela_${elaPriority}`,
                  skillName: skill,
                  strand: "ela",
                  priority: elaPriority++,
                });
              }
            }
          }
        }
      }
    }

    // Save math recommendations
    if (mathRecommendations.length > 0) {
      const existingMath = await ctx.db
        .query("ixlRecommendations")
        .withIndex("by_child_subject", (q) =>
          q.eq("childId", matchedChild._id).eq("subject", "math")
        )
        .first();

      if (existingMath) {
        await ctx.db.patch(existingMath._id, {
          recommendations: mathRecommendations,
          extractedAt: now,
          syncedToSchedule: true,
        });
      } else {
        await ctx.db.insert("ixlRecommendations", {
          childId: matchedChild._id,
          subject: "math",
          extractedAt: now,
          recommendations: mathRecommendations,
          syncedToSchedule: true,
        });
      }
    }

    // Save ELA recommendations
    if (elaRecommendations.length > 0) {
      const existingEla = await ctx.db
        .query("ixlRecommendations")
        .withIndex("by_child_subject", (q) =>
          q.eq("childId", matchedChild._id).eq("subject", "ela")
        )
        .first();

      if (existingEla) {
        await ctx.db.patch(existingEla._id, {
          recommendations: elaRecommendations,
          extractedAt: now,
          syncedToSchedule: true,
        });
      } else {
        await ctx.db.insert("ixlRecommendations", {
          childId: matchedChild._id,
          subject: "ela",
          extractedAt: now,
          recommendations: elaRecommendations,
          syncedToSchedule: true,
        });
      }
    }

    return {
      success: true,
      childName: studentName,
      childId: matchedChild._id,
      gradeLevel,
      diagnosticsCreated,
      weeklyPlansCreated,
      mathSkillsImported: mathRecommendations.length,
      elaSkillsImported: elaRecommendations.length,
    };
  },
});
