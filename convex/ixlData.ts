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
