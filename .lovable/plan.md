## Goal

Replace the current "Story Director" panel with a full **Chapter Planner** that runs before every chapter (1, 2, 3, …) and gives the user the same level of control each time — like a TV-series episode planner.

## New Chapter Planner UI

A single screen, opened by a "Plan & Generate Chapter N" button on the Chapters tab. Six collapsible panels:

1. **Characters** — per character: Not present / Background / Supporting / Main, plus toggles "Has dialogue", "Viewpoint character", "Key scene".
2. **Locations** — multi-select existing locations + inline "create new location" form. Chapter can span multiple locations.
3. **Character → Location assignment** — for each included character, dropdown of selected locations. Characters only appear where assigned. Defaults to their last known location (continuity).
4. **Events** — checkbox grid grouped by category (Political, Military, Personal, Fantasy) with a free-text "custom event" field. Multi-select.
5. **Story goals** — multi-select chips (Character development, Worldbuilding, Political intrigue, Romance, War prep, Mystery, Adventure, Action, Horror…).
6. **Relationship changes** — repeatable row: Character A + Character B + change type (Become friends / enemies / Romance starts / ends / Alliance / Trust broken / Custom).
7. **Chapter length** — Short 1000 / Medium 2000 / Long 3000 / Epic 5000+.
8. **Extra instructions** — free-text.

Bottom bar: **Save preset**, **Load preset**, **Duplicate previous chapter setup**, **Generate Chapter**.

## Continuity engine

A new `src/lib/continuity.ts` derives, from existing chapters + timeline + character status:
- last known location per character (tracked as `currentLocationId` updated after each chapter),
- alive/dead/missing status (already stored),
- active alliances / conflicts / ongoing plots / injuries (extracted from timeline events tagged by type).

The planner pre-fills character locations from this. The generator prompt receives a "Continuity facts" block so characters never teleport, dead stay dead, etc.

## Data model additions

- `Character.currentLocationId?: string`, `Character.injuries?: string[]`.
- `Story.relationships: { id, a, b, type, since }[]`.
- `Story.chapterPresets: ChapterPlan[]` (saved configurations).
- `Chapter.plan?: ChapterPlan` (snapshot of what generated it, used for "Duplicate previous setup").
- `ChapterPlan`: characters[{id, role, dialogue, viewpoint, keyScene, locationId}], locationIds[], newLocations[], events[], goals[], relationshipChanges[], length, extra.

All persisted in the existing zustand store (no DB schema change needed — stories already serialize as JSONB).

## Generator changes

`generateChapter` server fn gains `plan: ChapterPlan` and `continuity: ContinuityFacts` inputs. The prompt builder composes a strict directive block: required characters per location, forbidden characters, mandatory events, goals, target word count, relationship transitions to depict, and continuity facts. After generation, post-processing updates each included character's `currentLocationId` to their assigned location and appends relationship changes to `story.relationships`.

## Files

New:
- `src/components/ChapterPlanner.tsx` — the planner UI (replaces StoryDirector usage).
- `src/lib/continuity.ts` — derive continuity facts + apply post-chapter updates.
- `src/lib/chapter-plan.ts` — types + prompt serialization + preset save/load helpers.

Edited:
- `src/types/story.ts` — add fields above.
- `src/store/storyStore.ts` — actions: `saveChapterPreset`, `deleteChapterPreset`, `applyChapterOutcome` (locations, relationships).
- `src/lib/ai.functions.ts` — extend `generateChapter` input schema + prompt with plan & continuity.
- `src/lib/story-context.ts` — include relationships + continuity in context.
- `src/routes/story.$id.tsx` — swap `<StoryDirector>` for `<ChapterPlanner>`; first chapter uses the same planner (no special case).
- `src/components/StoryDirector.tsx` — removed (superseded).

## Out of scope

- No backend schema migration (everything fits in the existing `stories.data` JSONB).
- Image generation stays disabled (per earlier requirement).
- No translation pass — UI stays in the existing Dutch.
