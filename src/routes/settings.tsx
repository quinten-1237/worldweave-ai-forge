import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useStoryStore } from "@/store/storyStore";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Instellingen — StoryForge AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const stories = useStoryStore((s) => s.stories);
  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-3xl">
        <h1 className="font-display text-4xl gradient-gold-text mb-8">Instellingen</h1>
        <div className="space-y-6">
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-display text-xl mb-2">Opslag</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Alle verhalen worden lokaal in je browser opgeslagen. {stories.length} verhalen
              opgeslagen.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([JSON.stringify(stories, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `storyforge-backup-${Date.now()}.json`;
                a.click();
                toast.success("Back-up gedownload");
              }}
            >
              Download alle verhalen (back-up)
            </Button>
          </section>
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-display text-xl mb-2">Over StoryForge AI</h2>
            <p className="text-sm text-muted-foreground">
              Een AI storytelling-platform dat hele werelden onthoudt. Powered by Lovable AI.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
