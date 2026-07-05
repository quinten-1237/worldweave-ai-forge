import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Story } from "@/types/story";

// The full Story object is stored as a JSONB blob under stories.data.
// We validate only the outer shape here; the rest is opaque.
const StoryDataSchema = z.record(z.string(), z.any());

export const listStoriesFromCloud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stories")
      .select("id, title, cover_url, is_favorite, data, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveStoryToCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string().min(1).max(500),
      data: StoryDataSchema,
      isFavorite: z.boolean().optional(),
      coverUrl: z.string().optional().nullable(),
      summary: z.string().max(500).optional(),
      writeVersion: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      id: data.id,
      user_id: userId,
      title: data.title,
      cover_url: data.coverUrl ?? null,
      data: data.data,
      is_favorite: data.isFavorite ?? false,
    };
    // Upsert into stories.
    const { error: upErr } = await supabase.from("stories").upsert(row, { onConflict: "id" });
    if (upErr) throw new Error(upErr.message);

    if (data.writeVersion) {
      const { error: vErr } = await supabase.from("story_versions").insert({
        story_id: data.id,
        user_id: userId,
        data: data.data,
        summary: data.summary ?? null,
        kind: "autosave",
      });
      if (vErr) console.warn("[story_versions] insert failed:", vErr.message);
    }
    return { ok: true };
  });

export const deleteStoryFromCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStoryVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ storyId: z.string() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("story_versions")
      .select("id, story_id, summary, kind, created_at")
      .eq("story_id", data.storyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listStoryBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ storyId: z.string() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("story_backups")
      .select("id, story_id, label, kind, created_at")
      .eq("story_id", data.storyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveStoryBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      storyId: z.string(),
      label: z.string().max(200).optional(),
      kind: z.enum(["pre-generation", "daily", "manual", "pre-restore"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Copy current stories.data into a backup row.
    const { data: story, error: sErr } = await supabase
      .from("stories")
      .select("data")
      .eq("id", data.storyId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!story) throw new Error("Verhaal niet gevonden");
    const { error } = await supabase.from("story_backups").insert({
      story_id: data.storyId,
      user_id: userId,
      data: story.data,
      label: data.label ?? null,
      kind: data.kind,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreStoryVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ versionId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v, error: vErr } = await supabase
      .from("story_versions")
      .select("story_id, data")
      .eq("id", data.versionId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!v) throw new Error("Versie niet gevonden");

    // Backup current state before overwriting.
    const { data: current } = await supabase
      .from("stories")
      .select("data")
      .eq("id", v.story_id)
      .maybeSingle();
    if (current?.data) {
      await supabase.from("story_backups").insert({
        story_id: v.story_id,
        user_id: userId,
        data: current.data,
        label: "Voor herstel van versie",
        kind: "pre-restore",
      });
    }
    const restored = v.data as Record<string, unknown>;
    const { error } = await supabase
      .from("stories")
      .update({ data: restored, title: (restored.title as string) ?? "Zonder titel" })
      .eq("id", v.story_id);
    if (error) throw new Error(error.message);
    return { ok: true, storyId: v.story_id, data: restored as unknown as Story };
  });

export const restoreStoryBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ backupId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: b, error: bErr } = await supabase
      .from("story_backups")
      .select("story_id, data")
      .eq("id", data.backupId)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!b) throw new Error("Backup niet gevonden");

    const { data: current } = await supabase
      .from("stories")
      .select("data")
      .eq("id", b.story_id)
      .maybeSingle();
    if (current?.data) {
      await supabase.from("story_backups").insert({
        story_id: b.story_id,
        user_id: userId,
        data: current.data,
        label: "Voor herstel van backup",
        kind: "pre-restore",
      });
    }
    const restored = b.data as Record<string, unknown>;
    const { error } = await supabase
      .from("stories")
      .update({ data: restored, title: (restored.title as string) ?? "Zonder titel" })
      .eq("id", b.story_id);
    if (error) throw new Error(error.message);
    return { ok: true, storyId: b.story_id, data: restored as unknown as Story };
  });

export const getStoryVersionData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ versionId: z.string() }))
  .handler(async ({ data, context }) => {
    const { data: v, error } = await context.supabase
      .from("story_versions")
      .select("data")
      .eq("id", data.versionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return v?.data ?? null;
  });

export const getStoryBackupData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ backupId: z.string() }))
  .handler(async ({ data, context }) => {
    const { data: b, error } = await context.supabase
      .from("story_backups")
      .select("data")
      .eq("id", data.backupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return b?.data ?? null;
  });
