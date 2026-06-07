import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wand2, Plus, Trash2, ChevronDown, Sparkles, Users, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStoryStore } from "@/store/storyStore";
import { generateCharacter } from "@/lib/ai.functions";
import { buildStoryContext } from "@/lib/story-context";
import { toast } from "sonner";
import type { Character, Location } from "@/types/story";

export type CharMode = "include" | "exclude" | "major" | "minor" | "kill" | "disappear";
const MODE_LABELS: Record<CharMode, string> = {
  include: "Verschijnt",
  exclude: "Verschijnt niet",
  major: "Belangrijke rol",
  minor: "Kleine rol",
  kill: "Sterft",
  disappear: "Verdwijnt tijdelijk",
};
const MODE_COLORS: Record<CharMode, string> = {
  include: "bg-gold/20 text-gold",
  exclude: "bg-muted text-muted-foreground line-through",
  major: "bg-primary/20 text-primary",
  minor: "bg-secondary text-foreground/80",
  kill: "bg-destructive/20 text-destructive",
  disappear: "bg-accent/20 text-accent-foreground",
};

interface ManualNewChar { name: string; description: string; relationship: string }
interface NewLoc { name: string; description: string; importance: string; climate: string }

export interface DirectorPayload {
  userChoice?: string;
  directorInstructions: string;
}

interface Props {
  storyId: string;
  generating: boolean;
  quickChoices?: { label: string; description?: string }[];
  onGenerate: (payload: DirectorPayload) => void | Promise<void>;
}

export function StoryDirector({ storyId, generating, quickChoices, onGenerate }: Props) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const addCharacter = useStoryStore((s) => s.addCharacter);
  const addLocation = useStoryStore((s) => s.addLocation);
  const genChar = useServerFn(generateCharacter);

  const [charModes, setCharModes] = useState<Record<string, CharMode | undefined>>({});
  const [manualChars, setManualChars] = useState<ManualNewChar[]>([]);
  const [draftChar, setDraftChar] = useState<ManualNewChar>({ name: "", description: "", relationship: "" });
  const [showCharForm, setShowCharForm] = useState(false);
  const [aiCharBusy, setAiCharBusy] = useState(false);

  const [locMode, setLocMode] = useState<"current" | "existing" | "new">("current");
  const [existingLocId, setExistingLocId] = useState<string>("");
  const [newLoc, setNewLoc] = useState<NewLoc>({ name: "", description: "", importance: "", climate: "" });

  const [extra, setExtra] = useState("");
  const [customChoice, setCustomChoice] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ chars: true, locs: false, extra: false });

  const livingChars = useMemo(() => story.characters.filter((c) => c.status !== "dood"), [story.characters]);

  const cycleMode = (id: string) => {
    const order: (CharMode | undefined)[] = [undefined, "include", "exclude", "major", "minor", "kill", "disappear"];
    const cur = charModes[id];
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setCharModes({ ...charModes, [id]: next });
  };
  const setMode = (id: string, m: CharMode | undefined) =>
    setCharModes({ ...charModes, [id]: m });

  const addManualChar = () => {
    if (!draftChar.name.trim()) return toast.error("Naam vereist");
    setManualChars([...manualChars, draftChar]);
    setDraftChar({ name: "", description: "", relationship: "" });
    setShowCharForm(false);
  };

  const aiGenerateChar = async () => {
    setAiCharBusy(true);
    try {
      const ctx = buildStoryContext(story);
      const c = await genChar({ data: { storyContext: ctx, hint: extra || "introductie voor volgend hoofdstuk" } });
      setManualChars((prev) => [...prev, {
        name: c.name,
        description: `${c.appearance ?? ""}. ${c.personality ?? ""}. Doel: ${c.goals ?? ""}.`,
        relationship: c.relationships ?? "",
      }]);
      // store the full AI-generated character into the encyclopedia immediately so detail is preserved
      addCharacter(storyId, { ...c, status: "levend" });
      toast.success(`${c.name} klaar voor introductie`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setAiCharBusy(false); }
  };

  const removeManual = (i: number) => setManualChars(manualChars.filter((_, idx) => idx !== i));

  const summary = useMemo(() => {
    const appear: string[] = [];
    const noAppear: string[] = [];
    const special: string[] = [];
    for (const c of livingChars) {
      const m = charModes[c.id];
      if (!m) continue;
      if (m === "exclude" || m === "disappear") noAppear.push(`${c.name} (${MODE_LABELS[m]})`);
      else if (m === "kill") special.push(`${c.name} sterft`);
      else appear.push(`${c.name} (${MODE_LABELS[m]})`);
    }
    const newC = manualChars.map((c) => c.name);
    const loc =
      locMode === "current" ? "Huidige locatie behouden" :
      locMode === "existing" ? (story.locations.find((l) => l.id === existingLocId)?.name ?? "—") :
      newLoc.name ? `Nieuwe locatie: ${newLoc.name}` : "Nieuwe locatie (naamloos)";
    return { appear, noAppear, special, newC, loc };
  }, [charModes, livingChars, manualChars, locMode, existingLocId, newLoc, story.locations]);

  const buildInstructions = (): string => {
    const lines: string[] = [];

    // Character directives
    const include = livingChars.filter((c) => charModes[c.id] === "include").map((c) => c.name);
    const exclude = livingChars.filter((c) => charModes[c.id] === "exclude").map((c) => c.name);
    const major = livingChars.filter((c) => charModes[c.id] === "major").map((c) => c.name);
    const minor = livingChars.filter((c) => charModes[c.id] === "minor").map((c) => c.name);
    const kill = livingChars.filter((c) => charModes[c.id] === "kill").map((c) => c.name);
    const disappear = livingChars.filter((c) => charModes[c.id] === "disappear").map((c) => c.name);

    if (include.length) lines.push(`- VERPLICHT aanwezig in dit hoofdstuk: ${include.join(", ")}.`);
    if (major.length) lines.push(`- Deze personages krijgen een GROTE, centrale rol: ${major.join(", ")}.`);
    if (minor.length) lines.push(`- Deze personages krijgen slechts een kleine, zijdelingse vermelding: ${minor.join(", ")}.`);
    if (exclude.length) lines.push(`- VERBODEN: deze personages mogen NIET actief deelnemen of voorkomen in dit hoofdstuk: ${exclude.join(", ")}.`);
    if (disappear.length) lines.push(`- Deze personages verdwijnen tijdelijk uit het verhaal (laat het op natuurlijke wijze gebeuren): ${disappear.join(", ")}.`);
    if (kill.length) lines.push(`- Deze personages MOETEN sterven in dit hoofdstuk, op een passende, betekenisvolle manier: ${kill.join(", ")}.`);

    if (manualChars.length) {
      lines.push(`- Introduceer in dit hoofdstuk de volgende NIEUWE personages voor het eerst:`);
      for (const c of manualChars) {
        lines.push(`    • ${c.name}${c.description ? ` — ${c.description}` : ""}${c.relationship ? ` Relatie: ${c.relationship}` : ""}`);
      }
    }

    if (locMode === "existing" && existingLocId) {
      const l = story.locations.find((x) => x.id === existingLocId);
      if (l) lines.push(`- De personages reizen naar / bevinden zich in de bestaande locatie: ${l.name}.`);
    } else if (locMode === "new" && newLoc.name.trim()) {
      lines.push(`- Introduceer in dit hoofdstuk een NIEUWE locatie genaamd "${newLoc.name}"${newLoc.description ? ` — ${newLoc.description}` : ""}${newLoc.climate ? ` (klimaat: ${newLoc.climate})` : ""}${newLoc.importance ? `. Belang: ${newLoc.importance}` : ""}.`);
    }

    if (extra.trim()) lines.push(`- Extra regie-instructies van de auteur: ${extra.trim()}`);

    if (lines.length === 0) return "";
    return `De volgende regie-instructies zijn VERPLICHT en moeten strikt worden gevolgd:\n${lines.join("\n")}`;
  };

  const handleGenerate = async (chosenQuick?: string) => {
    // Persist new locations & manual chars (chars already added) BEFORE generation
    if (locMode === "new" && newLoc.name.trim()) {
      addLocation(storyId, {
        name: newLoc.name,
        description: newLoc.description,
        climate: newLoc.climate,
      } as Omit<Location, "id">);
    }
    // Add manually entered (non-AI) new characters that aren't already in the store
    const existingNames = new Set(story.characters.map((c) => c.name));
    for (const c of manualChars) {
      if (!existingNames.has(c.name)) {
        addCharacter(storyId, {
          name: c.name,
          personality: c.description,
          relationships: c.relationship,
          status: "levend",
        } as Omit<Character, "id">);
      }
    }

    const userChoice = chosenQuick ?? (customChoice.trim() || undefined);
    const directorInstructions = buildInstructions();
    await onGenerate({ userChoice, directorInstructions });

    // Reset transient director state
    setCharModes({});
    setManualChars([]);
    setNewLoc({ name: "", description: "", importance: "", climate: "" });
    setLocMode("current");
    setExistingLocId("");
    setExtra("");
    setCustomChoice("");
  };

  const hasDirectives =
    Object.values(charModes).some(Boolean) ||
    manualChars.length > 0 ||
    locMode !== "current" ||
    extra.trim().length > 0;

  return (
    <div className="bg-card border border-gold/30 rounded-xl p-6 shadow-card space-y-5">
      <div>
        <h3 className="font-display text-xl flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" /> Story Director</h3>
        <p className="text-sm text-muted-foreground">Regisseer hoofdstuk {story.chapters.length + 1}: bepaal welke personages, locaties en gebeurtenissen verschijnen.</p>
      </div>

      {/* Quick choices from previous chapter */}
      {quickChoices && quickChoices.length > 0 && (
        <div>
          <Label className="text-xs uppercase tracking-wider text-gold/80">Snelle richting (optioneel)</Label>
          <div className="grid sm:grid-cols-3 gap-2 mt-2">
            {quickChoices.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleGenerate(opt.label + (opt.description ? ` — ${opt.description}` : ""))}
                disabled={generating}
                className="text-left p-3 rounded-lg border border-border hover:border-gold hover:bg-gold/5 transition-all disabled:opacity-50 text-sm"
              >
                <div className="text-[10px] text-gold uppercase tracking-wide mb-0.5">Optie {i + 1}</div>
                <div className="font-semibold">{opt.label}</div>
                {opt.description && <div className="text-xs text-muted-foreground line-clamp-2">{opt.description}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Characters */}
      <DirectorSection
        title="Personages"
        icon={Users}
        count={Object.values(charModes).filter(Boolean).length + manualChars.length}
        open={open.chars}
        onToggle={() => setOpen({ ...open, chars: !open.chars })}
      >
        {livingChars.length === 0 && <p className="text-xs text-muted-foreground">Nog geen personages — voeg ze toe via het Personages-tabblad.</p>}
        <div className="space-y-1.5">
          {livingChars.map((c) => {
            const m = charModes[c.id];
            return (
              <div key={c.id} className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => cycleMode(c.id)}
                  className="flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors"
                >
                  <span className="font-medium">{c.name}</span>
                </button>
                <select
                  value={m ?? ""}
                  onChange={(e) => setMode(c.id, (e.target.value || undefined) as CharMode | undefined)}
                  className="h-8 text-xs rounded-md border border-input bg-input px-2"
                >
                  <option value="">— geen regie —</option>
                  {(Object.keys(MODE_LABELS) as CharMode[]).map((k) => (
                    <option key={k} value={k}>{MODE_LABELS[k]}</option>
                  ))}
                </select>
                {m && <span className={`text-[10px] px-1.5 py-0.5 rounded ${MODE_COLORS[m]}`}>{MODE_LABELS[m]}</span>}
              </div>
            );
          })}
        </div>

        {/* New characters */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs uppercase tracking-wider text-gold/80">Nieuwe personages</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowCharForm((s) => !s)}>
                <Pencil className="h-3 w-3" /> Introduceer
              </Button>
              <Button size="sm" variant="hero" onClick={aiGenerateChar} disabled={aiCharBusy}>
                {aiCharBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Genereer
              </Button>
            </div>
          </div>
          {showCharForm && (
            <div className="space-y-2 bg-secondary/30 p-3 rounded-md mb-2">
              <Input placeholder="Naam" value={draftChar.name} onChange={(e) => setDraftChar({ ...draftChar, name: e.target.value })} />
              <Textarea rows={2} placeholder="Beschrijving" value={draftChar.description} onChange={(e) => setDraftChar({ ...draftChar, description: e.target.value })} />
              <Input placeholder="Relatie tot bestaande personages" value={draftChar.relationship} onChange={(e) => setDraftChar({ ...draftChar, relationship: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowCharForm(false)}>Annuleer</Button>
                <Button size="sm" onClick={addManualChar}><Plus className="h-3 w-3" /> Voeg toe</Button>
              </div>
            </div>
          )}
          {manualChars.length > 0 && (
            <ul className="space-y-1">
              {manualChars.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-secondary/30 rounded px-2 py-1">
                  <span><span className="text-gold">{c.name}</span>{c.description && <span className="text-muted-foreground"> — {c.description.slice(0, 60)}</span>}</span>
                  <button onClick={() => removeManual(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DirectorSection>

      {/* Locations */}
      <DirectorSection
        title="Locatie"
        icon={MapPin}
        count={locMode === "current" ? 0 : 1}
        open={open.locs}
        onToggle={() => setOpen({ ...open, locs: !open.locs })}
      >
        <div className="space-y-2">
          {(["current", "existing", "new"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="locmode" checked={locMode === m} onChange={() => setLocMode(m)} />
              {m === "current" ? "Gebruik huidige locatie" : m === "existing" ? "Reis naar bestaande locatie" : "Introduceer nieuwe locatie"}
            </label>
          ))}
          {locMode === "existing" && (
            <select value={existingLocId} onChange={(e) => setExistingLocId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input px-3 text-sm">
              <option value="">— kies locatie —</option>
              {story.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {locMode === "new" && (
            <div className="space-y-2 bg-secondary/30 p-3 rounded-md">
              <Input placeholder="Naam" value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })} />
              <Textarea rows={2} placeholder="Beschrijving" value={newLoc.description} onChange={(e) => setNewLoc({ ...newLoc, description: e.target.value })} />
              <Input placeholder="Belang in het verhaal" value={newLoc.importance} onChange={(e) => setNewLoc({ ...newLoc, importance: e.target.value })} />
              <Input placeholder="Klimaat" value={newLoc.climate} onChange={(e) => setNewLoc({ ...newLoc, climate: e.target.value })} />
            </div>
          )}
        </div>
      </DirectorSection>

      {/* Extra instructions */}
      <DirectorSection
        title="Extra instructies"
        icon={Pencil}
        count={extra.trim() ? 1 : 0}
        open={open.extra}
        onToggle={() => setOpen({ ...open, extra: !open.extra })}
      >
        <Textarea
          rows={4}
          placeholder="Bijv. 'Laat Kaelen een bondgenoot ontmoeten', 'Introduceer een draak', 'Voeg een groot gevecht toe', 'Laat niemand sterven'..."
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
        />
      </DirectorSection>

      {/* Summary */}
      {hasDirectives && (
        <div className="bg-secondary/30 border border-gold/20 rounded-lg p-4 text-sm">
          <h4 className="font-display text-gold uppercase text-xs tracking-wider mb-2">Volgend hoofdstuk — overzicht</h4>
          <div className="space-y-1">
            {summary.appear.length > 0 && <p><span className="text-gold">Verschijnen:</span> {summary.appear.join(", ")}</p>}
            {summary.noAppear.length > 0 && <p><span className="text-destructive">Niet aanwezig:</span> {summary.noAppear.join(", ")}</p>}
            {summary.special.length > 0 && <p><span className="text-destructive">Speciaal:</span> {summary.special.join(", ")}</p>}
            {summary.newC.length > 0 && <p><span className="text-primary">Nieuwe personages:</span> {summary.newC.join(", ")}</p>}
            <p><span className="text-foreground/80">Locatie:</span> {summary.loc}</p>
            {extra.trim() && <p><span className="text-foreground/80">Instructies:</span> {extra.trim()}</p>}
          </div>
        </div>
      )}

      {/* Custom action + generate */}
      <div className="flex gap-2">
        <Input
          value={customChoice}
          onChange={(e) => setCustomChoice(e.target.value)}
          placeholder="Optioneel: typ een specifieke actie voor de hoofdpersoon..."
          disabled={generating}
        />
        <Button variant="hero" onClick={() => handleGenerate()} disabled={generating}>
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />} Genereer hoofdstuk
        </Button>
      </div>
    </div>
  );
}

function DirectorSection({
  title, icon: Icon, count, open, onToggle, children,
}: { title: string; icon: React.ElementType; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gold" />
          <span className="font-medium text-sm">{title}</span>
          {count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/20 text-gold">{count}</span>}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}
