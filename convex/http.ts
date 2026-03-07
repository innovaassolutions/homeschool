import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Receives scraped IXL data from the Railway Playwright scraper.
// Secured by a shared IXL_SYNC_SECRET set in the Convex dashboard env vars.
http.route({
  path: "/ixl-sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.IXL_SYNC_SECRET;

    if (!expectedSecret) {
      return json({ error: "IXL_SYNC_SECRET not set in Convex env vars" }, 500);
    }

    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const payload = body as {
      children: Array<{
        name: string;
        math?: {
          overallLevel?: number;
          strands: Array<{ name: string; level: number }>;
          recommendations: Array<{
            skillId: string;
            skillName: string;
            strand: string;
            priority: number;
            url?: string;
          }>;
        };
        ela?: {
          overallLevel?: number;
          strands: Array<{ name: string; level: number }>;
          recommendations: Array<{
            skillId: string;
            skillName: string;
            strand: string;
            priority: number;
            url?: string;
          }>;
        };
      }>;
    };

    if (!Array.isArray(payload?.children)) {
      return json({ error: "Missing children array" }, 400);
    }

    const results = await ctx.runMutation(internal.ixlData.syncFromScraper, {
      children: payload.children,
    });

    return json({ success: true, results }, 200);
  }),
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default http;
