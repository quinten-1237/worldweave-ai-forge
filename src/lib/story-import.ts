// Safe, fault-tolerant story import.
//
// Design guarantees:
// - Never signs the user out on failure.
// - Never overwrites an existing story silently: the user picks New / Replace.
// - Validates file type + shape before writing anything to the cloud.
// - Emits a structured diagnostic log so the UI can show *exactly* which step
//   failed, hoeveel bytes/pagina's er verwerkt zijn, en welke fout er terugkwam.

import type { Story, Chapter } from "@/types/story";

export type ImportKind = "json" | "pdf";
export type DiagLevel = "info" | "warn" | "error" | "success";
export interface DiagEntry {
  ts: number;
  level: DiagLevel;
  step: string;
  message: string;
  data?: Record<string, unknown>;
}
export type Diag = (level: DiagLevel, step: string, message: string, data?: Record<string, unknown>) => void;

export interface ImportPreview {
  kind: ImportKind;
  sourceName: string;
  sizeBytes: number;
  story: Story;
  warnings: string[];
  diagnostics: DiagEntry[];
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

async function readJson(file: File, diag: Diag): Promise<ImportPreview> {
  diag("info", "read-json", `JSON-bestand lezen (${file.size} bytes)`);
  const text = await file.text();
  diag("info", "read-json", `Bestand ingelezen: ${text.length} tekens`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    diag("success", "parse-json", "JSON succesvol geparsed");
  } catch (e) {
    diag("error", "parse-json", (e as Error).message);
    throw new Error("Ongeldige JSON: " + (e as Error).message);
  }
  const { story, warnings } = ensureStoryShape(parsed, file.name);
  diag("success", "validate-shape", `Structuur OK — ${story.chapters.length} hoofdstukken, ${story.characters.length} personages`);
  warnings.forEach((w) => diag("warn", "validate-shape", w));
  return { kind: "json", sourceName: file.name, sizeBytes: file.size, story, warnings, diagnostics: [] };
}

async function readPdf(file: File, diag: Diag): Promise<ImportPreview> {
  diag("info", "load-pdfjs", "PDF-parser dynamisch laden…");
  const pdfjs = await import("pdfjs-dist");
  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    diag("info", "load-pdfjs", "PDF-worker geconfigureerd");
  } catch (e) {
    diag("warn", "load-pdfjs", "Kon PDF-worker URL niet resolven, fallback naar single-thread modus");
    void e;
  }
  diag("info", "read-pdf", `PDF openen (${(file.size / 1024).toFixed(1)} KB)`);
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  diag("info", "read-pdf", `PDF geladen — ${doc.numPages} pagina('s)`);

  const pageTexts: string[] = [];
  let processedBytes = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pageTexts.push(text);
    processedBytes += text.length;
    if (i % 25 === 0 || i === doc.numPages) {
      diag("info", "extract-pages", `Pagina ${i}/${doc.numPages} verwerkt (${processedBytes} tekens tot nu toe)`);
    }
  }
  diag("success", "extract-pages", `Alle ${doc.numPages} pagina('s) verwerkt — totaal ${processedBytes} tekens`);

  const full = pageTexts.join("\n\n");
  const headingRe = /(?:^|\n)\s*(?:hoofdstuk|chapter|h)\s*(\d+)[:.\s-]+/gi;
  const matches = [...full.matchAll(headingRe)];
  diag("info", "split-chapters", `${matches.length} hoofdstuk-koppen gevonden`);

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
  diag("success", "split-chapters", `${chapters.length} hoofdstukken gemaakt`);

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
  if (chapters.length === 0) {
    warnings.push("Kon geen tekst uit de PDF halen — het bestand is misschien gescand (afbeeldingen) in plaats van tekst.");
    diag("warn", "extract-pages", "Geen tekst gevonden — waarschijnlijk een gescande/afbeeldings-PDF");
  }
  if (matches.length < 2 && chapters.length > 0) {
    warnings.push("Geen hoofdstuk-koppen gevonden — elke pagina wordt als apart hoofdstuk geïmporteerd.");
  }
  return { kind: "pdf", sourceName: file.name, sizeBytes: file.size, story, warnings, diagnostics: [] };
}

/** Read a file with optional diagnostic logging. */
export async function readImportFile(file: File, onDiag?: Diag): Promise<ImportPreview> {
  const log: DiagEntry[] = [];
  const diag: Diag = (level, step, message, data) => {
    const entry = { ts: Date.now(), level, step, message, data };
    log.push(entry);
    onDiag?.(level, step, message, data);
  };
  diag("info", "start", `Bestand ontvangen: ${file.name} (${file.type || "onbekend type"})`);
  if (file.size > MAX_FILE_BYTES) {
    const msg = `Bestand is te groot (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
    diag("error", "size-check", msg);
    throw new Error(msg);
  }
  const lower = file.name.toLowerCase();
  let preview: ImportPreview;
  try {
    if (lower.endsWith(".json") || file.type === "application/json") {
      preview = await readJson(file, diag);
    } else if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      preview = await readPdf(file, diag);
    } else {
      const msg = `Bestandstype niet ondersteund: ${file.name}. Gebruik .json of .pdf.`;
      diag("error", "type-check", msg);
      throw new Error(msg);
    }
  } catch (e) {
    diag("error", "abort", (e as Error).message);
    (e as Error & { diagnostics?: DiagEntry[] }).diagnostics = log;
    throw e;
  }
  preview.diagnostics = log;
  diag("success", "done", "Preview klaar");
  return preview;
}
