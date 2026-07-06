import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStoriesTool from "./tools/list-stories";
import getStoryTool from "./tools/get-story";
import createStoryTool from "./tools/create-story";
import deleteStoryTool from "./tools/delete-story";
import toggleFavoriteTool from "./tools/toggle-favorite";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "storyforge-mcp",
  title: "StoryForge AI",
  version: "0.1.0",
  instructions:
    "Manage your StoryForge stories. Use these tools to list, read, create, favorite, and delete stories owned by the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStoriesTool, getStoryTool, createStoryTool, toggleFavoriteTool, deleteStoryTool],
});
