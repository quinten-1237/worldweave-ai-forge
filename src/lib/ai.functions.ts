import { createServerFn } from "@tanstack/react-start";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { getGateway, DEFAULT_MODEL } from "./ai-gateway.server";

const CharacterSchema = z.object({
  name: z.string(),
  age: z.string(),
  gender: z.string(),
  appearance: z.string(),
  personality: z.string(),
  motivations: z.string(),
  goals: z.string(),
  secrets: z.string(),
  skills: z.string(),
  relationships: z.string(),
});

export const generateCharacter = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      storyContext: z.string(),
      hint: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_MODEL),
      schema: CharacterSchema,
      system:
        "Je bent een meesterverteller die rijke, originele fantasy-personages bedenkt. Antwoord in het Nederlands.",
      prompt: `Genereer een geheel nieuw, origineel personage dat past in dit verhaal.\n\nVerhaalcontext:\n${data.storyContext}\n\n${
        data.hint ? `Hint: ${data.hint}` : ""
      }\n\nWees creatief, gedetailleerd en geef diepgang.`,
    });
    return object;
  });

const ChapterSchema = z.object({
  title: z.string(),
  content: z.string(),
  choices: z
    .array(z.object({ label: z.string(), description: z.string() }))
    .length(3),
  timelineEvents: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .max(3),
});

export const generateChapter = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      storyContext: z.string(),
      previousSummary: z.string(),
      chapterNumber: z.number(),
      userChoice: z.string().optional(),
      minWords: z.number().default(1500),
    }),
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { object } = await generateObject({
      model: gateway(DEFAULT_MODEL),
      schema: ChapterSchema,
      system: `Je bent een bestseller fantasy-romanschrijver. Schrijf in het Nederlands meeslepende hoofdstukken met:
- Levendige beschrijvingen en sfeer
- Natuurlijke dialogen
- Actie en spanningsopbouw
- Karakterontwikkeling
- Wereldinteractie
Je schrijfstijl is vergelijkbaar met professionele fictieromans (Sanderson, Rothfuss, Martin).
BELANGRIJK: het hoofdstuk MOET minimaal ${data.minWords} woorden bevatten. Houd alle eerdere gebeurtenissen, personages en wereldinformatie consistent.`,
      prompt: `Schrijf hoofdstuk ${data.chapterNumber}.

==== WERELD- EN VERHAALCONTEXT ====
${data.storyContext}

==== SAMENVATTING VAN EERDERE HOOFDSTUKKEN ====
${data.previousSummary || "(nog geen eerdere hoofdstukken — dit is hoofdstuk 1)"}

${data.userChoice ? `==== KEUZE VAN DE LEZER VOOR DIT HOOFDSTUK ====\n${data.userChoice}\n` : ""}

Schrijf nu hoofdstuk ${data.chapterNumber} (minimaal ${data.minWords} woorden). Eindig met drie boeiende keuzes voor het volgende hoofdstuk en lijst de belangrijkste nieuwe gebeurtenissen voor de tijdlijn.`,
    });
    const wordCount = object.content.trim().split(/\s+/).length;
    return { ...object, wordCount };
  });

export const summarizeChapters = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      chapters: z.array(z.object({ number: z.number(), title: z.string(), content: z.string() })),
    }),
  )
  .handler(async ({ data }) => {
    if (data.chapters.length === 0) return { summary: "" };
    const gateway = getGateway();
    const joined = data.chapters
      .map((c) => `Hoofdstuk ${c.number}: ${c.title}\n${c.content.slice(0, 3500)}`)
      .join("\n\n---\n\n");
    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      system: "Vat samen in het Nederlands. Behoud alle belangrijke gebeurtenissen, personage-ontwikkelingen, conflicten en wereldfeiten.",
      prompt: `Vat onderstaande hoofdstukken samen in 6-12 puntsgewijze bullets per hoofdstuk, behoud alle namen en belangrijke details:\n\n${joined}`,
    });
    return { summary: text };
  });

export const generateImage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ prompt: z.string(), style: z.string().optional() }))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `${data.style ?? "dark fantasy oil painting, dramatic lighting, highly detailed"}: ${data.prompt}`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Image gen failed: ${res.status} ${t}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    return { dataUrl: `data:image/png;base64,${b64}` };
  });
