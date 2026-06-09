import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, BookOpen, Users, MapPin, Shield, Sparkles, Clock,
  Library as LibraryIcon, Search, Download, Trash2, Plus, Wand2, Loader2,
  Heart, Image as ImageIcon, Star,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StoryDirector, type DirectorPayload } from "@/components/StoryDirector";
import { useStoryStore } from "@/store/storyStore";
import { generateChapter, generateCharacter } from "@/lib/ai.functions";
import { ImageUploader } from "@/components/ImageUploader";
import { buildStoryContext, buildPreviousSummary } from "@/lib/story-context";
import { exportTxt, exportJson, exportHtml } from "@/lib/export";
import { toast } from "sonner";
import type { Character, Location, Faction, Chapter } from "@/types/story";

export const Route = createFileRoute("/story/$id")({
  head: ({ params }) => ({ meta: [{ title: `Verhaal — StoryForge AI` }, { name: "story-id", content: params.id }] }),
  component: StoryView,
});

type Tab = "chapters" | "characters" | "locations" | "factions" | "magic" | "encyclopedia" | "stats";

function StoryView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const story = useStoryStore((s) => s.stories.find((st) => st.id === id));
  const deleteStory = useStoryStore((s) => s.deleteStory);
  const toggleFav = useStoryStore((s) => s.toggleFavorite);
  const [tab, setTab] = useState<Tab>("chapters");
  const [search, setSearch] = useState("");

  if (!story) {
    return (
      <AppShell>
        <div className="p-12">
          <p className="text-muted-foreground">Verhaal niet gevonden.</p>
          <Button asChild className="mt-4"><Link to="/">Terug</Link></Button>
        </div>
      </AppShell>
    );
  }

  const totalWords = story.chapters.reduce((s, c) => s + c.wordCount, 0);

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "chapters", label: "Hoofdstukken", icon: BookOpen, count: story.chapters.length },
    { key: "characters", label: "Personages", icon: Users, count: story.characters.length },
    { key: "locations", label: "Locaties", icon: MapPin, count: story.locations.length },
    { key: "factions", label: "Facties", icon: Shield, count: story.factions.length },
    { key: "magic", label: "Magie", icon: Sparkles },
    { key: "encyclopedia", label: "Encyclopedie", icon: LibraryIcon },
    { key: "stats", label: "Statistieken", icon: Clock },
  ];

  return (
    <AppShell>
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-20">
          <div className="px-6 md:px-12 py-4 flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft /> Dashboard</Link>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl truncate gradient-gold-text">{story.title}</h1>
              {story.subtitle && <p className="text-xs text-muted-foreground italic truncate">{story.subtitle}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => toggleFav(story.id)} title="Favoriet">
              <Heart className={story.favorite ? "fill-gold text-gold" : ""} />
            </Button>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek..." className="pl-8 h-9 w-40" />
            </div>
            <ExportMenu story={story} />
            <Button
              variant="ghost" size="icon"
              onClick={() => {
                if (confirm("Verhaal verwijderen?")) {
                  deleteStory(story.id);
                  navigate({ to: "/" });
                }
              }}
              title="Verwijder"
            ><Trash2 /></Button>
          </div>
          <div className="px-6 md:px-12 pb-2 flex gap-1 overflow-x-auto scrollbar-thin">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md whitespace-nowrap transition-colors ${
                    active ? "text-gold border-b-2 border-gold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                  {t.count !== undefined && <span className="text-xs opacity-60">{t.count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 md:px-12 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "chapters" && <ChaptersTab storyId={story.id} search={search} />}
              {tab === "characters" && <CharactersTab storyId={story.id} search={search} />}
              {tab === "locations" && <LocationsTab storyId={story.id} search={search} />}
              {tab === "factions" && <FactionsTab storyId={story.id} search={search} />}
              {tab === "magic" && <MagicTab storyId={story.id} />}
              {tab === "encyclopedia" && <EncyclopediaTab storyId={story.id} />}
              {tab === "stats" && <StatsTab storyId={story.id} totalWords={totalWords} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}

function ExportMenu({ story }: { story: ReturnType<typeof useStoryStore.getState>["stories"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <Download /> Export
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 bg-popover border border-border rounded-md shadow-card overflow-hidden z-30 min-w-40">
          {[
            { l: "TXT", a: () => exportTxt(story) },
            { l: "JSON", a: () => exportJson(story) },
            { l: "HTML / PDF", a: () => { exportHtml(story); toast.info("HTML gedownload — open en print naar PDF"); } },
          ].map((o) => (
            <button
              key={o.l}
              onClick={() => { o.a(); setOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-secondary"
            >{o.l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ CHAPTERS ============ */

function ChaptersTab({ storyId, search }: { storyId: string; search: string }) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const addChapter = useStoryStore((s) => s.addChapter);
  const updateChapter = useStoryStore((s) => s.updateChapter);
  const addTimelineEvent = useStoryStore((s) => s.addTimelineEvent);
  const genChapter = useServerFn(generateChapter);
  const [generating, setGenerating] = useState(false);
  const [openChapter, setOpenChapter] = useState<string | null>(
    story.chapters[story.chapters.length - 1]?.id ?? null,
  );

  const filtered = useMemo(() => {
    if (!search) return story.chapters;
    const s = search.toLowerCase();
    return story.chapters.filter(
      (c) => c.title.toLowerCase().includes(s) || c.content.toLowerCase().includes(s),
    );
  }, [story.chapters, search]);

  const generate = async (payload: DirectorPayload = { directorInstructions: "" }) => {
    setGenerating(true);
    try {
      // Re-read latest story for fresh context (director may have just added entities)
      const fresh = useStoryStore.getState().stories.find((st) => st.id === storyId)!;
      const ctx = buildStoryContext(fresh);
      const prev = buildPreviousSummary(fresh);
      const result = await genChapter({
        data: {
          storyContext: ctx,
          previousSummary: prev,
          chapterNumber: fresh.chapters.length + 1,
          userChoice: payload.userChoice,
          directorInstructions: payload.directorInstructions || undefined,
        },
      });
      const newChap = addChapter(storyId, {
        title: result.title,
        content: result.content,
        wordCount: result.wordCount,
        choices: result.choices,
        chosenOption: payload.userChoice,
      });
      for (const ev of result.timelineEvents ?? []) {
        addTimelineEvent(storyId, {
          chapterId: newChap.id,
          title: ev.title,
          description: ev.description,
        });
      }
      setOpenChapter(newChap.id);
      toast.success(`Hoofdstuk ${newChap.number} klaar`);
    } catch (e) {
      toast.error("Kon hoofdstuk niet genereren: " + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const last = story.chapters[story.chapters.length - 1];

  return (
    <div className="grid lg:grid-cols-[1fr,320px] gap-8">
      <div>
        {filtered.length === 0 && !search && (
          <div className="border border-dashed border-gold/30 rounded-xl p-10 text-center bg-card/30">
            <Sparkles className="h-10 w-10 mx-auto text-gold mb-3" />
            <h3 className="font-display text-2xl mb-2">Begin je epische verhaal</h3>
            <p className="text-muted-foreground mb-6">De AI gebruikt al je personages, locaties en wereld.</p>
            <Button variant="hero" size="xl" onClick={() => generate()} disabled={generating}>
              {generating ? <><Loader2 className="animate-spin" /> Schrijven...</> : <><Wand2 /> Start Verhaal</>}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((c) => (
            <ChapterCard key={c.id} chapter={c} open={openChapter === c.id} onToggle={() => setOpenChapter(openChapter === c.id ? null : c.id)} onUpdate={(p) => updateChapter(storyId, c.id, p)} />
          ))}
        </div>

        {last && !search && (
          <div className="mt-8">
            <StoryDirector
              storyId={storyId}
              generating={generating}
              quickChoices={last.choices}
              onGenerate={generate}
            />
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="font-display text-sm uppercase tracking-wider text-gold mb-3">Inhoudsopgave</h4>
          <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-thin">
            {story.chapters.length === 0 && <p className="text-xs text-muted-foreground">Nog geen hoofdstukken</p>}
            {story.chapters.map((c) => (
              <button
                key={c.id}
                onClick={() => setOpenChapter(c.id)}
                className={`block w-full text-left px-2 py-1.5 rounded text-sm hover:bg-secondary transition-colors ${
                  openChapter === c.id ? "text-gold" : "text-muted-foreground"
                }`}
              >
                <span className="text-xs opacity-60">H{c.number}.</span> {c.title}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ChapterCard({
  chapter, open, onToggle, onUpdate,
}: {
  chapter: Chapter; open: boolean; onToggle: () => void;
  onUpdate: (p: Partial<Chapter>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center text-primary-foreground font-display font-bold text-sm">
            {chapter.number}
          </div>
          <div>
            <h3 className="font-display text-lg">{chapter.title}</h3>
            <p className="text-xs text-muted-foreground">{chapter.wordCount.toLocaleString()} woorden</p>
          </div>
        </div>
        <span className="text-muted-foreground text-sm">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border">
          {editing ? (
            <div className="pt-4 space-y-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea rows={20} value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { onUpdate({ title, content, wordCount: content.trim().split(/\s+/).length }); setEditing(false); toast.success("Opgeslagen"); }}>Opslaan</Button>
                <Button size="sm" variant="ghost" onClick={() => { setTitle(chapter.title); setContent(chapter.content); setEditing(false); }}>Annuleer</Button>
              </div>
            </div>
          ) : (
            <>
              <article className="prose prose-invert max-w-none pt-4 font-serif text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {chapter.content}
              </article>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Bewerk</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ============ CHARACTERS ============ */

function CharactersTab({ storyId, search }: { storyId: string; search: string }) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const addCharacter = useStoryStore((s) => s.addCharacter);
  const updateCharacter = useStoryStore((s) => s.updateCharacter);
  const removeCharacter = useStoryStore((s) => s.removeCharacter);
  const genChar = useServerFn(generateCharacter);
  const genImg = useServerFn(generateImage);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [imgLoading, setImgLoading] = useState<string | null>(null);

  const filtered = story.characters.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const aiGenerate = async () => {
    setGenerating(true);
    try {
      const ctx = buildStoryContext(story);
      const c = await genChar({ data: { storyContext: ctx } });
      addCharacter(storyId, { ...c, status: "levend" });
      toast.success(`${c.name} toegevoegd`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setGenerating(false); }
  };

  const portrait = async (c: Character) => {
    setImgLoading(c.id);
    try {
      const r = await genImg({
        data: {
          prompt: `Portret van ${c.name}, ${c.appearance ?? ""}, ${c.personality ?? ""}`,
          style: "epic fantasy character portrait, oil painting, cinematic dramatic lighting, ultra detailed",
        },
      });
      updateCharacter(storyId, c.id, { portraitUrl: r.dataUrl });
      toast.success("Portret klaar");
    } catch (e) { toast.error((e as Error).message); }
    finally { setImgLoading(null); }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="hero" onClick={aiGenerate} disabled={generating}>
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />} Genereer Personage
        </Button>
        <Button variant="outline" onClick={() => setEditing({ id: "", name: "", status: "levend" })}>
          <Plus /> Handmatig toevoegen
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-card hover:border-gold/40 transition-all group">
            <div className="aspect-[4/5] bg-secondary relative overflow-hidden">
              {c.portraitUrl ? (
                <img src={c.portraitUrl} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Users className="h-12 w-12 opacity-30" />
                </div>
              )}
              <button
                onClick={() => portrait(c)}
                disabled={imgLoading === c.id}
                className="absolute bottom-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-gold hover:text-primary-foreground transition-colors"
                title="Genereer portret"
              >
                {imgLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg">{c.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === "dood" ? "bg-destructive/20 text-destructive" :
                  c.status === "vermist" ? "bg-accent/20 text-accent-foreground" :
                  "bg-gold/20 text-gold"
                }`}>{c.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">{c.age} • {c.gender}</p>
              <p className="text-sm mt-2 text-foreground/80 line-clamp-3">{c.personality}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Bewerk</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Verwijder ${c.name}?`)) removeCharacter(storyId, c.id); }}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CharacterEditor
          character={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            if (editing.id) updateCharacter(storyId, editing.id, c);
            else addCharacter(storyId, c as Omit<Character, "id">);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CharacterEditor({
  character, onSave, onClose,
}: { character: Character; onSave: (c: Partial<Character>) => void; onClose: () => void }) {
  const [c, setC] = useState(character);
  const fields: { k: keyof Character; l: string; multi?: boolean }[] = [
    { k: "name", l: "Naam" }, { k: "age", l: "Leeftijd" }, { k: "gender", l: "Geslacht" },
    { k: "appearance", l: "Uiterlijk", multi: true }, { k: "personality", l: "Persoonlijkheid", multi: true },
    { k: "motivations", l: "Motivaties", multi: true }, { k: "goals", l: "Doelen", multi: true },
    { k: "secrets", l: "Geheimen", multi: true }, { k: "skills", l: "Vaardigheden", multi: true },
    { k: "relationships", l: "Relaties", multi: true },
  ];
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-gold/40 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin shadow-gold" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl mb-4 gradient-gold-text">{character.id ? "Bewerk" : "Nieuw"} personage</h2>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.k}>
              <Label className="text-xs">{f.l}</Label>
              {f.multi ? (
                <Textarea rows={2} value={(c[f.k] as string) ?? ""} onChange={(e) => setC({ ...c, [f.k]: e.target.value })} />
              ) : (
                <Input value={(c[f.k] as string) ?? ""} onChange={(e) => setC({ ...c, [f.k]: e.target.value })} />
              )}
            </div>
          ))}
          <div>
            <Label className="text-xs">Status</Label>
            <select value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as Character["status"] })} className="w-full h-9 rounded-md border border-input bg-input px-3 text-sm">
              <option value="levend">Levend</option>
              <option value="dood">Dood</option>
              <option value="vermist">Vermist</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Annuleer</Button>
          <Button variant="hero" onClick={() => { if (!c.name.trim()) return toast.error("Naam vereist"); onSave(c); }}>Opslaan</Button>
        </div>
      </div>
    </div>
  );
}

/* ============ LOCATIONS ============ */

function LocationsTab({ storyId, search }: { storyId: string; search: string }) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const addLocation = useStoryStore((s) => s.addLocation);
  const updateLocation = useStoryStore((s) => s.updateLocation);
  const removeLocation = useStoryStore((s) => s.removeLocation);
  const genImg = useServerFn(generateImage);
  const [editing, setEditing] = useState<Location | null>(null);
  const [imgLoading, setImgLoading] = useState<string | null>(null);

  const filtered = story.locations.filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()));

  const image = async (l: Location) => {
    setImgLoading(l.id);
    try {
      const r = await genImg({
        data: {
          prompt: `Landschap van ${l.name}. ${l.description ?? ""} ${l.climate ?? ""}`,
          style: "epic fantasy environment concept art, breathtaking landscape, cinematic, ultra detailed",
        },
      });
      updateLocation(storyId, l.id, { imageUrl: r.dataUrl });
    } catch (e) { toast.error((e as Error).message); }
    finally { setImgLoading(null); }
  };

  return (
    <div>
      <Button variant="hero" className="mb-6" onClick={() => setEditing({ id: "", name: "" })}>
        <Plus /> Nieuwe Locatie
      </Button>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((l) => (
          <div key={l.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-card hover:border-gold/40 transition-all">
            <div className="aspect-video bg-secondary relative">
              {l.imageUrl ? <img src={l.imageUrl} alt={l.name} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full flex items-center justify-center"><MapPin className="h-10 w-10 text-muted-foreground opacity-30" /></div>
              )}
              <button onClick={() => image(l)} disabled={imgLoading === l.id} className="absolute bottom-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur hover:bg-gold hover:text-primary-foreground transition-colors">
                {imgLoading === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </button>
            </div>
            <div className="p-4">
              <h3 className="font-display text-lg">{l.name}</h3>
              {l.climate && <p className="text-xs text-gold/80">{l.climate}</p>}
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{l.description}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Bewerk</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Verwijder?")) removeLocation(storyId, l.id); }}><Trash2 /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <SimpleEditor
          title={editing.id ? "Bewerk Locatie" : "Nieuwe Locatie"}
          fields={[
            { k: "name", l: "Naam" },
            { k: "description", l: "Beschrijving", multi: true },
            { k: "climate", l: "Klimaat" },
            { k: "population", l: "Bevolking" },
            { k: "history", l: "Geschiedenis", multi: true },
            { k: "buildings", l: "Belangrijke gebouwen", multi: true },
          ]}
          data={editing as unknown as Record<string, string>}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            const payload = d as Partial<Location>;
            if (editing.id) updateLocation(storyId, editing.id, payload);
            else addLocation(storyId, payload as Omit<Location, "id">);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ============ FACTIONS ============ */

function FactionsTab({ storyId, search }: { storyId: string; search: string }) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const addFaction = useStoryStore((s) => s.addFaction);
  const updateFaction = useStoryStore((s) => s.updateFaction);
  const removeFaction = useStoryStore((s) => s.removeFaction);
  const [editing, setEditing] = useState<Faction | null>(null);
  const filtered = story.factions.filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Button variant="hero" className="mb-6" onClick={() => setEditing({ id: "", name: "" })}>
        <Plus /> Nieuwe Factie
      </Button>
      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((f) => (
          <div key={f.id} className="bg-card border border-border rounded-xl p-5 shadow-card hover:border-gold/40 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl">{f.name}</h3>
                {f.leader && <p className="text-xs text-gold/80">Leider: {f.leader}</p>}
              </div>
              <Shield className="h-5 w-5 text-gold/60" />
            </div>
            <p className="text-sm text-muted-foreground mt-2">{f.description}</p>
            {(f.allies || f.enemies || f.goals) && (
              <div className="mt-3 space-y-1 text-xs">
                {f.allies && <p><span className="text-gold">Bondgenoten:</span> {f.allies}</p>}
                {f.enemies && <p><span className="text-destructive">Vijanden:</span> {f.enemies}</p>}
                {f.goals && <p><span className="text-muted-foreground">Doel:</span> {f.goals}</p>}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>Bewerk</Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Verwijder?")) removeFaction(storyId, f.id); }}><Trash2 /></Button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <SimpleEditor
          title={editing.id ? "Bewerk Factie" : "Nieuwe Factie"}
          fields={[
            { k: "name", l: "Naam" }, { k: "leader", l: "Leider" },
            { k: "description", l: "Beschrijving", multi: true },
            { k: "allies", l: "Bondgenoten" }, { k: "enemies", l: "Vijanden" },
            { k: "goals", l: "Doelstellingen", multi: true },
          ]}
          data={editing as unknown as Record<string, string>}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            const payload = d as Partial<Faction>;
            if (editing.id) updateFaction(storyId, editing.id, payload);
            else addFaction(storyId, payload as Omit<Faction, "id">);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ============ MAGIC ============ */

function MagicTab({ storyId }: { storyId: string }) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const updateStory = useStoryStore((s) => s.updateStory);
  const m = story.magic ?? {};
  const [draft, setDraft] = useState(m);
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl mb-2 gradient-gold-text">Magiesysteem</h2>
      <p className="text-sm text-muted-foreground mb-6">Optioneel. Definieer hoe magie werkt in jouw wereld.</p>
      <div className="space-y-4 bg-card border border-border rounded-xl p-6">
        {[
          { k: "type", l: "Type magie" }, { k: "rules", l: "Regels", multi: true },
          { k: "powers", l: "Krachten", multi: true }, { k: "limits", l: "Limieten", multi: true },
          { k: "forbidden", l: "Verboden magie", multi: true },
        ].map((f) => (
          <div key={f.k}>
            <Label className="text-xs">{f.l}</Label>
            {f.multi ? (
              <Textarea rows={2} value={(draft as Record<string, string>)[f.k] ?? ""} onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })} />
            ) : (
              <Input value={(draft as Record<string, string>)[f.k] ?? ""} onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })} />
            )}
          </div>
        ))}
        <Button variant="hero" onClick={() => { updateStory(storyId, { magic: draft }); toast.success("Opgeslagen"); }}>Opslaan</Button>
      </div>
    </div>
  );
}

/* ============ ENCYCLOPEDIA + TIMELINE ============ */

function EncyclopediaTab({ storyId }: { storyId: string }) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div>
        <h2 className="font-display text-2xl gradient-gold-text mb-4">Encyclopedie</h2>
        <Section title="Personages">
          {story.characters.map((c) => (
            <li key={c.id}><span className="text-gold">{c.name}</span> — {c.personality?.slice(0, 80)}</li>
          ))}
        </Section>
        <Section title="Locaties">
          {story.locations.map((l) => (
            <li key={l.id}><span className="text-gold">{l.name}</span> — {l.description?.slice(0, 80)}</li>
          ))}
        </Section>
        <Section title="Facties">
          {story.factions.map((f) => (
            <li key={f.id}><span className="text-gold">{f.name}</span> — {f.description?.slice(0, 80)}</li>
          ))}
        </Section>
      </div>
      <div>
        <h2 className="font-display text-2xl gradient-gold-text mb-4">Tijdlijn</h2>
        <div className="space-y-3">
          {story.timeline.length === 0 && <p className="text-muted-foreground text-sm">Tijdlijn vult zich vanzelf wanneer hoofdstukken worden gegenereerd.</p>}
          {story.timeline.map((e) => (
            <div key={e.id} className="border-l-2 border-gold/50 pl-4 py-1">
              <p className="font-semibold text-foreground">{e.title}</p>
              <p className="text-sm text-muted-foreground">{e.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-display text-lg text-foreground mb-2 border-b border-border pb-1">{title}</h3>
      <ul className="space-y-1 text-sm text-muted-foreground list-none">{children}</ul>
    </div>
  );
}

/* ============ STATS ============ */

function StatsTab({ storyId, totalWords }: { storyId: string; totalWords: number }) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const readTime = Math.max(1, Math.round(totalWords / 240));
  const stats = [
    { l: "Hoofdstukken", v: story.chapters.length, i: BookOpen },
    { l: "Totaal woorden", v: totalWords.toLocaleString(), i: Star },
    { l: "Leestijd", v: `${readTime} min`, i: Clock },
    { l: "Personages", v: story.characters.length, i: Users },
    { l: "Locaties", v: story.locations.length, i: MapPin },
    { l: "Facties", v: story.factions.length, i: Shield },
  ];
  return (
    <div>
      <h2 className="font-display text-2xl gradient-gold-text mb-6">Statistieken</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.i;
          return (
            <div key={s.l} className="bg-card border border-border rounded-xl p-5">
              <Icon className="h-5 w-5 text-gold mb-2" />
              <p className="text-3xl font-display gradient-gold-text">{s.v}</p>
              <p className="text-sm text-muted-foreground">{s.l}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Shared simple editor ============ */

function SimpleEditor({
  title, fields, data, onSave, onClose,
}: {
  title: string;
  fields: { k: string; l: string; multi?: boolean }[];
  data: Record<string, string>;
  onSave: (d: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Record<string, string>>(data);
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-gold/40 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin shadow-gold" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl mb-4 gradient-gold-text">{title}</h2>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.k}>
              <Label className="text-xs">{f.l}</Label>
              {f.multi ? (
                <Textarea rows={2} value={d[f.k] ?? ""} onChange={(e) => setD({ ...d, [f.k]: e.target.value })} />
              ) : (
                <Input value={d[f.k] ?? ""} onChange={(e) => setD({ ...d, [f.k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Annuleer</Button>
          <Button variant="hero" onClick={() => { if (!d.name?.trim()) return toast.error("Naam vereist"); onSave(d); }}>Opslaan</Button>
        </div>
      </div>
    </div>
  );
}
