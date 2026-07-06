import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_stories",
  title: "List stories",
  description: "List stories owned by the signed-in user, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
    favoritesOnly: z.boolean().optional().describe("Only return favorited stories."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, favoritesOnly }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("stories")
      .select("id, title, cover_url, is_favorite, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (favoritesOnly) q = q.eq("is_favorite", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { stories: data ?? [] },
    };
  },
});
