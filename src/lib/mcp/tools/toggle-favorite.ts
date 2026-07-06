import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "toggle_favorite",
  title: "Toggle favorite",
  description: "Mark or unmark a story as favorite.",
  inputSchema: {
    id: z.string().uuid(),
    favorite: z.boolean(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, favorite }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("stories")
      .update({ is_favorite: favorite })
      .eq("id", id)
      .select("id, title, is_favorite")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Story not found" }], isError: true };
    return {
      content: [{ type: "text", text: `Story "${data.title}" favorite=${data.is_favorite}` }],
      structuredContent: { story: data },
    };
  },
});
