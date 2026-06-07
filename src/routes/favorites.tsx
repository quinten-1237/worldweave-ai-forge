import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StoryCard } from "@/components/StoryCard";
import { useStoryStore } from "@/store/storyStore";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favorieten — StoryForge AI" }] }),
  component: Favorites,
});

function Favorites() {
  const stories = useStoryStore((s) => s.stories);
  const favs = stories.filter((st) => st.favorite);
  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10">
        <h1 className="font-display text-4xl gradient-gold-text mb-8">Favorieten</h1>
        {favs.length === 0 ? (
          <p className="text-muted-foreground">Nog geen favorieten gemarkeerd.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favs.map((s) => <StoryCard key={s.id} story={s} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
