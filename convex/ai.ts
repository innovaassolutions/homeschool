import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";

function getAgeAppropriatePrompt(ageGroup: string, subject: string): string {
  const basePrompts: Record<string, string> = {
    ages6to9: `You are a friendly, encouraging tutor for young children (ages 6-9).
Use simple words, short sentences, and lots of encouragement.
Make learning fun with examples they can relate to.
Use emojis occasionally to make responses engaging.
Always be patient and celebrate small wins.
Never use complex vocabulary or abstract concepts.`,
    ages10to13: `You are a supportive tutor for pre-teens (ages 10-13).
Be encouraging but also challenge them appropriately.
Use relatable examples from their world (games, social media, sports).
Explain concepts clearly and check for understanding.
Encourage critical thinking and asking questions.`,
    ages14to16: `You are a knowledgeable tutor for teenagers (ages 14-16).
Be respectful and engage them intellectually.
Prepare them for advanced concepts and real-world applications.
Use a more mature tone while still being supportive.
Encourage independent thinking and deeper exploration.`,
  };

  const subjectContext = `You are tutoring in ${subject}.
Focus your examples and explanations on this subject.
If the student asks about something unrelated, gently guide them back to the topic.`;

  return `${basePrompts[ageGroup] || basePrompts.ages10to13}

${subjectContext}

Important safety rules:
- Never share personal information
- Keep all content age-appropriate
- If asked about inappropriate topics, redirect to the learning subject
- Be supportive and never discouraging`;
}

export const chat = action({
  args: {
    sessionId: v.id("learningSessions"),
    childId: v.id("childProfiles"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Get child profile for age-appropriate prompting
    const child = await ctx.runQuery(internal.childProfiles.getById, {
      id: args.childId,
    });

    if (!child) {
      throw new Error("Child profile not found");
    }

    // Get session for subject context
    const session = await ctx.runQuery(internal.sessions.getByIdInternal, {
      sessionId: args.sessionId,
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // Get conversation history
    const history = await ctx.runQuery(internal.conversations.getHistory, {
      sessionId: args.sessionId,
    });

    // Build messages with age-appropriate system prompt
    const systemPrompt = getAgeAppropriatePrompt(child.ageGroup, session.subject);

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user", content: args.message },
    ];

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0].message.content || "";
    const tokenCount = response.usage?.total_tokens;

    // Store user message
    await ctx.runMutation(internal.conversations.addMessage, {
      sessionId: args.sessionId,
      childId: args.childId,
      role: "user",
      content: args.message,
    });

    // Store assistant message
    await ctx.runMutation(internal.conversations.addMessage, {
      sessionId: args.sessionId,
      childId: args.childId,
      role: "assistant",
      content: assistantMessage,
      tokenCount,
    });

    // Increment interaction count
    await ctx.runMutation(internal.sessions.incrementInteractionInternal, {
      sessionId: args.sessionId,
    });

    return assistantMessage;
  },
});
