import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    // Remove storage objects under the user's folder
    for (const bucket of ["avatars", "user-uploads"] as const) {
      const { data } = await supabaseAdmin.storage.from(bucket).list(userId);
      if (data && data.length) {
        await supabaseAdmin.storage.from(bucket).remove(data.map((o) => `${userId}/${o.name}`));
      }
    }
    // Delete auth user (cascades profile/stories/images via FK ON DELETE CASCADE)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
