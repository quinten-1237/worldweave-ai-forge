import { useMemo, useState, useEffect } from "react";
import { Loader2, Wand2, Plus, Trash2, ChevronDown, Sparkles, Users, MapPin, Calendar, Target, Heart, Save, Copy, Eye, ScrollText, Pencil, Download, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStoryStore } from "@/store/storyStore";
import {
  type ChapterPlan,
  type ChapterPreset,
  type CharacterRole,
  type PlannedCharacter,
  type RelationshipChange,
  type NewLocationDraft,
  EVENT_CATEGORIES, STORY_GOALS, RELATIONSHIP_TYPES,
  ROLE_LABEL, LENGTH_LABEL, LENGTH_WORDS,
  emptyPlan, defaultPlanFromContinuity,
} from "@/lib/chapter-plan";
import { deriveContinuity } from "@/lib/continuity";
import { toast } from "sonner";

interface Props {
  storyId: string;
  generating: boolean;
  onGenerate: (plan: ChapterPlan) => void | Promise<void>;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export function ChapterPlanner({ storyId, generating, onGenerate }: Props) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const savePreset = useStoryStore((s) => s.saveChapterPreset);
  const updatePreset = useStoryStore((s) => s.updateChapterPreset);
  const duplicatePreset = useStoryStore((s) => s.duplicateChapterPreset);
  const deletePreset = useStoryStore((s) => s.deleteChapterPreset);

  const [plan, setPlan] = useState<ChapterPlan>(() => defaultPlanFromContinuity(story));
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({
    chars: true, locs: true, assign: false, events: false, goals: false, rels: false, length: true, extra: false,
    preview: true, continuity: true,
  });

  // Keep plan in sync if the story's character/location list grows
  useEffect(() => {
    setPlan((prev) => {
      const known = new Set(prev.characters.map((p) => p.characterId));
      const additions: PlannedCharacter[] = story.characters
        .filter((c) => c.status !== "dood" && !known.has(c.id))
        .map((c) => ({
          characterId: c.id, role: "supporting", hasDialogue: false, viewpoint: false, keyScene: false,
          locationId: c.currentLocationId,
        }));
      if (additions.length === 0) return prev;
      return { ...prev, characters: [...prev.characters, ...additions] };
    });
  }, [story.characters]);

  const chapterNumber = story.chapters.length + 1;
  const lastChapter = story.chapters[story.chapters.length - 1];

  const updateChar = (id: string, patch: Partial<PlannedCharacter>) =>
    setPlan((p) => ({
      ...p,
      characters: p.characters.map((c) => (c.characterId === id ? { ...c, ...patch } : c)),
    }));

  const toggleLocation = (id: string) =>
    setPlan((p) => ({
      ...p,
      locationIds: p.locationIds.includes(id) ? p.locationIds.filter((x) => x !== id) : [...p.locationIds, id],
    }));

  const addNewLocation = () =>
    setPlan((p) => ({ ...p, newLocations: [...p.newLocations, { name: "", description: "", climate: "" }] }));

  const updateNewLocation = (i: number, patch: Partial<NewLocationDraft>) =>
    setPlan((p) => ({
      ...p,
      newLocations: p.newLocations.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));

  const removeNewLocation = (i: number) =>
    setPlan((p) => ({ ...p, newLocations: p.newLocations.filter((_, idx) => idx !== i) }));

  const toggleEvent = (e: string) =>
    setPlan((p) => ({ ...p, events: p.events.includes(e) ? p.events.filter((x) => x !== e) : [...p.events, e] }));

  const toggleGoal = (g: string) =>
    setPlan((p) => ({ ...p, goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g] }));

  const addRelationship = () =>
    setPlan((p) => ({
      ...p,
      relationshipChanges: [...p.relationshipChanges, { id: uid(), a: "", b: "", type: "friends", note: "" }],
    }));

  const updateRelationship = (id: string, patch: Partial<RelationshipChange>) =>
    setPlan((p) => ({
      ...p,
      relationshipChanges: p.relationshipChanges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const removeRelationship = (id: string) =>
    setPlan((p) => ({ ...p, relationshipChanges: p.relationshipChanges.filter((r) => r.id !== id) }));

  // Locations available for assignment = selected existing + new (by name)
  const assignableLocations = useMemo(() => {
    const existing = story.locations.filter((l) => plan.locationIds.includes(l.id))
      .map((l) => ({ value: l.id, label: l.name }));
    const drafts = plan.newLocations.filter((n) => n.name.trim()).map((n) => ({ value: n.name, label: `${n.name} (nieuw)` }));
    return [...existing, ...drafts];
  }, [story.locations, plan.locationIds, plan.newLocations]);

  const includedChars = plan.characters.filter((c) => c.role !== "absent");

  const handleGenerate = () => {
    if (plan.newLocations.some((l) => !l.name.trim())) {
      return toast.error("Geef elke nieuwe locatie een naam");
    }
    onGenerate(plan);
  };

  const handleSavePreset = () => {
    const name = prompt("Naam voor deze planning?");
    if (!name?.trim()) return;
    const p = savePreset(storyId, name.trim(), plan);
    setActivePresetId(p.id);
    toast.success("Planning opgeslagen");
  };

  const handleUpdateActivePreset = () => {
    if (!activePresetId) return;
    updatePreset(storyId, activePresetId, { plan });
    toast.success("Planning bijgewerkt");
  };

  const handleRenameActivePreset = () => {
    if (!activePresetId) return;
    const current = (story.chapterPresets ?? []).find((p) => p.id === activePresetId);
    const name = prompt("Nieuwe naam?", current?.name ?? "");
    if (!name?.trim()) return;
    updatePreset(storyId, activePresetId, { name: name.trim() });
    toast.success("Naam bijgewerkt");
  };

  const handleDuplicateActivePreset = () => {
    if (!activePresetId) return;
    const copy = duplicatePreset(storyId, activePresetId);
    if (copy) {
      setActivePresetId(copy.id);
      setPlan(copy.plan);
      toast.success("Planning gedupliceerd");
    }
  };

  const handleDeleteActivePreset = () => {
    if (!activePresetId) return;
    if (!confirm("Verwijder deze opgeslagen planning?")) return;
    deletePreset(storyId, activePresetId);
    setActivePresetId(null);
    toast.success("Verwijderd");
  };

  const loadPreset = (preset: ChapterPreset) => {
    setPlan(preset.plan);
    setActivePresetId(preset.id);
    toast.success(`"${preset.name}" geladen`);
  };

  const duplicatePrevious = () => {
    if (!lastChapter?.plan) return toast.error("Vorig hoofdstuk heeft geen planning");
    setPlan(lastChapter.plan);
    setActivePresetId(null);
    toast.success("Vorige planning gedupliceerd");
  };

  const resetPlan = () => {
    setPlan(defaultPlanFromContinuity(story));
    setActivePresetId(null);
  };

  const presets = story.chapterPresets ?? [];
  const continuity = useMemo(() => deriveContinuity(story), [story]);

  return (
    <div className="bg-card border border-gold/30 rounded-xl p-6 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" /> Hoofdstuk-planner — H{chapterNumber}
          </h3>
          <p className="text-sm text-muted-foreground">
            Plan elk hoofdstuk als een serieaflevering: personages, locaties, gebeurtenissen, doelen, lengte.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={resetPlan} disabled={generating}>Reset</Button>
          {lastChapter?.plan && (
            <Button size="sm" variant="outline" onClick={duplicatePrevious} disabled={generating}>
              <Copy className="h-3 w-3" /> Dupliceer vorige
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleSavePreset} disabled={generating}>
            <Save className="h-3 w-3" /> Bewaar
          </Button>
          {presets.length > 0 && (
            <select
              className="h-9 text-xs rounded-md border border-input bg-input px-2"
              value={activePresetId ?? ""}
              onChange={(e) => {
                const p = presets.find((x) => x.id === e.target.value);
                if (p) loadPreset(p);
                else setActivePresetId(null);
              }}
            >
              <option value="">Laad planning…</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {activePresetId && (
            <>
              <Button size="sm" variant="outline" onClick={handleUpdateActivePreset} disabled={generating} title="Sla huidige planning op naar geselecteerd preset">
                <Save className="h-3 w-3" /> Update
              </Button>
              <Button size="sm" variant="outline" onClick={handleRenameActivePreset} disabled={generating}>
                <Pencil className="h-3 w-3" /> Hernoem
              </Button>
              <Button size="sm" variant="outline" onClick={handleDuplicateActivePreset} disabled={generating}>
                <Copy className="h-3 w-3" /> Dupliceer
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDeleteActivePreset} disabled={generating}>
                <Trash2 className="h-3 w-3" /> Wis
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Characters */}
      <Section title="Personages" icon={Users} count={includedChars.length} open={open.chars} onToggle={() => setOpen({ ...open, chars: !open.chars })}>
        {plan.characters.length === 0 && (
          <p className="text-xs text-muted-foreground">Nog geen personages — voeg ze toe via het Personages-tabblad.</p>
        )}
        <div className="space-y-1.5">
          {plan.characters.map((pc) => {
            const c = story.characters.find((x) => x.id === pc.characterId);
            if (!c) return null;
            return (
              <div key={pc.characterId} className="flex items-center gap-2 flex-wrap text-sm bg-secondary/20 rounded px-2 py-1.5">
                <span className="font-medium flex-1 min-w-[120px]">{c.name}</span>
                <select
                  value={pc.role}
                  onChange={(e) => updateChar(pc.characterId, { role: e.target.value as CharacterRole })}
                  className="h-8 text-xs rounded border border-input bg-input px-2"
                >
                  {(Object.keys(ROLE_LABEL) as CharacterRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
                {pc.role !== "absent" && (
                  <>
                    <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={pc.hasDialogue} onChange={(e) => updateChar(pc.characterId, { hasDialogue: e.target.checked })} /> dialoog</label>
                    <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={pc.viewpoint} onChange={(e) => updateChar(pc.characterId, { viewpoint: e.target.checked })} /> POV</label>
                    <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={pc.keyScene} onChange={(e) => updateChar(pc.characterId, { keyScene: e.target.checked })} /> sleutel-scene</label>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Locations */}
      <Section title="Locaties" icon={MapPin} count={plan.locationIds.length + plan.newLocations.length} open={open.locs} onToggle={() => setOpen({ ...open, locs: !open.locs })}>
        <div className="grid sm:grid-cols-2 gap-1.5">
          {story.locations.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm bg-secondary/20 rounded px-2 py-1.5 cursor-pointer hover:bg-secondary/40">
              <input type="checkbox" checked={plan.locationIds.includes(l.id)} onChange={() => toggleLocation(l.id)} />
              {l.name}
            </label>
          ))}
        </div>
        {plan.newLocations.length > 0 && (
          <div className="mt-3 space-y-2">
            {plan.newLocations.map((nl, i) => (
              <div key={i} className="bg-secondary/30 p-3 rounded-md space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Naam *" value={nl.name} onChange={(e) => updateNewLocation(i, { name: e.target.value })} />
                  <Button size="icon" variant="ghost" onClick={() => removeNewLocation(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="Beschrijving" value={nl.description ?? ""} onChange={(e) => updateNewLocation(i, { description: e.target.value })} />
                <Input placeholder="Klimaat" value={nl.climate ?? ""} onChange={(e) => updateNewLocation(i, { climate: e.target.value })} />
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="mt-2" onClick={addNewLocation}>
          <Plus className="h-3 w-3" /> Nieuwe locatie
        </Button>
      </Section>

      {/* Character → Location assignment */}
      {assignableLocations.length > 0 && includedChars.length > 0 && (
        <Section title="Wie is waar?" icon={MapPin} count={includedChars.filter((c) => c.locationId).length} open={open.assign} onToggle={() => setOpen({ ...open, assign: !open.assign })}>
          <p className="text-xs text-muted-foreground mb-2">Personages verschijnen alleen op hun toegewezen locatie.</p>
          <div className="space-y-1.5">
            {includedChars.map((pc) => {
              const c = story.characters.find((x) => x.id === pc.characterId);
              if (!c) return null;
              return (
                <div key={pc.characterId} className="flex items-center gap-2 text-sm bg-secondary/20 rounded px-2 py-1.5">
                  <span className="flex-1">{c.name}</span>
                  <select
                    value={pc.locationId ?? ""}
                    onChange={(e) => updateChar(pc.characterId, { locationId: e.target.value || undefined })}
                    className="h-8 text-xs rounded border border-input bg-input px-2 min-w-[160px]"
                  >
                    <option value="">— kies locatie —</option>
                    {assignableLocations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Events */}
      <Section title="Gebeurtenissen" icon={Calendar} count={plan.events.length + (plan.customEvent?.trim() ? 1 : 0)} open={open.events} onToggle={() => setOpen({ ...open, events: !open.events })}>
        <div className="space-y-3">
          {EVENT_CATEGORIES.map((cat) => (
            <div key={cat.category}>
              <Label className="text-[10px] uppercase tracking-wider text-gold/80">{cat.category}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {cat.events.map((e) => {
                  const active = plan.events.includes(e);
                  return (
                    <button
                      key={e}
                      onClick={() => toggleEvent(e)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${active ? "bg-gold/20 border-gold text-gold" : "border-border hover:border-gold/50"}`}
                    >{e}</button>
                  );
                })}
              </div>
            </div>
          ))}
          <Input
            placeholder="Eigen gebeurtenis..."
            value={plan.customEvent ?? ""}
            onChange={(e) => setPlan((p) => ({ ...p, customEvent: e.target.value }))}
          />
        </div>
      </Section>

      {/* Goals */}
      <Section title="Doelen" icon={Target} count={plan.goals.length} open={open.goals} onToggle={() => setOpen({ ...open, goals: !open.goals })}>
        <div className="flex flex-wrap gap-1.5">
          {STORY_GOALS.map((g) => {
            const active = plan.goals.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggleGoal(g)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${active ? "bg-primary/20 border-primary text-primary" : "border-border hover:border-primary/50"}`}
              >{g}</button>
            );
          })}
        </div>
      </Section>

      {/* Relationships */}
      <Section title="Relatie-veranderingen" icon={Heart} count={plan.relationshipChanges.length} open={open.rels} onToggle={() => setOpen({ ...open, rels: !open.rels })}>
        <div className="space-y-2">
          {plan.relationshipChanges.map((r) => (
            <div key={r.id} className="flex items-center gap-2 bg-secondary/20 rounded px-2 py-1.5 flex-wrap">
              <select value={r.a} onChange={(e) => updateRelationship(r.id, { a: e.target.value })} className="h-8 text-xs rounded border border-input bg-input px-2">
                <option value="">A</option>
                {story.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={r.b} onChange={(e) => updateRelationship(r.id, { b: e.target.value })} className="h-8 text-xs rounded border border-input bg-input px-2">
                <option value="">B</option>
                {story.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={r.type} onChange={(e) => updateRelationship(r.id, { type: e.target.value })} className="h-8 text-xs rounded border border-input bg-input px-2">
                {RELATIONSHIP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <Input className="h-8 text-xs flex-1 min-w-[120px]" placeholder="Notitie (optioneel)" value={r.note ?? ""} onChange={(e) => updateRelationship(r.id, { note: e.target.value })} />
              <Button size="icon" variant="ghost" onClick={() => removeRelationship(r.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addRelationship}><Plus className="h-3 w-3" /> Verandering toevoegen</Button>
        </div>
      </Section>

      {/* Length */}
      <Section title="Lengte" icon={Sparkles} count={0} open={open.length} onToggle={() => setOpen({ ...open, length: !open.length })}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LENGTH_WORDS) as Array<keyof typeof LENGTH_WORDS>).map((k) => (
            <button
              key={k}
              onClick={() => setPlan((p) => ({ ...p, length: k }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${plan.length === k ? "bg-gold/20 border-gold text-gold" : "border-border hover:border-gold/50"}`}
            >{LENGTH_LABEL[k]}</button>
          ))}
        </div>
      </Section>

      {/* Extra */}
      <Section title="Lezerskeuze & extra instructies" icon={Sparkles} count={(plan.userChoice?.trim() ? 1 : 0) + (plan.extra?.trim() ? 1 : 0)} open={open.extra} onToggle={() => setOpen({ ...open, extra: !open.extra })}>
        <div className="space-y-2">
          {lastChapter?.choices && lastChapter.choices.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-gold/80">Suggesties uit vorig hoofdstuk</Label>
              <div className="grid sm:grid-cols-3 gap-2 mt-1">
                {lastChapter.choices.map((opt, i) => {
                  const text = opt.label + (opt.description ? ` — ${opt.description}` : "");
                  const active = plan.userChoice === text;
                  return (
                    <button
                      key={i}
                      onClick={() => setPlan((p) => ({ ...p, userChoice: active ? undefined : text }))}
                      className={`text-left p-2 rounded-lg border text-xs transition-all ${active ? "border-gold bg-gold/5" : "border-border hover:border-gold"}`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      {opt.description && <div className="text-muted-foreground line-clamp-2">{opt.description}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Input placeholder="Specifieke actie voor hoofdpersoon (optioneel)" value={plan.userChoice ?? ""} onChange={(e) => setPlan((p) => ({ ...p, userChoice: e.target.value }))} />
          <Textarea rows={3} placeholder="Vrije regie-aanwijzingen..." value={plan.extra ?? ""} onChange={(e) => setPlan((p) => ({ ...p, extra: e.target.value }))} />
        </div>
      </Section>

      {/* Continuity summary — derived from prior chapters */}
      <Section title="Continuïteit (vorige hoofdstukken)" icon={ScrollText} count={continuity.characterLocations.length + continuity.deadCharacters.length + continuity.relationships.length} open={open.continuity} onToggle={() => setOpen({ ...open, continuity: !open.continuity })}>
        <div className="space-y-3 text-xs">
          {continuity.characterLocations.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-gold/80">Laatste bekende locaties</Label>
              <ul className="mt-1 space-y-0.5">
                {continuity.characterLocations.map((cl) => (
                  <li key={cl.name} className="flex items-center gap-2">
                    <span className="font-medium">{cl.name}</span>
                    <span className="text-muted-foreground">→ {cl.location ?? "onbekend"}</span>
                    <span className="text-[10px] px-1.5 rounded-full bg-secondary text-muted-foreground">{cl.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {continuity.deadCharacters.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-destructive">Overleden (blijven dood)</Label>
              <p className="mt-1 text-muted-foreground">{continuity.deadCharacters.join(", ")}</p>
            </div>
          )}
          {continuity.injuries.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-gold/80">Verwondingen</Label>
              <ul className="mt-1 space-y-0.5">
                {continuity.injuries.map((i) => (
                  <li key={i.name}><span className="font-medium">{i.name}:</span> <span className="text-muted-foreground">{i.injuries.join("; ")}</span></li>
                ))}
              </ul>
            </div>
          )}
          {continuity.relationships.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-gold/80">Actieve relaties</Label>
              <ul className="mt-1 space-y-0.5">
                {continuity.relationships.map((r, i) => (
                  <li key={i}><span className="font-medium">{r.a} ↔ {r.b}</span> <span className="text-muted-foreground">— {r.type}{r.note ? ` (${r.note})` : ""}</span></li>
                ))}
              </ul>
            </div>
          )}
          {continuity.characterLocations.length === 0 && continuity.deadCharacters.length === 0 && continuity.relationships.length === 0 && (
            <p className="text-muted-foreground">Nog geen continuïteitsgegevens — dit is je eerste hoofdstuk.</p>
          )}
        </div>
      </Section>

      {/* Read-only preview of what will be sent to the AI */}
      <Section title="Voorvertoning hoofdstuk-opzet" icon={Eye} count={includedChars.length + plan.events.length + (plan.customEvent?.trim() ? 1 : 0)} open={open.preview} onToggle={() => setOpen({ ...open, preview: !open.preview })}>
        <div className="space-y-3 text-xs">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-gold/80">Opgenomen personages</Label>
            {includedChars.length === 0 ? (
              <p className="mt-1 text-muted-foreground">Geen personages geselecteerd.</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {includedChars.map((pc) => {
                  const c = story.characters.find((x) => x.id === pc.characterId);
                  if (!c) return null;
                  const locName = pc.locationId
                    ? (story.locations.find((l) => l.id === pc.locationId)?.name
                        ?? plan.newLocations.find((n) => n.name === pc.locationId)?.name)
                    : null;
                  return (
                    <li key={pc.characterId} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{c.name}</span>
                      <span className="px-1.5 rounded-full bg-gold/15 text-gold text-[10px]">{ROLE_LABEL[pc.role]}</span>
                      {pc.viewpoint && <span className="px-1.5 rounded-full bg-primary/15 text-primary text-[10px]">POV</span>}
                      {pc.hasDialogue && <span className="px-1.5 rounded-full bg-secondary text-muted-foreground text-[10px]">dialoog</span>}
                      {pc.keyScene && <span className="px-1.5 rounded-full bg-secondary text-muted-foreground text-[10px]">sleutel-scene</span>}
                      {locName && <span className="text-muted-foreground">@ {locName}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-gold/80">Gebeurtenissen</Label>
            {plan.events.length === 0 && !plan.customEvent?.trim() ? (
              <p className="mt-1 text-muted-foreground">Geen gebeurtenissen geselecteerd.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {plan.events.map((e) => <span key={e} className="px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">{e}</span>)}
                {plan.customEvent?.trim() && <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{plan.customEvent.trim()}</span>}
              </div>
            )}
          </div>
          <div className="text-muted-foreground">
            Lengte: <span className="text-foreground">{LENGTH_LABEL[plan.length]}</span>
            {plan.goals.length > 0 && <> • Doelen: <span className="text-foreground">{plan.goals.join(", ")}</span></>}
          </div>
        </div>
      </Section>

      <div className="pt-2 border-t border-border flex justify-end">
        <Button variant="hero" size="lg" onClick={handleGenerate} disabled={generating}>
          {generating ? <><Loader2 className="animate-spin" /> Schrijven...</> : <><Wand2 /> Genereer hoofdstuk {chapterNumber}</>}
        </Button>
      </div>
    </div>
  );
}

function Section({
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
