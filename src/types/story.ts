export type CharacterStatus = "levend" | "dood" | "vermist";

export interface Character {
  id: string;
  name: string;
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

export interface Story {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  ageCategory?: string;
  language: string;
  genres: string[];
  tones: string[];
  characters: Character[];
  locations: Location[];
  factions: Faction[];
  magic?: MagicSystem;
  chapters: Chapter[];
  timeline: TimelineEvent[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  lastReadChapter?: number;
}
