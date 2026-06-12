import type { Story } from "@/types/story";

export interface ContinuityFact<T> {
  value: T;
  source: string;
}

export interface ContinuityCharacterLocation {
  name: string;
  location?: string;
  status: string;
  source: string;
}

export interface ContinuityInjury {
  name: string;
  injuries: string[];
  source: string;
}

export interface ContinuityDeath {
  name: string;
  source: string;
}

export interface ContinuityRelationship {
  a: string;
  b: string;
  type: string;
  note?: string;
  source: string;
}

export interface ContinuityFacts {
  characterLocations: ContinuityCharacterLocation[];
  deadCharacters: ContinuityDeath[];
  missingCharacters: ContinuityDeath[];
  injuries: ContinuityInjury[];
  relationships: ContinuityRelationship[];
  ongoingPlots: string[];
  /** Vaste opzet uit de verhaal-wizard (alleen aanwezig als ingevuld). */
  storySetup?: { beginningState?: string; endGoal?: string };
}

/** Find the most recent chapter whose plan assigned a location to the character. */
function findLastLocationSource(story: Story, characterId: string): string {
  for (let i = story.chapters.length - 1; i >= 0; i--) {
    const ch = story.chapters[i];
    const pc = ch.plan?.characters.find((p) => p.characterId === characterId && p.locationId);
    if (pc) return `Hoofdstuk ${ch.number} planning`;
  }
  return "Personage-profiel";
}

export function deriveContinuity(story: Story): ContinuityFacts {
  const locName = new Map(story.locations.map((l) => [l.id, l.name]));
  const charName = new Map(story.characters.map((c) => [c.id, c.name]));

  return {
    characterLocations: story.characters
      .filter((c) => c.status !== "dood")
      .map((c) => ({
        name: c.name,
        location: c.currentLocationId ? locName.get(c.currentLocationId) : undefined,
        status: c.status,
        source: c.currentLocationId
          ? findLastLocationSource(story, c.id)
          : "Geen locatie ingesteld",
      })),
    deadCharacters: story.characters
      .filter((c) => c.status === "dood")
      .map((c) => ({ name: c.name, source: "Personage-status (handmatig gemarkeerd als dood)" })),
    missingCharacters: story.characters
      .filter((c) => c.status === "vermist")
      .map((c) => ({ name: c.name, source: "Personage-status" })),
    injuries: story.characters
      .filter((c) => c.injuries && c.injuries.length > 0)
      .map((c) => ({ name: c.name, injuries: c.injuries!, source: "Personage-profiel" })),
    relationships: (story.relationships ?? []).map((r) => ({
      a: charName.get(r.a) ?? r.a,
      b: charName.get(r.b) ?? r.b,
      type: r.type,
      note: r.note,
      source: r.chapterNumber
        ? `Hoofdstuk ${r.chapterNumber} relatie-verandering`
        : "Handmatig toegevoegd",
    })),
    ongoingPlots: story.timeline.slice(-8).map((t) => `${t.title}: ${t.description}`),
    storySetup:
      story.beginningState || story.endGoal
        ? { beginningState: story.beginningState, endGoal: story.endGoal }
        : undefined,
  };
}

export function continuityToText(c: ContinuityFacts): string {
  const lines: string[] = [];
  lines.push("CONTINUÏTEITSFEITEN (MOET strikt gerespecteerd worden — geen teleportaties, geen herleving van doden):");
  if (c.storySetup?.beginningState) {
    lines.push(`VERHAAL-OPZET — beginsituatie (vast): ${c.storySetup.beginningState}`);
  }
  if (c.storySetup?.endGoal) {
    lines.push(`VERHAAL-OPZET — einddoel (vast, bouw hier naartoe): ${c.storySetup.endGoal}`);
  }
  if (c.characterLocations.length) {
    lines.push("Laatste bekende locaties:");
    for (const cl of c.characterLocations) {
      lines.push(`  - ${cl.name}: ${cl.location ?? "onbekend"} [${cl.status}]`);
    }
  }
  if (c.deadCharacters.length) lines.push(`DOOD (blijven dood): ${c.deadCharacters.map((d) => d.name).join(", ")}.`);
  if (c.missingCharacters.length) lines.push(`VERMIST: ${c.missingCharacters.map((d) => d.name).join(", ")}.`);
  if (c.injuries.length) {
    lines.push("Verwondingen / lopende fysieke gevolgen:");
    for (const i of c.injuries) lines.push(`  - ${i.name}: ${i.injuries.join("; ")}`);
  }
  if (c.relationships.length) {
    lines.push("Actieve relaties:");
    for (const r of c.relationships) lines.push(`  - ${r.a} & ${r.b}: ${r.type}${r.note ? ` (${r.note})` : ""}`);
  }
  if (c.ongoingPlots.length) {
    lines.push("Lopende verhaallijnen (uit tijdlijn):");
    for (const p of c.ongoingPlots) lines.push(`  - ${p}`);
  }
  return lines.join("\n");
}
