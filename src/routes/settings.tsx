import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUploader } from "@/components/ImageUploader";
import { useT, useI18n, LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { useTheme, type FontSize, type ThemeMode } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import { useStoryStore } from "@/store/storyStore";
import { toast } from "sonner";
import { Moon, Sun, Monitor, Download, Trash2, LogOut, Lock, Mail, Bell, Eye, HardDrive, User as UserIcon, Palette, Languages, Shield, SlidersHorizontal } from "lucide-react";
import { signedUrl } from "@/lib/storage";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — StoryForge AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const t = useT();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { lang, setLang } = useI18n();
  const theme = useTheme();
  const stories = useStoryStore((s) => s.stories);

  useEffect(() => { if (!user) navigate({ to: "/auth", search: { next: "" } }); }, [user, navigate]);
  if (!user) return null;

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-5xl">
        <h1 className="font-display text-4xl gradient-gold-text mb-8">{t("settings.title")}</h1>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="flex-wrap h-auto justify-start gap-1 bg-card border border-border">
            <TabsTrigger value="profile"><UserIcon className="h-4 w-4" />{t("settings.tab.profile")}</TabsTrigger>
            <TabsTrigger value="appearance"><Palette className="h-4 w-4" />{t("settings.tab.appearance")}</TabsTrigger>
            <TabsTrigger value="language"><Languages className="h-4 w-4" />{t("settings.tab.language")}</TabsTrigger>
            <TabsTrigger value="account"><Mail className="h-4 w-4" />{t("settings.tab.account")}</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="h-4 w-4" />{t("settings.tab.notifications")}</TabsTrigger>
            <TabsTrigger value="privacy"><Shield className="h-4 w-4" />{t("settings.tab.privacy")}</TabsTrigger>
            <TabsTrigger value="a11y"><Eye className="h-4 w-4" />{t("settings.tab.accessibility")}</TabsTrigger>
            <TabsTrigger value="storage"><HardDrive className="h-4 w-4" />{t("settings.tab.storage")}</TabsTrigger>
            <TabsTrigger value="prefs"><SlidersHorizontal className="h-4 w-4" />{t("settings.tab.preferences")}</TabsTrigger>
            <TabsTrigger value="security"><Lock className="h-4 w-4" />{t("settings.tab.security")}</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <Card title={t("settings.theme")}>
              <div className="grid grid-cols-3 gap-2 max-w-md">
                {(["light","dark","system"] as ThemeMode[]).map((mode) => {
                  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
                  const active = theme.theme === mode;
                  return (
                    <button key={mode} onClick={() => { theme.setTheme(mode); updateProfile.mutate({ theme: mode }); }}
                      className={`p-4 rounded-lg border flex flex-col items-center gap-2 ${active ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"}`}>
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{t(`settings.theme.${mode}`)}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card title={t("settings.accent")}>
              <div className="flex items-center gap-3">
                <input type="color" value={theme.accent}
                  onChange={(e) => { theme.setAccent(e.target.value); updateProfile.mutate({ accent_color: e.target.value }); }}
                  className="h-12 w-20 rounded cursor-pointer bg-transparent border border-border" />
                <div className="flex gap-2">
                  {["#D4AF37","#3B82F6","#EC4899","#10B981","#F59E0B","#8B5CF6"].map((c) => (
                    <button key={c} onClick={() => { theme.setAccent(c); updateProfile.mutate({ accent_color: c }); }}
                      style={{ background: c }} className="h-9 w-9 rounded-full border-2 border-border hover:scale-110 transition-transform" />
                  ))}
                </div>
              </div>
              <div className="mt-4 p-4 rounded-lg border border-border" style={{ borderColor: theme.accent + "40" }}>
                <p className="text-sm text-muted-foreground mb-2">{t("settings.preview")}</p>
                <Button style={{ background: theme.accent, color: "#fff" }}>Button</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="language" className="mt-6">
            <Card title={t("settings.tab.language")}>
              <div className="grid sm:grid-cols-2 gap-2 max-w-md">
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => { setLang(l.code as LanguageCode); updateProfile.mutate({ language: l.code }); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left ${
                      lang === l.code ? "border-gold bg-gold/10 text-gold" : "border-border hover:border-gold/40"
                    }`}>
                    <span className="text-xl">{l.flag}</span>{l.label}
                  </button>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="mt-6"><AccountTab /></TabsContent>
          <TabsContent value="notifications" className="mt-6"><NotifTab /></TabsContent>
          <TabsContent value="privacy" className="mt-6"><PrivacyTab stories={stories} /></TabsContent>

          <TabsContent value="a11y" className="mt-6">
            <Card title={t("settings.font_size")}>
              <div className="grid grid-cols-3 gap-2 max-w-md">
                {(["small","medium","large"] as FontSize[]).map((s) => (
                  <button key={s} onClick={() => { theme.setFontSize(s); updateProfile.mutate({ font_size: s }); }}
                    className={`p-3 rounded-lg border ${theme.fontSize === s ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"}`}>
                    <span className={s === "small" ? "text-sm" : s === "large" ? "text-lg" : "text-base"}>Aa</span>
                    <div className="text-xs text-muted-foreground mt-1">{t(`settings.font.${s}`)}</div>
                  </button>
                ))}
              </div>
            </Card>
            <Card title={t("settings.high_contrast")}>
              <Toggle checked={theme.highContrast} onChange={(v) => { theme.setHighContrast(v); updateProfile.mutate({ high_contrast: v }); }} />
            </Card>
            <Card title={t("settings.reduced_motion")}>
              <Toggle checked={theme.reducedMotion} onChange={(v) => { theme.setReducedMotion(v); updateProfile.mutate({ reduced_motion: v }); }} />
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="mt-6"><StorageTab /></TabsContent>

          <TabsContent value="prefs" className="mt-6">
            <Card title={t("settings.prefs.autosave")}>
              <Toggle checked={profile?.autosave ?? true} onChange={(v) => updateProfile.mutate({ autosave: v })} />
            </Card>
            <Card title={t("settings.prefs.homepage")}>
              <select value={profile?.default_homepage ?? "/"}
                onChange={(e) => updateProfile.mutate({ default_homepage: e.target.value })}
                className="h-9 rounded-md border border-input bg-input px-3 text-sm w-full max-w-xs">
                <option value="/">Dashboard</option>
                <option value="/library">{t("nav.stories")}</option>
                <option value="/favorites">{t("nav.favorites")}</option>
              </select>
            </Card>
            <Card title={t("settings.prefs.remember")}>
              <Toggle checked={profile?.remember_last_page ?? true} onChange={(v) => updateProfile.mutate({ remember_last_page: v })} />
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <Card title={t("settings.security.logout_all")}>
              <Button variant="outline" onClick={async () => { await signOut(); toast.success(t("toast.signed_out")); navigate({ to: "/auth", search: { next: "" } }); }}>
                <LogOut /> {t("btn.sign_out")}
              </Button>
            </Card>
            <Card title={t("settings.security.2fa")}>
              <p className="text-sm text-muted-foreground">{t("settings.security.coming_soon")}</p>
            </Card>
            <Card title={t("settings.security.sessions")}>
              <p className="text-sm text-muted-foreground">{t("settings.security.coming_soon")}</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-4">
      <h2 className="font-display text-lg mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <Switch checked={checked} onCheckedChange={onChange} />;
}

function ProfileTab() {
  const t = useT();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? ""); setUsername(profile.username ?? ""); setBio(profile.bio ?? "");
  }, [profile]);

  return (
    <div>
      <Card title={t("settings.profile.avatar")}>
        <div className="max-w-[160px]">
          <ImageUploader bucket="avatars" aspect="square" value={profile?.avatar_url}
            onChange={(url) => update.mutate({ avatar_url: url })} />
        </div>
      </Card>
      <Card title={t("settings.profile.display_name")}>
        <div className="flex gap-2 max-w-md">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <Button onClick={() => update.mutate({ display_name: name }, { onSuccess: () => toast.success(t("toast.saved")) })}>{t("btn.save")}</Button>
        </div>
      </Card>
      <Card title={t("settings.profile.username")}>
        <div className="flex gap-2 max-w-md">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={32} />
          <Button onClick={() => update.mutate({ username }, { onSuccess: () => toast.success(t("toast.saved")) })}>{t("btn.save")}</Button>
        </div>
      </Card>
      <Card title={t("settings.profile.bio")}>
        <div className="space-y-2 max-w-2xl">
          <Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
          <Button onClick={() => update.mutate({ bio }, { onSuccess: () => toast.success(t("toast.saved")) })}>{t("btn.save")}</Button>
        </div>
      </Card>
    </div>
  );
}

function AccountTab() {
  const t = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email ?? "");
  const [pwd, setPwd] = useState("");
  const [confirmText, setConfirmText] = useState("");

  return (
    <div>
      <Card title={t("settings.account.email")}>
        <div className="flex gap-2 max-w-md">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={async () => {
            const { error } = await supabase.auth.updateUser({ email });
            if (error) toast.error(error.message); else toast.success(t("toast.saved"));
          }}>{t("btn.save")}</Button>
        </div>
      </Card>
      <Card title={t("settings.account.change_password")}>
        <div className="flex gap-2 max-w-md">
          <Input type="password" placeholder={t("settings.account.password.new")} value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={6} />
          <Button onClick={async () => {
            if (pwd.length < 6) return toast.error("Min 6");
            const { error } = await supabase.auth.updateUser({ password: pwd });
            if (error) toast.error(error.message); else { toast.success(t("toast.saved")); setPwd(""); }
          }}>{t("btn.save")}</Button>
        </div>
      </Card>
      <Card title={t("settings.account.delete")}>
        <p className="text-sm text-muted-foreground mb-3">{t("settings.account.delete_confirm")}</p>
        <div className="flex gap-2 max-w-md">
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
          <Button variant="destructive" disabled={confirmText !== "DELETE"} onClick={async () => {
            try {
              const { deleteAccount } = await import("@/lib/account.functions");
              await deleteAccount();
              toast.success("Deleted");
              await supabase.auth.signOut();
              navigate({ to: "/" });
            } catch (e) { toast.error((e as Error).message); }
          }}><Trash2 /> {t("btn.delete")}</Button>
        </div>
      </Card>
    </div>
  );
}

function NotifTab() {
  const t = useT();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  return (
    <div>
      <Card title={t("settings.notif.email")}>
        <Toggle checked={profile?.email_notifications ?? true} onChange={(v) => update.mutate({ email_notifications: v })} />
      </Card>
      <Card title={t("settings.notif.inapp")}>
        <Toggle checked={profile?.in_app_notifications ?? true} onChange={(v) => update.mutate({ in_app_notifications: v })} />
      </Card>
    </div>
  );
}

function PrivacyTab({ stories }: { stories: unknown[] }) {
  const t = useT();
  const navigate = useNavigate();

  const download = async () => {
    const { data: prof } = await supabase.from("profiles").select("*").maybeSingle();
    const { data: imgs } = await supabase.from("user_images").select("*");
    const blob = new Blob([JSON.stringify({ profile: prof, images: imgs, stories }, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = u; a.download = `storyforge-data-${Date.now()}.json`; a.click();
    toast.success(t("toast.saved"));
  };

  return (
    <div>
      <Card title={t("settings.privacy.download")}>
        <Button variant="outline" onClick={download}><Download /> {t("settings.privacy.download")}</Button>
      </Card>
      <Card title={t("settings.privacy.delete")}>
        <Button variant="destructive" onClick={async () => {
          if (!confirm("Delete all your stories and uploads?")) return;
          await supabase.from("user_images").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          localStorage.removeItem("storyforge-store");
          toast.success(t("toast.saved"));
          navigate({ to: "/" });
        }}><Trash2 /> {t("settings.privacy.delete")}</Button>
      </Card>
      <Card title={t("settings.privacy.sharing")}>
        <Toggle checked={false} onChange={() => toast.info(t("settings.security.coming_soon"))} />
      </Card>
    </div>
  );
}

function StorageTab() {
  const t = useT();
  const { user } = useAuth();
  const [files, setFiles] = useState<Array<{ id: string; storage_path: string; public_url: string; size_bytes: number; mime_type: string | null }>>([]);
  const total = useMemo(() => files.reduce((a, f) => a + (f.size_bytes ?? 0), 0), [files]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_images").select("*").order("created_at", { ascending: false }).then(async ({ data }) => {
      const list = (data ?? []) as typeof files;
      // refresh signed URLs in case they expired
      const refreshed = await Promise.all(list.map(async (f) => {
        try { return { ...f, public_url: await signedUrl("user-uploads", f.storage_path) }; }
        catch { return f; }
      }));
      setFiles(refreshed);
    });
  }, [user]);

  return (
    <div>
      <Card title={t("settings.storage.usage")}>
        <p className="text-3xl font-display gradient-gold-text">{(total / 1024 / 1024).toFixed(2)} MB</p>
        <p className="text-xs text-muted-foreground">{files.length} files</p>
      </Card>
      <Card title={t("settings.storage.files")}>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {files.map((f) => (
              <div key={f.id} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                <img src={f.public_url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={async () => {
                    await supabase.storage.from("user-uploads").remove([f.storage_path]);
                    await supabase.from("user_images").delete().eq("id", f.id);
                    setFiles(files.filter((x) => x.id !== f.id));
                  }}
                  className="absolute top-1 right-1 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                ><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
