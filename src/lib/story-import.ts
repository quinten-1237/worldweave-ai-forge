// Safe, fault-tolerant story import.
//
// Design guarantees:
// - Never signs the user out on failure.
// - Never overwrites an existing story silently: the user picks New / Replace.
// - Validates file type + shape before writing anything to the cloud.
// - Wraps the whole save in a try/catch and rolls back the local cache if the
//   cloud write fails, so no half-written state remains.

import type { Story, Chapter } from "@/types/story";

export type ImportKind = "json" | "pdf";
export interface ImportPreview {
  kind: ImportKind;
  sourceName: string;
  sizeBytes: number;
  story: Story;
  warnings: string[];
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB hard cap

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function ensureStoryShape(raw: unknown, sourceName: string): { story: Story; warnings: string[] } {
  if (!raw || typeof raw !== "object") throw new Error("Bestand bevat geen geldig verhaal-object.");
  const o = raw as Record<string, unknown>;
  const warnings: string[] = [];

  const title = typeof o.title === "string" && o.title.trim() ? o.title : sourceName.replace(/\.[^.]+$/, "");
  const chapters = Array.isArray(o.chapters) ? (o.chapters as Chapter[]) : [];
  if (!Array.isArray(o.chapters)) warnings.push("Geen 'chapters' array — er wordt met 0 hoofdstukken geïmporteerd.");
  const characters = Array.isArray(o.characters) ? o.characters : [];
  const locations = Array.isArray(o.locations) ? o.locations : [];
  const factions = Array.isArray(o.factions) ? o.factions : [];
  const timeline = Array.isArray(o.timeline) ? o.timeline : [];

  const story: Story = {
    id: typeof o.id === "string" ? o.id : uid(),
    title,
    subtitle: typeof o.subtitle === "string" ? o.subtitle : undefined,
    description: typeof o.description === "string" ? o.description : undefined,
    ageCategory: typeof o.ageCategory === "string" ? o.ageCategory : undefined,
    language: typeof o.language === "string" ? o.language : "Nederlands",
    genres: Array.isArray(o.genres) ? (o.genres as string[]) : [],
    tones: Array.isArray(o.tones) ? (o.tones as string[]) : [],
    beginningState: typeof o.beginningState === "string" ? o.beginningState : undefined,
    endGoal: typeof o.endGoal === "string" ? o.endGoal : undefined,
    characters: characters as Story["characters"],
    locations: locations as Story["locations"],
    factions: factions as Story["factions"],
    magic: (o.magic as Story["magic"]) ?? undefined,
    chapters: chapters.map((c, i) => ({
      id: c?.id ?? uid(),
      number: c?.number ?? i + 1,
      title: c?.title ?? `Hoofdstuk ${i + 1}`,
      content: typeof c?.content === "string" ? c.content : "",
      wordCount: typeof c?.wordCount === "number" ? c.wordCount : (typeof c?.content === "string" ? c.content.trim().split(/\s+/).filter(Boolean).length : 0),
      choices: Array.isArray(c?.choices) ? c.choices : undefined,
      chosenOption: c?.chosenOption,
      createdAt: typeof c?.createdAt === "number" ? c.createdAt : Date.now(),
      plan: c?.plan,
    })),
    timeline: timeline as Story["timeline"],
    relationships: Array.isArray(o.relationships) ? (o.relationships as Story["relationships"]) : [],
    chapterPresets: Array.isArray(o.chapterPresets) ? (o.chapterPresets as Story["chapterPresets"]) : [],
    futurePlans: Array.isArray(o.futurePlans) ? (o.futurePlans as Story["futurePlans"]) : [],
    secrets: Array.isArray(o.secrets) ? (o.secrets as Story["secrets"]) : [],
    favorite: !!o.favorite,
    createdAt: typeof o.createdAt === "number" ? o.createdAt : Date.now(),
    updatedAt: Date.now(),
    lastReadChapter: typeof o.lastReadChapter === "number" ? o.lastReadChapter : undefined,
  };
  return { story, warnings };
}

async function readJson(file: File): Promise<ImportPreview> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("Ongeldige JSON: " + (e as Error).message);
  }
  const { story, warnings } = ensureStoryShape(parsed, file.name);
  return { kind: "json", sourceName: file.name, sizeBytes: file.size, story, warnings };
}

async function readPdf(file: File): Promise<ImportPreview> {
  // Dynamic import so pdfjs is only loaded when someone actually picks a PDF.
  const pdfjs = await import("pdfjs-dist");
  // Worker is heavy; use the ESM worker via URL. Fall back to no-worker mode
  // if the worker URL cannot be resolved (still works, just single-threaded).
  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    // ignore — pdfjs will complain but still work in fake-worker mode
  }
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pageTexts.push(text);
  }
  const full = pageTexts.join("\n\n");
  // Split on "Hoofdstuk N" / "Chapter N" / "H1." headings; fallback → per-page chapter.
  const headingRe = /(?:^|\n)\s*(?:hoofdstuk|chapter|h)\s*(\d+)[:.\s-]+/gi;
  const matches = [...full.matchAll(headingRe)];
  const chapters: Chapter[] = [];
  if (matches.length >= 2) {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index ?? full.length : full.length;
      const content = full.slice(start, end).trim();
      const num = parseInt(m[1], 10) || i + 1;
      chapters.push({
        id: uid(),
        number: num,
        title: `Hoofdstuk ${num}`,
        content,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        createdAt: Date.now(),
      });
    }
  } else {
    // Per-page chapters
    pageTexts.forEach((t, i) => {
      chapters.push({
        id: uid(),
        number: i + 1,
        title: `Pagina ${i + 1}`,
        content: t,
        wordCount: t.split(/\s+/).filter(Boolean).length,
        createdAt: Date.now(),
      });
    });
  }
  const story: Story = {
    id: uid(),
    title: file.name.replace(/\.pdf$/i, ""),
    language: "Nederlands",
    genres: [],
    tones: [],
    characters: [],
    locations: [],
    factions: [],
    chapters,
    timeline: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const warnings: string[] = [];
  if (chapters.length === 0) warnings.push("Kon geen tekst uit de PDF halen — het bestand is misschien gescand (afbeeldingen) in plaats van tekst.");
  if (matches.length < 2 && chapters.length > 0) warnings.push("Geen hoofdstuk-koppen gevonden — elke pagina wordt als apart hoofdstuk geïmporteerd.");
  return { kind: "pdf", sourceName: file.name, sizeBytes: file.size, story, warnings };
}

export async function readImportFile(file: File): Promise<ImportPreview> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Bestand is te groot (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".json") || file.type === "application/json") return readJson(file);
  if (lower.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file);
  throw new Error(`Bestandstype niet ondersteund: ${file.name}. Gebruik .json of .pdf.`);
}
