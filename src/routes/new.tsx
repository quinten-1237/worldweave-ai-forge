import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GENRES, TONES, AGE_CATEGORIES, LANGUAGES } from "@/lib/constants";
import { useStoryStore } from "@/store/storyStore";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/new")({
  head: () => ({ meta: [{ title: "Nieuw Verhaal — StoryForge AI" }] }),
  component: NewStory,
});

function NewStory() {
  const navigate = useNavigate();
  const createStory = useStoryStore((s) => s.createStory);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [ageCategory, setAgeCategory] = useState<string>("Volwassenen");
  const [language, setLanguage] = useState<string>("Nederlands");
  const [genres, setGenres] = useState<string[]>([]);
  const [tones, setTones] = useState<string[]>([]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = () => {
    if (!title.trim()) return toast.error("Geef je verhaal een titel");
    const id = createStory({
      title: title.trim(),
      subtitle,
      description,
      ageCategory,
      language,
      genres,
      tones,
    });
    toast.success("Verhaal aangemaakt");
    navigate({ to: "/story/$id", params: { id } });
  };

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-3xl">
        <div className="flex items-center gap-2 text-gold mb-3">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs uppercase tracking-widest">Nieuw Verhaal</span>
        </div>
        <h1 className="font-display text-4xl gradient-gold-text mb-2">Begin een nieuwe wereld</h1>
        <p className="text-muted-foreground mb-8">
          Vul de basis in. Je kunt later eindeloos uitbreiden: personages, locaties, facties.
        </p>

        <div className="space-y-6 bg-card border border-border rounded-xl p-6">
          <Field label="Titel *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="De Schaduw van Eldoria" />
          </Field>
          <Field label="Ondertitel">
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Boek I van de Kroniek" />
          </Field>
          <Field label="Beschrijving / premisse">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="In een wereld waar de zon nooit meer opkomt..."
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Leeftijdscategorie">
              <select
                value={ageCategory}
                onChange={(e) => setAgeCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-input px-3 text-sm"
              >
                {AGE_CATEGORIES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Taal">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-input px-3 text-sm"
              >
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Genres (meerdere)">
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <Chip key={g} active={genres.includes(g)} onClick={() => toggle(genres, setGenres, g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Toon van het verhaal">
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <Chip key={t} active={tones.includes(t)} onClick={() => toggle(tones, setTones, t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/" })}>Annuleer</Button>
            <Button variant="hero" size="lg" onClick={submit}>Maak Verhaal</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm mb-1.5 block text-foreground/90">{label}</Label>
      {children}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
        active
          ? "bg-gold text-primary-foreground border-gold shadow-gold"
          : "border-border text-muted-foreground hover:border-gold/50 hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}
