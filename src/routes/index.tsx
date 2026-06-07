import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Plus, Sparkles, Feather, Map, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useStoryStore } from "@/store/storyStore";
import { StoryCard } from "@/components/StoryCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StoryForge AI — AI Storytelling Platform" },
      {
        name: "description",
        content:
          "Creëer eindeloze werelden, personages en boeken met AI. Onbeperkt geheugen, hoofdstuk na hoofdstuk.",
      },
      { property: "og:title", content: "StoryForge AI" },
      { property: "og:description", content: "Schrijf jouw eigen boek met AI." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const stories = useStoryStore((s) => s.stories);
  const lastRead = [...stories]
    .filter((s) => (s.lastReadChapter ?? 0) > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return (
    <AppShell>
      <div className="relative">
        <div className="absolute inset-0 gradient-hero pointer-events-none" />
        <section className="relative px-6 md:px-12 pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs uppercase tracking-widest mb-6">
              <Sparkles className="h-3 w-3" /> AI Storytelling
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-tight">
              <span className="gradient-gold-text">Smeed</span> jouw eigen
              <br />
              legende
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Bouw werelden, vorm personages, en laat AI hoofdstuk na hoofdstuk een
              meeslepend boek schrijven dat alles onthoudt — voor altijd.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/new">
                  <Plus /> Nieuw Verhaal
                </Link>
              </Button>
              {lastRead && (
                <Button asChild variant="outline" size="xl">
                  <Link to="/story/$id" params={{ id: lastRead.id }}>
                    <BookOpen /> Verder lezen: {lastRead.title}
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>

          <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-4xl">
            {[
              { icon: Users, title: "Oneindige personages", desc: "AI-gegenereerd, diepgaand, levend." },
              { icon: Map, title: "Wereldenbouwer", desc: "Locaties, facties, magiesystemen." },
              { icon: Feather, title: "Eindeloze hoofdstukken", desc: "Met permanent geheugen." },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="bg-card/60 backdrop-blur border border-border rounded-xl p-5 shadow-card hover:border-gold/40 transition-colors"
                >
                  <Icon className="h-6 w-6 text-gold mb-3" />
                  <h3 className="font-display text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="relative px-6 md:px-12 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl">Mijn Verhalen</h2>
            {stories.length > 0 && (
              <Link to="/library" className="text-sm text-gold hover:underline">
                Bekijk alle →
              </Link>
            )}
          </div>
          {stories.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nog geen verhalen. Begin met je eerste avontuur.</p>
              <Button asChild variant="hero" className="mt-4">
                <Link to="/new"><Plus /> Maak een verhaal</Link>
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stories.slice(0, 6).map((s) => (
                <StoryCard key={s.id} story={s} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
