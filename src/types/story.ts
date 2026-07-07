export type CharacterStatus = "levend" | "dood" | "vermist" | "gevangen" | "onbekend";

export interface Character {
  id: string;
  name: string;
  type?: import("@/lib/character-types").CharacterType;
  typeFields?: Record<string, string>;
  aliases?: string[];
  biography?: string;
  inventory?: string[];
  age?: string;
  gender?: string;
  appearance?: string;
  personality?: string;
  motivations?: string;
  goals?: string;
  secrets?: string;
  skills?: string;
  relationships?: string;
  status: CharacterStatus;
  portraitUrl?: string;
  currentLocationId?: string;
  injuries?: string[];
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  climate?: string;
  population?: string;
  history?: string;
  buildings?: string;
  imageUrl?: string;
}

export interface Faction {
  id: string;
  name: string;
  leader?: string;
  description?: string;
  allies?: string;
  enemies?: string;
  goals?: string;
}

export interface MagicSystem {
  type?: string;
  rules?: string;
  powers?: string;
  limits?: string;
  forbidden?: string;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string;
  wordCount: number;
  choices?: { label: string; description?: string }[];
  chosenOption?: string;
  createdAt: number;
  plan?: import("@/lib/chapter-plan").ChapterPlan;
}

export interface StoryRelationship {
  id: string;
  a: string;
  b: string;
  type: string;
  note?: string;
  chapterNumber?: number;
  createdAt: number;
}


export interface TimelineEvent {
  id: string;
  chapterId?: string;
  title: string;
  description: string;
  createdAt: number;
}

export type FuturePlanKind = "mystery" | "war" | "revelation" | "prophecy" | "event";
export type FuturePlanStatus = "planned" | "seeded" | "unfolding" | "revealed" | "cancelled";

export interface FuturePlan {
  id: string;
  kind: FuturePlanKind;
  title: string;
  description: string;
  /** Vroegste hoofdstuk waarin dit mag beginnen door te sijpelen. */
  earliestChapter?: number;
  /** Doel-hoofdstuk voor de volledige onthulling / climax. */
  targetChapter?: number;
  status: FuturePlanStatus;
  hints?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SecretPlan {
  id: string;
  title: string;
  /** De volledige geheime waarheid. Alleen zichtbaar voor de AI wanneer voorwaarden vervuld zijn. */
  truth: string;
  /** Wie/wat weet dit — voor de auteur. */
  owner?: string;
  /** Trigger: hoofdstuknummer waarop het geheim onthuld mag worden. */
  revealAtChapter?: number;
  /** Trigger: id van een FuturePlan dat onthuld/revealed moet zijn. */
  revealAfterPlanId?: string;
  /** Trigger: naam van een gebeurtenis in de tijdlijn (case-insensitive contains). */
  revealAfterEvent?: string;
  revealed: boolean;
  revealedInChapter?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Story {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  ageCategory?: string;
  language: string;
  genres: string[];
  tones: string[];
  /** Verplicht voor hoofdstuk 1 — startsituatie van het verhaal. */
  beginningState?: string;
  /** Verplicht voor hoofdstuk 1 — het einddoel van het verhaal. */
  endGoal?: string;
  characters: Character[];
  locations: Location[];
  factions: Faction[];
  magic?: MagicSystem;
  chapters: Chapter[];
  timeline: TimelineEvent[];
  relationships?: StoryRelationship[];
  chapterPresets?: import("@/lib/chapter-plan").ChapterPreset[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  lastReadChapter?: number;
}

