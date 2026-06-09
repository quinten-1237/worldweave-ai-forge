import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { getGateway, DEFAULT_MODEL } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function extractJSON(raw: string): unknown {
  let cleaned = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const objStart = cleaned.indexOf("{");
    const arrStart = cleaned.indexOf("[");
    const isArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    const start = isArray ? arrStart : objStart;
    const end = isArray ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON found in response");
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

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
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      storyContext: z.string(),
      hint: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      system:
        "Je bent een meesterverteller die rijke, originele fantasy-personages bedenkt. Antwoord in het Nederlands. Geef ALLEEN geldige JSON terug, geen markdown of uitleg.",
      prompt: `Genereer een geheel nieuw, origineel personage dat past in dit verhaal.

Verhaalcontext:
${data.storyContext}

${data.hint ? `Hint: ${data.hint}` : ""}

Antwoord met EEN JSON-object met deze velden (alle strings): name, age, gender, appearance, personality, motivations, goals, secrets, skills, relationships. Wees creatief en gedetailleerd.`,
    });
    return CharacterSchema.parse(extractJSON(text));
  });

const ChapterSchema = z.object({
  title: z.string(),
  content: z.string(),
  choices: z.array(z.object({ label: z.string(), description: z.string() })).min(1),
  timelineEvents: z.array(z.object({ title: z.string(), description: z.string() })).max(5),
});

export const generateChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      storyContext: z.string(),
      previousSummary: z.string(),
      chapterNumber: z.number(),
      userChoice: z.string().optional(),
      directorInstructions: z.string().optional(),
      minWords: z.number().default(1500),
    }),
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      system: `Je bent een bestseller fantasy-romanschrijver. Schrijf in het Nederlands meeslepende hoofdstukken (vergelijkbaar met Sanderson, Rothfuss, Martin).
BELANGRIJK: het hoofdstuk MOET minimaal ${data.minWords} woorden bevatten. Houd alle eerdere gebeurtenissen, personages en wereldinformatie consistent.
Geef ALLEEN geldige JSON terug, geen markdown fences of uitleg.`,
      prompt: `Schrijf hoofdstuk ${data.chapterNumber}.

==== WERELD- EN VERHAALCONTEXT ====
${data.storyContext}

==== SAMENVATTING VAN EERDERE HOOFDSTUKKEN ====
${data.previousSummary || "(nog geen eerdere hoofdstukken — dit is hoofdstuk 1)"}

${data.userChoice ? `==== KEUZE VAN DE LEZER ====\n${data.userChoice}\n` : ""}
${data.directorInstructions ? `==== STORY DIRECTOR — STRIKTE REGIE-INSTRUCTIES (verplicht naleven) ====\n${data.directorInstructions}\n` : ""}

Antwoord met EEN JSON-object met deze structuur:
{
  "title": "hoofdstuktitel",
  "content": "volledige hoofdstuktekst van minimaal ${data.minWords} woorden",
  "choices": [{"label":"...","description":"..."},{"label":"...","description":"..."},{"label":"...","description":"..."}],
  "timelineEvents": [{"title":"...","description":"..."}]
}`,
    });
    const object = ChapterSchema.parse(extractJSON(text));
    const wordCount = object.content.trim().split(/\s+/).length;
    return { ...object, wordCount };
  });

export const summarizeChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
      const rawBody = await res.text();
      console.error(`[generateImage] upstream error ${res.status}: ${rawBody}`);
      throw new Error("Image generation failed. Please try again later.");
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    return { dataUrl: `data:image/png;base64,${b64}` };
  });
