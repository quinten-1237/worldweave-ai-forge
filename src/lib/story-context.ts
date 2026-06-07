import type { Story } from "@/types/story";

export function buildStoryContext(story: Story): string {
  const parts: string[] = [];
  parts.push(`TITEL: ${story.title}`);
  if (story.subtitle) parts.push(`ONDERTITEL: ${story.subtitle}`);
  if (story.description) parts.push(`PREMISSE: ${story.description}`);
  parts.push(`TAAL: ${story.language}`);
  parts.push(`LEEFTIJD: ${story.ageCategory ?? "volwassen"}`);
  if (story.genres.length) parts.push(`GENRES: ${story.genres.join(", ")}`);
  if (story.tones.length) parts.push(`TOON: ${story.tones.join(", ")}`);

  if (story.magic && (story.magic.type || story.magic.rules)) {
    parts.push(
      `MAGIESYSTEEM:\n  Type: ${story.magic.type ?? ""}\n  Regels: ${story.magic.rules ?? ""}\n  Krachten: ${story.magic.powers ?? ""}\n  Limieten: ${story.magic.limits ?? ""}\n  Verboden: ${story.magic.forbidden ?? ""}`,
    );
  }

  if (story.locations.length) {
    parts.push(
      "LOCATIES:\n" +
        story.locations
          .map(
            (l) =>
              `- ${l.name}: ${l.description ?? ""}${l.climate ? ` | klimaat: ${l.climate}` : ""}${l.population ? ` | bevolking: ${l.population}` : ""}${l.history ? ` | historie: ${l.history}` : ""}`,
          )
          .join("\n"),
    );
  }

  if (story.factions.length) {
    parts.push(
      "FACTIES:\n" +
        story.factions
          .map(
            (f) =>
              `- ${f.name} (leider: ${f.leader ?? "?"}): ${f.description ?? ""} | bondgenoten: ${f.allies ?? "?"} | vijanden: ${f.enemies ?? "?"} | doel: ${f.goals ?? "?"}`,
          )
          .join("\n"),
    );
  }

  if (story.characters.length) {
    parts.push(
      "PERSONAGES:\n" +
        story.characters
          .map(
            (c) =>
              `- ${c.name} [${c.status}] (${c.age ?? "?"}, ${c.gender ?? "?"}): ${c.personality ?? ""}. Motivatie: ${c.motivations ?? "?"}. Doel: ${c.goals ?? "?"}. Vaardigheden: ${c.skills ?? "?"}. Relaties: ${c.relationships ?? "?"}.${c.secrets ? ` Geheim: ${c.secrets}` : ""}`,
          )
          .join("\n"),
    );
  }

  if (story.timeline.length) {
    parts.push(
      "TIJDLIJN:\n" +
        story.timeline.map((e) => `- ${e.title}: ${e.description}`).join("\n"),
    );
  }

  return parts.join("\n\n");
}

export function buildPreviousSummary(story: Story, recent = 3): string {
  if (story.chapters.length === 0) return "";
  const recentChapters = story.chapters.slice(-recent);
  return recentChapters
    .map((c) => `Hoofdstuk ${c.number} — ${c.title}\n${c.content.slice(-2000)}`)
    .join("\n\n");
}
