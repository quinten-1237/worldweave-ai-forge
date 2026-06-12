import { test, expect, type Page } from "@playwright/test";

/**
 * E2E: navigate through the UI to verify the Chapter Planner preview and
 * continuity panels stay correct after duplicating and loading presets.
 *
 * The store persists to localStorage under "storyforge-store-v1", so we seed
 * a fully-formed story (with chapters, characters, locations and a saved
 * preset) before loading the route. This avoids needing a real AI call.
 */

const STORE_KEY = "storyforge-store-v1";

const STORY_ID = "e2e-story-1";
const ARYA_ID = "char-arya";
const NED_ID = "char-ned";
const LOC_A_ID = "loc-winterfell";
const LOC_B_ID = "loc-kingslanding";
const PRESET_ID = "preset-1";

function seededState() {
  const plan = {
    characters: [
      {
        characterId: ARYA_ID,
        role: "main",
        hasDialogue: true,
        viewpoint: true,
        keyScene: true,
        locationId: LOC_A_ID,
      },
      {
        characterId: NED_ID,
        role: "supporting",
        hasDialogue: false,
        viewpoint: false,
        keyScene: false,
        locationId: LOC_B_ID,
      },
    ],
    locationIds: [LOC_A_ID, LOC_B_ID],
    newLocations: [],
    events: ["Veldslag"],
    goals: ["Politieke intriges"],
    relationshipChanges: [],
    length: "long",
  };

  return {
    state: {
      stories: [
        {
          id: STORY_ID,
          title: "E2E Test Saga",
          subtitle: "",
          description: "",
          language: "Nederlands",
          genres: [],
          tones: [],
          beginningState:
            "Het rijk is verdeeld na de dood van de oude koning en huizen kiezen kant.",
          endGoal:
            "Arya keert terug naar Winterfell en herstelt de orde in het noorden.",
          characters: [
            {
              id: ARYA_ID,
              name: "Arya",
              status: "levend",
              currentLocationId: LOC_A_ID,
            },
            {
              id: NED_ID,
              name: "Ned",
              status: "levend",
              currentLocationId: LOC_B_ID,
            },
          ],
          locations: [
            { id: LOC_A_ID, name: "Winterfell" },
            { id: LOC_B_ID, name: "Kings Landing" },
          ],
          factions: [],
          chapters: [
            {
              id: "ch-1",
              number: 1,
              title: "De Eerste Steen",
              content: "Een korte eerste scene.",
              wordCount: 5,
              createdAt: Date.now() - 10_000,
              plan,
            },
          ],
          timeline: [],
          relationships: [
            {
              id: "rel-1",
              a: ARYA_ID,
              b: NED_ID,
              type: "alliance",
              note: "samen tegen de troon",
              chapterNumber: 1,
              createdAt: Date.now() - 9_000,
            },
          ],
          chapterPresets: [
            {
              id: PRESET_ID,
              name: "Politiek-intriges preset",
              createdAt: Date.now() - 8_000,
              plan,
            },
          ],
          createdAt: Date.now() - 20_000,
          updatedAt: Date.now() - 8_000,
        },
      ],
    },
    version: 0,
  };
}

async function seed(page: Page) {
  await page.addInitScript(
    ([key, payload]) => {
      window.localStorage.setItem(key, JSON.stringify(payload));
    },
    [STORE_KEY, seededState()],
  );
}

test.describe("Chapter Planner preview & continuity", () => {
  test("loaded preset populates preview and continuity correctly", async ({ page }) => {
    await seed(page);
    await page.goto(`/story/${STORY_ID}`);

    // Continuity panel must show the locations from chapter 1, with their source.
    const continuity = page.getByTestId("continuity-panel");
    await expect(continuity).toBeVisible();
    await expect(continuity).toContainText("Arya");
    await expect(continuity).toContainText("Winterfell");
    await expect(continuity).toContainText("Kings Landing");
    // Source attribution must be visible
    await expect(continuity).toContainText("bron: Hoofdstuk 1");
    // Relationship source
    await expect(continuity).toContainText("alliance");
    await expect(continuity).toContainText("bron: Hoofdstuk 1 relatie-verandering");
    // Story setup wizard source
    await expect(continuity).toContainText("Verhaal-opzet wizard");

    // Load the saved preset
    await page.getByTestId("preset-select").selectOption(PRESET_ID);

    // Preview panel reflects the loaded preset's character roles & events
    const preview = page.getByTestId("preview-panel");
    await expect(preview).toContainText("Arya");
    await expect(preview).toContainText("Hoofdrol");
    await expect(preview).toContainText("Veldslag");
    await expect(preview).toContainText("Politieke intriges");
  });

  test("duplicating a preset preserves preview content under a new name", async ({ page }) => {
    await seed(page);
    await page.goto(`/story/${STORY_ID}`);

    // Load the preset first so duplicate buttons appear
    await page.getByTestId("preset-select").selectOption(PRESET_ID);
    await page.getByTestId("preset-duplicate").click();

    // After duplication the new preset is selected and named "... (kopie)"
    const select = page.getByTestId("preset-select");
    await expect(select).toHaveValue(/.+/);
    const selectedLabel = await select.evaluate(
      (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? "",
    );
    expect(selectedLabel).toContain("(kopie)");

    // Preview content must still be intact (same plan, just duplicated)
    const preview = page.getByTestId("preview-panel");
    await expect(preview).toContainText("Arya");
    await expect(preview).toContainText("Veldslag");

    // Continuity is unaffected by preset duplication — locations still locked
    const continuity = page.getByTestId("continuity-panel");
    await expect(continuity).toContainText("Winterfell");
    await expect(continuity).toContainText("Kings Landing");
  });
});

test.describe("Story Setup Wizard gating", () => {
  test("wizard is required before Chapter 1 can be planned", async ({ page }) => {
    // Seed a story without chapters, beginningState or endGoal
    await page.addInitScript(
      ([key, storyId]) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            state: {
              stories: [
                {
                  id: storyId,
                  title: "Fresh Saga",
                  language: "Nederlands",
                  genres: [],
                  tones: [],
                  characters: [],
                  locations: [],
                  factions: [],
                  chapters: [],
                  timeline: [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
            },
            version: 0,
          }),
        );
      },
      [STORE_KEY, "e2e-story-fresh"],
    );

    await page.goto("/story/e2e-story-fresh");

    // Wizard is shown, planner is NOT
    await expect(page.getByTestId("story-setup-wizard")).toBeVisible();
    await expect(page.getByTestId("planner-toolbar")).toHaveCount(0);

    // Save disabled until both fields are filled
    await expect(page.getByTestId("wizard-save")).toBeDisabled();

    await page
      .getByTestId("wizard-beginning")
      .fill("Het rijk staat op de rand van burgeroorlog na de moord op de koning.");
    await expect(page.getByTestId("wizard-save")).toBeDisabled();

    await page
      .getByTestId("wizard-endgoal")
      .fill("De troon valt in handen van de jongste erfgenaam.");
    await expect(page.getByTestId("wizard-save")).toBeEnabled();
    await page.getByTestId("wizard-save").click();

    // Planner now appears
    await expect(page.getByTestId("planner-toolbar")).toBeVisible();
    await expect(page.getByTestId("story-setup-wizard")).toHaveCount(0);
  });
});
