import { create } from "zustand";
import type { Story, Character, Location, Faction, Chapter, TimelineEvent, StoryRelationship } from "@/types/story";
import type { ChapterPlan, ChapterPreset, RelationshipChange } from "@/lib/chapter-plan";


function uid() {
  // UUID for cloud compatibility; falls back to random string in ancient runtimes.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

interface State {
  stories: Story[];
  createStory: (data: Partial<Story> & { title: string }) => string;
  updateStory: (id: string, patch: Partial<Story>) => void;
  deleteStory: (id: string) => void;
  toggleFavorite: (id: string) => void;

  addCharacter: (storyId: string, c: Omit<Character, "id">) => Character;
  updateCharacter: (storyId: string, charId: string, patch: Partial<Character>) => void;
  removeCharacter: (storyId: string, charId: string) => void;

  addLocation: (storyId: string, l: Omit<Location, "id">) => Location;
  updateLocation: (storyId: string, locId: string, patch: Partial<Location>) => void;
  removeLocation: (storyId: string, locId: string) => void;

  addFaction: (storyId: string, f: Omit<Faction, "id">) => Faction;
  updateFaction: (storyId: string, fId: string, patch: Partial<Faction>) => void;
  removeFaction: (storyId: string, fId: string) => void;

  addChapter: (storyId: string, c: Omit<Chapter, "id" | "number" | "createdAt">) => Chapter;
  updateChapter: (storyId: string, chapterId: string, patch: Partial<Chapter>) => void;

  addTimelineEvent: (storyId: string, e: Omit<TimelineEvent, "id" | "createdAt">) => void;

  saveChapterPreset: (storyId: string, name: string, plan: ChapterPlan) => ChapterPreset;
  updateChapterPreset: (storyId: string, presetId: string, patch: Partial<Omit<ChapterPreset, "id" | "createdAt">>) => void;
  duplicateChapterPreset: (storyId: string, presetId: string) => ChapterPreset | undefined;
  deleteChapterPreset: (storyId: string, presetId: string) => void;
  applyChapterOutcome: (
    storyId: string,
    chapterNumber: number,
    assignments: { characterId: string; locationId: string }[],
    relationshipChanges: RelationshipChange[],
  ) => void;

  importStory: (story: Story) => void;
}


export const useStoryStore = create<State>()(
  (set, get) => ({
      stories: [],

      createStory: (data) => {
        const id = uid();
        const story: Story = {
          id,
          title: data.title,
          subtitle: data.subtitle ?? "",
          description: data.description ?? "",
          ageCategory: data.ageCategory ?? "Volwassenen",
          language: data.language ?? "Nederlands",
          genres: data.genres ?? [],
          tones: data.tones ?? [],
          characters: data.characters ?? [],
          locations: data.locations ?? [],
          factions: data.factions ?? [],
          magic: data.magic,
          chapters: [],
          timeline: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ stories: [story, ...s.stories] }));
        return id;
      },

      updateStory: (id, patch) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === id ? { ...st, ...patch, updatedAt: Date.now() } : st,
          ),
        })),

      deleteStory: (id) => set((s) => ({ stories: s.stories.filter((st) => st.id !== id) })),

      toggleFavorite: (id) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === id ? { ...st, favorite: !st.favorite } : st,
          ),
        })),

      addCharacter: (storyId, c) => {
        const ch: Character = { ...c, id: uid() };
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? { ...st, characters: [...st.characters, ch], updatedAt: Date.now() }
              : st,
          ),
        }));
        return ch;
      },
      updateCharacter: (storyId, charId, patch) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  characters: st.characters.map((c) =>
                    c.id === charId ? { ...c, ...patch } : c,
                  ),
                  updatedAt: Date.now(),
                }
              : st,
          ),
        })),
      removeCharacter: (storyId, charId) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? { ...st, characters: st.characters.filter((c) => c.id !== charId) }
              : st,
          ),
        })),

      addLocation: (storyId, l) => {
        const loc: Location = { ...l, id: uid() };
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? { ...st, locations: [...st.locations, loc], updatedAt: Date.now() }
              : st,
          ),
        }));
        return loc;
      },
      updateLocation: (storyId, locId, patch) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  locations: st.locations.map((l) =>
                    l.id === locId ? { ...l, ...patch } : l,
                  ),
                }
              : st,
          ),
        })),
      removeLocation: (storyId, locId) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? { ...st, locations: st.locations.filter((l) => l.id !== locId) }
              : st,
          ),
        })),

      addFaction: (storyId, f) => {
        const fc: Faction = { ...f, id: uid() };
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? { ...st, factions: [...st.factions, fc], updatedAt: Date.now() }
              : st,
          ),
        }));
        return fc;
      },
      updateFaction: (storyId, fId, patch) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  factions: st.factions.map((f) => (f.id === fId ? { ...f, ...patch } : f)),
                }
              : st,
          ),
        })),
      removeFaction: (storyId, fId) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? { ...st, factions: st.factions.filter((f) => f.id !== fId) }
              : st,
          ),
        })),

      addChapter: (storyId, c) => {
        const story = get().stories.find((s) => s.id === storyId);
        const num = (story?.chapters.length ?? 0) + 1;
        const chap: Chapter = { ...c, id: uid(), number: num, createdAt: Date.now() };
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  chapters: [...st.chapters, chap],
                  lastReadChapter: num,
                  updatedAt: Date.now(),
                }
              : st,
          ),
        }));
        return chap;
      },
      updateChapter: (storyId, chapterId, patch) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  chapters: st.chapters.map((c) =>
                    c.id === chapterId ? { ...c, ...patch } : c,
                  ),
                  updatedAt: Date.now(),
                }
              : st,
          ),
        })),

      addTimelineEvent: (storyId, e) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  timeline: [
                    ...st.timeline,
                    { ...e, id: uid(), createdAt: Date.now() },
                  ],
                }
              : st,
          ),
        })),

      saveChapterPreset: (storyId, name, plan) => {
        const preset: ChapterPreset = { id: uid(), name, createdAt: Date.now(), plan };
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? { ...st, chapterPresets: [...(st.chapterPresets ?? []), preset] }
              : st,
          ),
        }));
        return preset;
      },

      updateChapterPreset: (storyId, presetId, patch) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  chapterPresets: (st.chapterPresets ?? []).map((p) =>
                    p.id === presetId ? { ...p, ...patch } : p,
                  ),
                }
              : st,
          ),
        })),

      duplicateChapterPreset: (storyId, presetId) => {
        const st = get().stories.find((x) => x.id === storyId);
        const src = st?.chapterPresets?.find((p) => p.id === presetId);
        if (!src) return undefined;
        const copy: ChapterPreset = {
          id: uid(),
          name: `${src.name} (kopie)`,
          createdAt: Date.now(),
          plan: JSON.parse(JSON.stringify(src.plan)),
        };
        set((s) => ({
          stories: s.stories.map((stt) =>
            stt.id === storyId
              ? { ...stt, chapterPresets: [...(stt.chapterPresets ?? []), copy] }
              : stt,
          ),
        }));
        return copy;
      },

      deleteChapterPreset: (storyId, presetId) =>
        set((s) => ({
          stories: s.stories.map((st) =>
            st.id === storyId
              ? {
                  ...st,
                  chapterPresets: (st.chapterPresets ?? []).filter((p) => p.id !== presetId),
                }
              : st,
          ),
        })),

      applyChapterOutcome: (storyId, chapterNumber, assignments, relationshipChanges) =>
        set((s) => ({
          stories: s.stories.map((st) => {
            if (st.id !== storyId) return st;
            const assignMap = new Map(assignments.map((a) => [a.characterId, a.locationId]));
            const characters = st.characters.map((c) =>
              assignMap.has(c.id) ? { ...c, currentLocationId: assignMap.get(c.id) } : c,
            );
            const newRels: StoryRelationship[] = relationshipChanges.map((r) => ({
              id: uid(),
              a: r.a,
              b: r.b,
              type: r.type,
              note: r.note,
              chapterNumber,
              createdAt: Date.now(),
            }));
            return {
              ...st,
              characters,
              relationships: [...(st.relationships ?? []), ...newRels],
              updatedAt: Date.now(),
            };
          }),
        })),

      importStory: (story) =>
        set((s) => ({ stories: [{ ...story, id: uid() }, ...s.stories] })),
    }),
    {
      name: "storyforge-store-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as never),
      ),
    },
  ),
);

