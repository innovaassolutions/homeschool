/**
 * Daily AI Lesson Plan Generator
 *
 * Runs every weekday morning via Convex cron.
 * For each child, it reads their current IXL diagnostic data and
 * recommendations, then uses OpenAI to fill in specific skills and
 * instructions for each lesson block in their weekly schedule.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const GRADE_BY_AGE_GROUP: Record<string, string> = {
  ages6to9: "Grade 1-3",
  ages10to13: "Grade 4-7",
  ages14to16: "Grade 8-10",
};

// ---------------------------------------------------------------------------
// Internal query — gather all planning data for one child
// ---------------------------------------------------------------------------

export const getChildPlanningData = internalQuery({
  args: { childId: v.id("childProfiles") },
  handler: async (ctx, { childId }) => {
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();

    const child = await ctx.db.get(childId);
    if (!child) return null;

    // Weekly plan template for today's day of week
    const weeklyPlan = await ctx.db
      .query("weeklyPlans")
      .withIndex("by_child_day", (q) =>
        q.eq("childId", childId).eq("dayOfWeek", dayOfWeek)
      )
      .first();

    // Latest IXL diagnostics
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

    // Current recommendations
    const mathRec = await ctx.db
      .query("ixlRecommendations")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", childId).eq("subject", "math")
      )
      .first();

    const elaRec = await ctx.db
      .query("ixlRecommendations")
      .withIndex("by_child_subject", (q) =>
        q.eq("childId", childId).eq("subject", "ela")
      )
      .first();

    // Recent daily progress (last 5 school days, excluding today)
    const recentProgress = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child", (q) => q.eq("childId", childId))
      .order("desc")
      .take(6);

    return {
      child,
      weeklyPlan,
      mathDiag,
      elaDiag,
      mathRec,
      elaRec,
      recentProgress: recentProgress.filter((p) => p.date !== today),
      today,
      dayOfWeek,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal mutation — save the LLM-generated plan into weeklyPlans
// ---------------------------------------------------------------------------

export const savePlanForChild = internalMutation({
  args: {
    childId: v.id("childProfiles"),
    weeklyPlanId: v.id("weeklyPlans"),
    updatedBlocks: v.array(
      v.object({
        id: v.string(),
        order: v.number(),
        type: v.union(v.literal("lesson"), v.literal("break")),
        subject: v.optional(v.string()),
        mode: v.optional(
          v.union(
            v.literal("recommendations"),
            v.literal("strand_focus"),
            v.literal("specific_skill")
          )
        ),
        strand: v.optional(v.string()),
        resource: v.optional(
          v.object({ platform: v.string(), name: v.string(), url: v.string() })
        ),
        durationMinutes: v.number(),
        instructions: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    // Update the weekly plan blocks with LLM-generated content
    await ctx.db.patch(args.weeklyPlanId, {
      blocks: args.updatedBlocks,
      updatedAt: Date.now(),
    });

    // Pre-create today's dailyProgress so the child sees a ready schedule
    const existing = await ctx.db
      .query("dailyProgress")
      .withIndex("by_child_date", (q) =>
        q.eq("childId", args.childId).eq("date", today)
      )
      .first();

    if (!existing) {
      const child = await ctx.db.get(args.childId);
      if (!child) return;

      await ctx.db.insert("dailyProgress", {
        childId: args.childId,
        familyId: child.familyId,
        date: today,
        weeklyPlanId: args.weeklyPlanId,
        blocks: args.updatedBlocks.map((b) => ({
          blockId: b.id,
          status: "pending" as const,
        })),
        currentBlockIndex: 0,
        overallStatus: "not_started",
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPrompt(data: NonNullable<any>): string {
  const { child, weeklyPlan, mathDiag, elaDiag, mathRec, elaRec, dayOfWeek } = data;
  const dayName = DAY_NAMES[dayOfWeek];
  const grade = GRADE_BY_AGE_GROUP[child.ageGroup] ?? "Unknown grade";

  const lines: string[] = [];

  lines.push(`Today is ${dayName}.`);
  lines.push(`CHILD: ${child.name}, ${grade}`);
  lines.push("");

  // Math diagnostics
  if (mathDiag) {
    lines.push("IXL MATH DIAGNOSTIC:");
    if (mathDiag.overallLevel) lines.push(`  Overall: ${mathDiag.overallLevel}`);
    for (const s of mathDiag.strands) {
      lines.push(`  ${s.name}: ${s.level}`);
    }
  }

  // Math recommendations
  if (mathRec?.recommendations?.length) {
    lines.push("");
    lines.push("TOP MATH SKILLS TO PRACTISE (in priority order):");
    for (const r of mathRec.recommendations.slice(0, 6)) {
      const url = r.url ? ` — ${r.url}` : "";
      lines.push(`  ${r.priority}. ${r.skillName} [${r.skillId}] (${r.strand})${url}`);
    }
  }

  lines.push("");

  // ELA diagnostics
  if (elaDiag) {
    lines.push("IXL ELA DIAGNOSTIC:");
    if (elaDiag.overallLevel) lines.push(`  Overall: ${elaDiag.overallLevel}`);
    for (const s of elaDiag.strands) {
      lines.push(`  ${s.name}: ${s.level}`);
    }
  }

  // ELA recommendations
  if (elaRec?.recommendations?.length) {
    lines.push("");
    lines.push("TOP ELA SKILLS TO PRACTISE (in priority order):");
    for (const r of elaRec.recommendations.slice(0, 6)) {
      const url = r.url ? ` — ${r.url}` : "";
      lines.push(`  ${r.priority}. ${r.skillName} [${r.skillId}] (${r.strand})${url}`);
    }
  }

  lines.push("");

  // Today's schedule blocks
  if (weeklyPlan) {
    lines.push("TODAY'S SCHEDULE BLOCKS (fill in the lesson ones):");
    for (const b of weeklyPlan.blocks) {
      const label = b.type === "break"
        ? `[${b.id}] BREAK (${b.durationMinutes} min) — skip this one`
        : `[${b.id}] LESSON — subject: ${b.subject ?? "general"}, ${b.durationMinutes} min`;
      lines.push(`  ${label}`);
    }
  }

  lines.push("");
  lines.push("Return a JSON object with this shape:");
  lines.push(`{
  "blocks": [
    {
      "id": "<block id from above>",
      "instructions": "<2-3 sentences: what to do, what skill to focus on, any tips>",
      "resource": {
        "platform": "ixl",
        "name": "<IXL skill name>",
        "url": "<direct IXL skill URL if available, otherwise the subject page>"
      }
    }
  ]
}`);
  lines.push("Only include lesson blocks (skip break blocks). Use the IXL skill URLs provided above where possible.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Merge LLM output back into the existing blocks array
// ---------------------------------------------------------------------------

function mergeLlmIntoBlocks(
  existingBlocks: Array<{
    id: string;
    order: number;
    type: "lesson" | "break";
    subject?: string;
    mode?: "recommendations" | "strand_focus" | "specific_skill";
    strand?: string;
    resource?: { platform: string; name: string; url: string };
    durationMinutes: number;
    instructions?: string;
  }>,
  llmBlocks: Array<{
    id: string;
    instructions?: string;
    resource?: { platform: string; name: string; url: string };
  }>
) {
  const llmMap = new Map(llmBlocks.map((b) => [b.id, b]));

  return existingBlocks.map((block) => {
    const llm = llmMap.get(block.id);
    if (!llm || block.type === "break") return block;

    return {
      ...block,
      instructions: llm.instructions ?? block.instructions,
      resource: llm.resource ?? block.resource,
      mode: "specific_skill" as const,
    };
  });
}

// ---------------------------------------------------------------------------
// Main action — called by the cron job each morning
// ---------------------------------------------------------------------------

export const generateDailyPlans = internalAction({
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`Skipping plan generation on ${DAY_NAMES[dayOfWeek]}`);
      return;
    }

    console.log(`Generating daily plans for ${today} (${DAY_NAMES[dayOfWeek]})...`);

    const family = await ctx.runQuery(internal.families.getFirst);
    if (!family) {
      console.error("No family found");
      return;
    }

    const children = await ctx.runQuery(internal.childProfiles.getByFamily, {
      familyId: family._id,
    });

    if (children.length === 0) {
      console.log("No children found");
      return;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (const child of children) {
      console.log(`  Planning for ${child.name}...`);

      const data = await ctx.runQuery(internal.planGenerator.getChildPlanningData, {
        childId: child._id,
      });

      if (!data) {
        console.log(`    Skipping ${child.name} — no data`);
        continue;
      }

      if (!data.weeklyPlan || data.weeklyPlan.blocks.length === 0) {
        console.log(`    Skipping ${child.name} — no weekly plan set up for ${DAY_NAMES[dayOfWeek]}`);
        continue;
      }

      const hasIxlData = data.mathDiag || data.elaDiag || data.mathRec || data.elaRec;
      if (!hasIxlData) {
        console.log(`    Skipping ${child.name} — no IXL data synced yet`);
        continue;
      }

      try {
        const prompt = buildPrompt(data);

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are an expert homeschool curriculum planner. Given a child's IXL diagnostic data and skill recommendations, assign specific IXL skills to their daily lesson blocks. Focus on their weakest strands and top-priority recommendations. Keep instructions concise and actionable. Always return valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 1500,
        });

        const raw = response.choices[0]?.message?.content ?? "{}";
        const result = JSON.parse(raw) as {
          blocks: Array<{
            id: string;
            instructions?: string;
            resource?: { platform: string; name: string; url: string };
          }>;
        };

        if (!Array.isArray(result.blocks) || result.blocks.length === 0) {
          console.log(`    No blocks returned for ${child.name}`);
          continue;
        }

        const updatedBlocks = mergeLlmIntoBlocks(data.weeklyPlan.blocks, result.blocks);

        await ctx.runMutation(internal.planGenerator.savePlanForChild, {
          childId: child._id,
          weeklyPlanId: data.weeklyPlan._id,
          updatedBlocks,
        });

        console.log(`    ✓ Plan saved for ${child.name} (${result.blocks.length} blocks filled)`);
      } catch (err) {
        console.error(`    Error generating plan for ${child.name}:`, err);
      }
    }

    console.log("Daily plan generation complete.");
  },
});
