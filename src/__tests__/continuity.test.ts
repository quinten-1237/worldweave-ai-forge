import { describe, it, expect, beforeEach } from "vitest";
import { useStoryStore } from "@/store/storyStore";
import { deriveContinuity } from "@/lib/continuity";
import { emptyPlan, resolvePlanedAssignments, planToInstructions, LENGTH_WORDS } from "@/lib/chapter-plan";
import type { ChapterPlan } from "@/lib/chapter-plan";

function resetStore() {
  useStoryStore.setState({ stories: [] });
}

function makeStory() {
  const create = useStoryStore.getState().createStory;
  const id = create({ title: "Test" });
  const addLoc = useStoryStore.getState().addLocation;
  const addChar = useStoryStore.getState().addCharacter;
  const locA = addLoc(id, { name: "Winterfell" });
  const locB = addLoc(id, { name: "Kings Landing" });
  const arya = addChar(id, { name: "Arya", status: "levend", currentLocationId: locA.id });
  const ned = addChar(id, { name: "Ned", status: "levend", currentLocationId: locA.id });
  return { id, locA, locB, arya, ned };
}

describe("length presets", () => {
  it("uses the new word counts (250/500/1000/2000)", () => {
    expect(LENGTH_WORDS.short).toBe(250);
    expect(LENGTH_WORDS.medium).toBe(500);
    expect(LENGTH_WORDS.long).toBe(1000);
    expect(LENGTH_WORDS.epic).toBe(2000);
  });
});

describe("continuity — characters never teleport", () => {
  beforeEach(resetStore);

  it("derived last-known locations stay locked to where the chapter outcome put them", () => {
    const { id, locA, locB, arya, ned } = makeStory();
    const apply = useStoryStore.getState().applyChapterOutcome;

    // Chapter 1 outcome: Arya stays at A, Ned moves to B
    apply(id, 1, [
      { characterId: arya.id, locationId: locA.id },
      { characterId: ned.id, locationId: locB.id },
    ], []);

    const story1 = useStoryStore.getState().stories.find((s) => s.id === id)!;
    const cont1 = deriveContinuity(story1);
    const aryaLoc = cont1.characterLocations.find((c) => c.name === "Arya")!.location;
    const nedLoc = cont1.characterLocations.find((c) => c.name === "Ned")!.location;
    expect(aryaLoc).toBe("Winterfell");
    expect(nedLoc).toBe("Kings Landing");

    // Chapter 2: plan does NOT reassign Arya — she must still be at Winterfell next chapter.
    const plan: ChapterPlan = {
      ...emptyPlan(),
      characters: [
        { characterId: arya.id, role: "main", hasDialogue: true, viewpoint: true, keyScene: false, locationId: locA.id },
        { characterId: ned.id, role: "supporting", hasDialogue: false, viewpoint: false, keyScene: false, locationId: locB.id },
      ],
      locationIds: [locA.id, locB.id],
    };
    const assignments = resolvePlanedAssignments(plan, story1, []);
    apply(id, 2, assignments, []);

    const story2 = useStoryStore.getState().stories.find((s) => s.id === id)!;
    const cont2 = deriveContinuity(story2);
    expect(cont2.characterLocations.find((c) => c.name === "Arya")!.location).toBe("Winterfell");
    expect(cont2.characterLocations.find((c) => c.name === "Ned")!.location).toBe("Kings Landing");
  });

  it("planToInstructions forbids absent characters and pins location assignments", () => {
    const { id, locA, locB, arya, ned } = makeStory();
    const story = useStoryStore.getState().stories.find((s) => s.id === id)!;
    const plan: ChapterPlan = {
      ...emptyPlan(),
      characters: [
        { characterId: arya.id, role: "main", hasDialogue: true, viewpoint: true, keyScene: true, locationId: locA.id },
        { characterId: ned.id, role: "absent", hasDialogue: false, viewpoint: false, keyScene: false },
      ],
      locationIds: [locA.id, locB.id],
    };
    const text = planToInstructions(plan, story);
    expect(text).toMatch(/NIET AANWEZIG.*Ned/);
    expect(text).toMatch(/Arya.*Winterfell|Winterfell.*Arya/);
    expect(text).toMatch(/HOOFDROLLEN.*Arya/);
  });

  it("dead characters stay dead in continuity facts", () => {
    const { id, ned } = makeStory();
    useStoryStore.getState().updateCharacter(id, ned.id, { status: "dood" });
    const story = useStoryStore.getState().stories.find((s) => s.id === id)!;
    const cont = deriveContinuity(story);
    expect(cont.deadCharacters.map((d) => d.name)).toContain("Ned");
    // dead chars are excluded from active location list
    expect(cont.characterLocations.find((c) => c.name === "Ned")).toBeUndefined();
  });
});

describe("events + relationship changes persist", () => {
  beforeEach(resetStore);

  it("applyChapterOutcome appends relationship changes with the chapter number", () => {
    const { id, arya, ned } = makeStory();
    const apply = useStoryStore.getState().applyChapterOutcome;
    apply(id, 1, [], [
      { id: "r1", a: arya.id, b: ned.id, type: "trust_broken", note: "argument" },
    ]);
    apply(id, 2, [], [
      { id: "r2", a: arya.id, b: ned.id, type: "alliance" },
    ]);
    const story = useStoryStore.getState().stories.find((s) => s.id === id)!;
    expect(story.relationships).toHaveLength(2);
    expect(story.relationships![0].chapterNumber).toBe(1);
    expect(story.relationships![1].chapterNumber).toBe(2);
    expect(story.relationships![0].type).toBe("trust_broken");
  });

  it("timeline events persist via addTimelineEvent", () => {
    const { id } = makeStory();
    const addEv = useStoryStore.getState().addTimelineEvent;
    addEv(id, { title: "Veldslag", description: "Bij de muur" });
    addEv(id, { title: "Kroning", description: "Nieuwe koning" });
    const story = useStoryStore.getState().stories.find((s) => s.id === id)!;
    expect(story.timeline.map((t) => t.title)).toEqual(["Veldslag", "Kroning"]);
  });
});

describe("chapter presets — save / load / duplicate / update / delete", () => {
  beforeEach(resetStore);

  it("supports the full preset lifecycle so chapter N can reuse a config", () => {
    const { id, arya, locA } = makeStory();
    const plan: ChapterPlan = {
      ...emptyPlan(),
      characters: [{ characterId: arya.id, role: "main", hasDialogue: true, viewpoint: true, keyScene: false, locationId: locA.id }],
      locationIds: [locA.id],
      events: ["Veldslag"],
      length: "long",
    };
    const { saveChapterPreset, duplicateChapterPreset, updateChapterPreset, deleteChapterPreset } = useStoryStore.getState();

    const saved = saveChapterPreset(id, "Episode 1 setup", plan);
    expect(saved.name).toBe("Episode 1 setup");

    let story = useStoryStore.getState().stories.find((s) => s.id === id)!;
    expect(story.chapterPresets).toHaveLength(1);
    expect(story.chapterPresets![0].plan.events).toEqual(["Veldslag"]);

    const dup = duplicateChapterPreset(id, saved.id)!;
    expect(dup.name).toBe("Episode 1 setup (kopie)");
    expect(dup.id).not.toBe(saved.id);

    updateChapterPreset(id, dup.id, { name: "Episode 2 setup", plan: { ...plan, events: ["Kroning"] } });
    story = useStoryStore.getState().stories.find((s) => s.id === id)!;
    const updated = story.chapterPresets!.find((p) => p.id === dup.id)!;
    expect(updated.name).toBe("Episode 2 setup");
    expect(updated.plan.events).toEqual(["Kroning"]);
    // original preset is untouched (deep copy on duplicate)
    expect(story.chapterPresets!.find((p) => p.id === saved.id)!.plan.events).toEqual(["Veldslag"]);

    deleteChapterPreset(id, saved.id);
    story = useStoryStore.getState().stories.find((s) => s.id === id)!;
    expect(story.chapterPresets).toHaveLength(1);
    expect(story.chapterPresets![0].id).toBe(dup.id);
  });
});
