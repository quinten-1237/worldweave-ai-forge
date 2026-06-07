import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Home, Heart, Settings, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useStoryStore } from "@/store/storyStore";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const stories = useStoryStore((s) => s.stories);

  const navItems = [
    { to: "/", label: "Dashboard", icon: Home, exact: true },
    { to: "/library", label: "Mijn Verhalen", icon: BookOpen },
    { to: "/favorites", label: "Favorieten", icon: Heart },
    { to: "/settings", label: "Instellingen", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen text-foreground">
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur sticky top-0 h-screen">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="h-6 w-6 text-gold group-hover:rotate-12 transition-transform" />
            <span className="font-display text-xl tracking-wider gradient-gold-text font-bold">
              StoryForge
            </span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1 ml-8">AI Storytelling</p>
        </div>

        <nav className="p-4 flex-1 space-y-1">
          <Link
            to="/new"
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-md gradient-gold text-primary-foreground font-semibold hover:shadow-gold transition-all hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> Nieuw Verhaal
          </Link>
          {navItems.map((n) => {
            const Icon = n.icon;
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  active
                    ? "bg-secondary text-gold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{n.label}</span>
              </Link>
            );
          })}

          {stories.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground/70 px-3 mb-2">
                Recent
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                {stories.slice(0, 8).map((s) => (
                  <Link
                    key={s.id}
                    to="/story/$id"
                    params={{ id: s.id }}
                    className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-gold hover:bg-secondary/40 rounded transition-colors truncate"
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground">
          {stories.length} {stories.length === 1 ? "verhaal" : "verhalen"} opgeslagen
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
