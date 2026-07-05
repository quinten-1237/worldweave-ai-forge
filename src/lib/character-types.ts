// Character Type registry with type-specific fields.
// Adding a new type here + entry in TYPE_FIELDS is enough — no migration needed
// because typeFields is stored as a free-form Record<string,string>.

export type CharacterType =
  | "human"
  | "dragon"
  | "direwolf"
  | "wolf"
  | "dog"
  | "horse"
  | "giant"
  | "white_walker"
  | "child_of_forest"
  | "mythical"
  | "beast"
  | "bird"
  | "sea_creature"
  | "demon"
  | "spirit"
  | "unknown"
  | "custom";

export const CHARACTER_TYPE_LABELS: Record<CharacterType, string> = {
  human: "Mens",
  dragon: "Draak",
  direwolf: "Direwolf",
  wolf: "Wolf",
  dog: "Hond",
  horse: "Paard",
  giant: "Reus",
  white_walker: "White Walker",
  child_of_forest: "Kind van het Bos",
  mythical: "Mythisch wezen",
  beast: "Beest",
  bird: "Vogel",
  sea_creature: "Zeewezen",
  demon: "Demon",
  spirit: "Geest",
  unknown: "Onbekend",
  custom: "Aangepast",
};

export interface TypeField {
  key: string;
  label: string;
  multi?: boolean;
}

// Type-specific extra fields (on top of the core Character fields).
export const TYPE_FIELDS: Record<CharacterType, TypeField[]> = {
  human: [
    { key: "house", label: "Huis / Familie" },
    { key: "occupation", label: "Beroep / Rol" },
    { key: "title", label: "Titel" },
  ],
  dragon: [
    { key: "fire_color", label: "Vuurkleur" },
    { key: "wingspan", label: "Vleugelspanning" },
    { key: "rider", label: "Berijder" },
    { key: "dragon_size", label: "Grootte" },
    { key: "flying_ability", label: "Vliegkunde", multi: true },
  ],
  direwolf: [
    { key: "owner", label: "Eigenaar" },
    { key: "pack", label: "Roedel" },
    { key: "tracking_skill", label: "Speurtalent" },
  ],
  wolf: [
    { key: "pack", label: "Roedel" },
    { key: "territory", label: "Territorium" },
  ],
  dog: [
    { key: "breed", label: "Ras" },
    { key: "owner", label: "Eigenaar" },
  ],
  horse: [
    { key: "rider", label: "Berijder" },
    { key: "breed", label: "Ras" },
    { key: "speed", label: "Snelheid" },
  ],
  giant: [
    { key: "clan", label: "Clan" },
    { key: "height", label: "Lengte" },
  ],
  white_walker: [
    { key: "ice_magic", label: "IJsmagie", multi: true },
    { key: "rank", label: "Rang" },
  ],
  child_of_forest: [
    { key: "grove", label: "Grove / Woud" },
    { key: "old_magic", label: "Oude magie", multi: true },
  ],
  mythical: [
    { key: "species", label: "Soort" },
    { key: "abilities", label: "Vermogens", multi: true },
  ],
  beast: [{ key: "species", label: "Soort" }],
  bird: [
    { key: "species", label: "Soort" },
    { key: "owner", label: "Eigenaar" },
  ],
  sea_creature: [
    { key: "species", label: "Soort" },
    { key: "habitat", label: "Habitat" },
  ],
  demon: [
    { key: "domain", label: "Domein" },
    { key: "powers", label: "Krachten", multi: true },
  ],
  spirit: [
    { key: "haunting", label: "Waar spookt het" },
    { key: "abilities", label: "Vermogens", multi: true },
  ],
  unknown: [],
  custom: [{ key: "custom_notes", label: "Vrije notities", multi: true }],
};

export const CHARACTER_TYPES: CharacterType[] = Object.keys(CHARACTER_TYPE_LABELS) as CharacterType[];
