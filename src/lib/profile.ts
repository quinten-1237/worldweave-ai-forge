import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { useEffect } from "react";
import { useI18n, type LanguageCode } from "./i18n";
import { useTheme, type FontSize, type ThemeMode } from "./theme";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  language: string;
  theme: string;
  accent_color: string;
  font_size: string;
  high_contrast: boolean;
  reduced_motion: boolean;
  email_notifications: boolean;
  in_app_notifications: boolean;
  autosave: boolean;
  default_homepage: string;
  remember_last_page: boolean;
  last_page: string | null;
  onboarded: boolean;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });
}

/** Sync profile prefs into i18n + theme contexts when profile loads. */
export function useSyncProfileToUI() {
  const { data } = useProfile();
  const { setLang } = useI18n();
  const { setTheme, setAccent, setFontSize, setHighContrast, setReducedMotion } = useTheme();
  useEffect(() => {
    if (!data) return;
    setLang(data.language as LanguageCode);
    setTheme(data.theme as ThemeMode);
    setAccent(data.accent_color);
    setFontSize(data.font_size as FontSize);
    setHighContrast(data.high_contrast);
    setReducedMotion(data.reduced_motion);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
}
