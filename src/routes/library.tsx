import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StoryCard } from "@/components/StoryCard";
import { Button } from "@/components/ui/button";
import { useStoryStore } from "@/store/storyStore";
import { ImportStoryDialog } from "@/components/ImportStoryDialog";
import { Plus, Upload } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Mijn Verhalen — StoryForge AI" }] }),
  component: Library,
});

function Library() {
  const stories = useStoryStore((s) => s.stories);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl gradient-gold-text">Mijn Verhalen</h1>
            <p className="text-muted-foreground mt-1">{stories.length} opgeslagen</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload /> Importeer
            </Button>
            <Button asChild variant="hero">
              <Link to="/new"><Plus /> Nieuw</Link>
            </Button>
          </div>
        </div>
        {stories.length === 0 ? (
          <p className="text-muted-foreground">Geen verhalen.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map((s) => <StoryCard key={s.id} story={s} />)}
          </div>
        )}
      </div>
      <ImportStoryDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </AppShell>
  );
}
