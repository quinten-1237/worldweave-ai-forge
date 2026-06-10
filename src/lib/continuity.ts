import type { Story } from "@/types/story";

export interface ContinuityFacts {
  characterLocations: { name: string; location?: string; status: string }[];
  deadCharacters: string[];
  missingCharacters: string[];
  injuries: { name: string; injuries: string[] }[];
  relationships: { a: string; b: string; type: string; note?: string }[];
  ongoingPlots: string[];
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
      })),
    deadCharacters: story.characters.filter((c) => c.status === "dood").map((c) => c.name),
    missingCharacters: story.characters.filter((c) => c.status === "vermist").map((c) => c.name),
    injuries: story.characters
      .filter((c) => c.injuries && c.injuries.length > 0)
      .map((c) => ({ name: c.name, injuries: c.injuries! })),
    relationships: (story.relationships ?? []).map((r) => ({
      a: charName.get(r.a) ?? r.a,
      b: charName.get(r.b) ?? r.b,
      type: r.type,
      note: r.note,
    })),
    ongoingPlots: story.timeline.slice(-8).map((t) => `${t.title}: ${t.description}`),
  };
}

export function continuityToText(c: ContinuityFacts): string {
  const lines: string[] = [];
  lines.push("CONTINUÏTEITSFEITEN (MOET strikt gerespecteerd worden — geen teleportaties, geen herleving van doden):");
  if (c.characterLocations.length) {
    lines.push("Laatste bekende locaties:");
    for (const cl of c.characterLocations) {
      lines.push(`  - ${cl.name}: ${cl.location ?? "onbekend"} [${cl.status}]`);
    }
  }
  if (c.deadCharacters.length) lines.push(`DOOD (blijven dood): ${c.deadCharacters.join(", ")}.`);
  if (c.missingCharacters.length) lines.push(`VERMIST: ${c.missingCharacters.join(", ")}.`);
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
