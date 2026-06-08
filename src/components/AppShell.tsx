import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { BookOpen, Home, Heart, Settings, Plus, Sparkles, LogIn, LogOut, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useStoryStore } from "@/store/storyStore";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const stories = useStoryStore((s) => s.stories);
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const t = useT();
  const navigate = useNavigate();

  const navItems = [
    { to: "/", label: t("nav.dashboard"), icon: Home, exact: true },
    { to: "/library", label: t("nav.stories"), icon: BookOpen },
    { to: "/favorites", label: t("nav.favorites"), icon: Heart },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  return (
    <div className="flex min-h-dvh text-foreground">
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur sticky top-0 h-dvh">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="h-6 w-6 text-gold group-hover:rotate-12 transition-transform" />
            <span className="font-display text-xl tracking-wider gradient-gold-text font-bold">StoryForge</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1 ml-8">{t("app.tagline")}</p>
        </div>

        <nav className="p-4 flex-1 space-y-1 overflow-y-auto scrollbar-thin">
          <Link to="/new" className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-md gradient-gold text-primary-foreground font-semibold hover:shadow-gold transition-all hover:scale-[1.02]">
            <Plus className="h-4 w-4" /> {t("nav.new_story")}
          </Link>
          {navItems.map((n) => {
            const Icon = n.icon;
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${active ? "bg-secondary text-gold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                <Icon className="h-4 w-4" /><span className="text-sm">{n.label}</span>
              </Link>
            );
          })}

          {stories.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground/70 px-3 mb-2">{t("nav.recent")}</p>
              <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                {stories.slice(0, 8).map((s) => (
                  <Link key={s.id} to="/story/$id" params={{ id: s.id }}
                    className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-gold hover:bg-secondary/40 rounded transition-colors truncate">{s.title}</Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          {user ? (
            <div className="space-y-2">
              <Link to="/settings" className="flex items-center gap-3 group">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center"><UserIcon className="h-4 w-4 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate group-hover:text-gold transition-colors">{profile?.display_name ?? user.email}</p>
                  <p className="text-xs text-muted-foreground">{stories.length} {stories.length === 1 ? t("nav.stories_saved_one") : t("nav.stories_saved_other")}</p>
                </div>
              </Link>
              <button onClick={async () => { await signOut(); toast.success(t("toast.signed_out")); navigate({ to: "/" }); }}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-gold w-full"><LogOut className="h-3 w-3" />{t("btn.sign_out")}</button>
            </div>
          ) : (
            <Link to="/auth" className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gold/40 text-gold hover:bg-gold/10 text-sm">
              <LogIn className="h-4 w-4" /> {t("btn.sign_in")}
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
