import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_story",
  title: "Create story",
  description: "Create a new story for the signed-in user. Optionally pass a data payload matching the app's story schema.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Story title."),
    data: z.record(z.string(), z.unknown()).optional().describe("Optional story data payload (world, characters, chapters, etc.)."),
    coverUrl: z.string().url().optional().describe("Optional cover image URL."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, data, coverUrl }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data: row, error } = await supabaseForUser(ctx)
      .from("stories")
      .insert({
        user_id: ctx.getUserId()!,
        title,
        data: (data ?? {}) as never,
        cover_url: coverUrl ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created story "${row.title}" (${row.id})` }],
      structuredContent: { story: row },
    };
  },
});
