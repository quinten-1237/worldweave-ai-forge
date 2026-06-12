import type { Story, Character, Location } from "@/types/story";

export type CharacterRole = "main" | "supporting" | "background" | "absent";
export type ChapterLength = "short" | "medium" | "long" | "epic";

export const LENGTH_WORDS: Record<ChapterLength, number> = {
  short: 250,
  medium: 500,
  long: 1000,
  epic: 2000,
};

export const LENGTH_LABEL: Record<ChapterLength, string> = {
  short: "Klein (250 woorden)",
  medium: "Middel (500 woorden)",
  long: "Lang (1000 woorden)",
  epic: "Episch (2000 woorden)",
};

export const ROLE_LABEL: Record<CharacterRole, string> = {
  main: "Hoofdrol",
  supporting: "Bijrol",
  background: "Achtergrond",
  absent: "Niet aanwezig",
};

export const EVENT_CATEGORIES: { category: string; events: string[] }[] = [
  {
    category: "Politiek",
    events: ["Kroning", "Raadsvergadering", "Alliantie", "Verraad", "Aanslag"],
  },
  {
    category: "Militair",
    events: ["Veldslag", "Belegering", "Plundering", "Hinderlaag"],
  },
  {
    category: "Persoonlijk",
    events: ["Romantiek", "Vriendschap", "Ruzie", "Familieconflict", "Training"],
  },
  {
    category: "Fantasy",
    events: [
      "Draak verschijnt",
      "Magische ontdekking",
      "White Walker activiteit",
      "Profetie",
      "Eeuwenoud artefact",
    ],
  },
];

export const STORY_GOALS = [
  "Karakterontwikkeling",
  "Worldbuilding",
  "Politieke intriges",
  "Romantiek",
  "Oorlogsvoorbereiding",
  "Mysterie",
  "Avontuur",
  "Actie",
  "Horror",
];

export const RELATIONSHIP_TYPES = [
  { value: "friends", label: "Worden vrienden" },
  { value: "enemies", label: "Worden vijanden" },
  { value: "romance_start", label: "Romance begint" },
  { value: "romance_end", label: "Romance eindigt" },
  { value: "alliance", label: "Alliantie gevormd" },
  { value: "trust_broken", label: "Vertrouwen gebroken" },
  { value: "custom", label: "Aangepast" },
] as const;

export interface PlannedCharacter {
  characterId: string;
  role: CharacterRole;
  hasDialogue: boolean;
  viewpoint: boolean;
  keyScene: boolean;
  locationId?: string;
}

export interface RelationshipChange {
  id: string;
  a: string;
  b: string;
  type: string;
  note?: string;
}

export interface NewLocationDraft {
  name: string;
  description?: string;
  climate?: string;
}

export interface ChapterPlan {
  characters: PlannedCharacter[];
  locationIds: string[];
  newLocations: NewLocationDraft[];
  events: string[];
  customEvent?: string;
  goals: string[];
  relationshipChanges: RelationshipChange[];
  length: ChapterLength;
  userChoice?: string;
  extra?: string;
}

export interface ChapterPreset {
  id: string;
  name: string;
  createdAt: number;
  plan: ChapterPlan;
}

export function emptyPlan(): ChapterPlan {
  return {
    characters: [],
    locationIds: [],
    newLocations: [],
    events: [],
    goals: [],
    relationshipChanges: [],
    length: "medium",
  };
}

/**
 * Build a default plan for a chapter using continuity facts:
 * - all living characters are included as "supporting" by default
 * - each character is pre-assigned to their last known location
 * - the locations they were in are pre-selected
 */
export function defaultPlanFromContinuity(story: Story): ChapterPlan {
  const living = story.characters.filter((c) => c.status !== "dood");
  const locationIds = new Set<string>();
  const characters: PlannedCharacter[] = living.map((c) => {
    if (c.currentLocationId) locationIds.add(c.currentLocationId);
    return {
      characterId: c.id,
      role: "supporting",
      hasDialogue: false,
      viewpoint: false,
      keyScene: false,
      locationId: c.currentLocationId,
    };
  });
  return {
    ...emptyPlan(),
    characters,
    locationIds: Array.from(locationIds),
  };
}

function relationshipLabel(type: string): string {
  return RELATIONSHIP_TYPES.find((t) => t.value === type)?.label ?? type;
}

/**
 * Serialize a chapter plan into strict natural-language director instructions
 * for the AI model. Uses the story to resolve character / location names.
 */
export function planToInstructions(
  plan: ChapterPlan,
  story: Story,
): string {
  const charById = new Map(story.characters.map((c) => [c.id, c]));
  const locById = new Map(story.locations.map((l) => [l.id, l]));
  const lines: string[] = [];

  // Story setup (especially crucial for chapter 1)
  if (story.beginningState?.trim()) {
    lines.push(`- VERHAAL-OPZET — BEGINSITUATIE: ${story.beginningState.trim()}`);
  }
  if (story.endGoal?.trim()) {
    lines.push(`- VERHAAL-OPZET — EINDDOEL (bouw hier naartoe): ${story.endGoal.trim()}`);
  }


  // Characters per role
  const roleGroups: Record<CharacterRole, string[]> = {
    main: [], supporting: [], background: [], absent: [],
  };
  for (const pc of plan.characters) {
    const c = charById.get(pc.characterId);
    if (!c) continue;
    roleGroups[pc.role].push(c.name);
  }
  if (roleGroups.main.length)
    lines.push(`- HOOFDROLLEN (centrale scenes, krijgen veel pagina-aandacht): ${roleGroups.main.join(", ")}.`);
  if (roleGroups.supporting.length)
    lines.push(`- BIJROLLEN (actief aanwezig, ondersteunende scenes): ${roleGroups.supporting.join(", ")}.`);
  if (roleGroups.background.length)
    lines.push(`- ACHTERGROND (kort vermelden, geen eigen scene): ${roleGroups.background.join(", ")}.`);
  if (roleGroups.absent.length)
    lines.push(`- NIET AANWEZIG (verboden om op te voeren of te laten verschijnen): ${roleGroups.absent.join(", ")}.`);

  // Viewpoint / dialogue / key scene
  const vp = plan.characters.filter((p) => p.viewpoint).map((p) => charById.get(p.characterId)?.name).filter(Boolean);
  const dlg = plan.characters.filter((p) => p.hasDialogue).map((p) => charById.get(p.characterId)?.name).filter(Boolean);
  const key = plan.characters.filter((p) => p.keyScene).map((p) => charById.get(p.characterId)?.name).filter(Boolean);
  if (vp.length) lines.push(`- POV-personage(s) (verhaal vanuit hun perspectief): ${vp.join(", ")}.`);
  if (dlg.length) lines.push(`- Moeten dialoog krijgen: ${dlg.join(", ")}.`);
  if (key.length) lines.push(`- Krijgen een belangrijke scene in dit hoofdstuk: ${key.join(", ")}.`);

  // Locations
  const allLocNames = [
    ...plan.locationIds.map((id) => locById.get(id)?.name).filter(Boolean) as string[],
    ...plan.newLocations.map((n) => n.name),
  ];
  if (allLocNames.length === 1) {
    lines.push(`- LOCATIE: het hoofdstuk speelt zich af in ${allLocNames[0]}.`);
  } else if (allLocNames.length > 1) {
    lines.push(`- LOCATIES: dit hoofdstuk wisselt tussen meerdere locaties (${allLocNames.join(", ")}). Geef elke locatie minstens één scene.`);
  }
  for (const nl of plan.newLocations) {
    lines.push(`- Introduceer NIEUWE locatie "${nl.name}"${nl.description ? ` — ${nl.description}` : ""}${nl.climate ? ` (klimaat: ${nl.climate})` : ""}.`);
  }

  // Character → location assignment
  const byLoc = new Map<string, string[]>();
  for (const pc of plan.characters) {
    if (pc.role === "absent" || !pc.locationId) continue;
    const loc = locById.get(pc.locationId) ?? plan.newLocations.find((n) => n.name === pc.locationId);
    const locName = (loc as { name?: string } | undefined)?.name;
    if (!locName) continue;
    const c = charById.get(pc.characterId);
    if (!c) continue;
    const arr = byLoc.get(locName) ?? [];
    arr.push(c.name);
    byLoc.set(locName, arr);
  }
  if (byLoc.size > 0) {
    lines.push(`- PERSONAGE-LOCATIE TOEWIJZING (personages verschijnen UITSLUITEND op hun toegewezen locatie):`);
    for (const [loc, names] of byLoc) {
      lines.push(`    • ${loc}: ${names.join(", ")}`);
    }
  }

  // Events
  const allEvents = [...plan.events, ...(plan.customEvent?.trim() ? [plan.customEvent.trim()] : [])];
  if (allEvents.length) lines.push(`- VERPLICHTE GEBEURTENISSEN in dit hoofdstuk: ${allEvents.join("; ")}.`);

  // Goals
  if (plan.goals.length) lines.push(`- VERHAALDOEL(EN) van dit hoofdstuk: ${plan.goals.join(", ")}. Schrijf zodanig dat deze doelen geraakt worden.`);

  // Relationship changes
  if (plan.relationshipChanges.length) {
    lines.push(`- RELATIE-VERANDERINGEN die in dit hoofdstuk moeten plaatsvinden:`);
    for (const r of plan.relationshipChanges) {
      const a = charById.get(r.a)?.name ?? "?";
      const b = charById.get(r.b)?.name ?? "?";
      lines.push(`    • ${a} ↔ ${b}: ${relationshipLabel(r.type)}${r.note ? ` — ${r.note}` : ""}`);
    }
  }

  // Length
  lines.push(`- GEWENSTE LENGTE: ${LENGTH_LABEL[plan.length]}.`);

  if (plan.userChoice?.trim()) lines.push(`- KEUZE VAN DE LEZER: ${plan.userChoice.trim()}`);
  if (plan.extra?.trim()) lines.push(`- EXTRA REGIE-INSTRUCTIES: ${plan.extra.trim()}`);

  if (lines.length === 0) return "";
  return `De volgende hoofdstuk-planning is VERPLICHT en moet strikt worden gevolgd:\n${lines.join("\n")}`;
}

/** Resolve which characters/locations the plan refers to (for post-chapter updates). */
export function resolvePlanedAssignments(
  plan: ChapterPlan,
  story: Story,
  createdLocations: Location[],
): { characterId: string; locationId: string }[] {
  const result: { characterId: string; locationId: string }[] = [];
  const locByName = new Map(createdLocations.map((l) => [l.name, l.id]));
  for (const pc of plan.characters) {
    if (pc.role === "absent" || !pc.locationId) continue;
    // pc.locationId is either an existing id or the new location's name
    const existing = story.locations.find((l) => l.id === pc.locationId);
    const newlyCreated = locByName.get(pc.locationId);
    const locId = existing?.id ?? newlyCreated;
    if (locId) result.push({ characterId: pc.characterId, locationId: locId });
  }
  return result;
}

// Mark unused import as used for type-only consumers
export type { Character };
