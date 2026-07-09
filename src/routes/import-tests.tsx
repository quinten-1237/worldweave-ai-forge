import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PlayCircle, XCircle, Loader2 } from "lucide-react";
import { readImportFile, type ImportPreview } from "@/lib/story-import";

export const Route = createFileRoute("/import-tests")({
  head: () => ({ meta: [{ title: "Import Testset — StoryForge AI" }] }),
  component: ImportTests,
});

interface TestCase {
  name: string;
  description: string;
  make: () => Promise<File>;
  expect: (p: ImportPreview) => string | null; // null = pass, string = failure reason
}

function jsonFile(name: string, obj: unknown): File {
  return new File([JSON.stringify(obj)], name, { type: "application/json" });
}

function makeChapters(n: number, wordsPer: number) {
  const words = Array.from({ length: wordsPer }, (_, i) => `woord${i}`).join(" ");
  return Array.from({ length: n }, (_, i) => ({
    id: `ch-${i}`,
    number: i + 1,
    title: `Hoofdstuk ${i + 1}`,
    content: words,
    wordCount: wordsPer,
    createdAt: Date.now(),
  }));
}

// Minimal 1-page PDF with a piece of text — hand-crafted so tests don't need pdf-lib.
async function makeTinyPdf(): Promise<File> {
  // Minimal valid PDF with "Hello" text using standard font Helvetica.
  const pdf = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 18 Tf 20 100 Td (Hoofdstuk 1 Hallo wereld) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000191 00000 n 
0000000277 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
340
%%EOF`;
  return new File([pdf], "tiny.pdf", { type: "application/pdf" });
}

const TESTS: TestCase[] = [
  {
    name: "Klein JSON verhaal",
    description: "1 hoofdstuk, 50 woorden — snel & minimal",
    make: async () => jsonFile("small.json", { title: "Klein", chapters: makeChapters(1, 50) }),
    expect: (p) => (p.story.chapters.length === 1 ? null : `Verwacht 1 hoofdstuk, kreeg ${p.story.chapters.length}`),
  },
  {
    name: "Groot JSON verhaal",
    description: "50 hoofdstukken × 2.000 woorden",
    make: async () => jsonFile("large.json", { title: "Groot", chapters: makeChapters(50, 2000) }),
    expect: (p) => {
      if (p.story.chapters.length !== 50) return `Verwacht 50 hoofdstukken, kreeg ${p.story.chapters.length}`;
      const totalWords = p.story.chapters.reduce((a, c) => a + (c.wordCount ?? 0), 0);
      if (totalWords < 90_000) return `Woordentelling te laag: ${totalWords}`;
      return null;
    },
  },
  {
    name: "500+ hoofdstukken",
    description: "600 hoofdstukken × 100 woorden — stresstest",
    make: async () => jsonFile("huge.json", { title: "Mega", chapters: makeChapters(600, 100) }),
    expect: (p) => (p.story.chapters.length === 600 ? null : `Verwacht 600 hoofdstukken, kreeg ${p.story.chapters.length}`),
  },
  {
    name: "Beeld/lege PDF (geen tekst)",
    description: "PDF zonder extraheerbare tekst — moet een waarschuwing geven maar niet crashen",
    make: async () => {
      // A PDF without any text-content stream.
      const pdf = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Contents 4 0 R>>endobj
4 0 obj<</Length 0>>stream
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000168 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
210
%%EOF`;
      return new File([pdf], "empty.pdf", { type: "application/pdf" });
    },
    expect: (p) => (p.warnings.some((w) => w.toLowerCase().includes("gescand") || w.toLowerCase().includes("geen tekst")) ? null : "Verwachtte een waarschuwing voor lege/gescande PDF"),
  },
  {
    name: "Kleine PDF met 1 hoofdstuk",
    description: "Tekst-PDF met 'Hoofdstuk 1' kop",
    make: makeTinyPdf,
    expect: (p) => (p.story.chapters.length >= 1 ? null : "Geen hoofdstuk uit tekst-PDF geëxtraheerd"),
  },
  {
    name: "Ongeldig JSON",
    description: "Corrupt bestand — moet netjes falen (geen crash)",
    make: async () => new File(["dit is geen json {"], "bad.json", { type: "application/json" }),
    expect: () => "Had moeten falen tijdens validatie",
  },
];

interface TestResult {
  name: string;
  status: "pass" | "fail" | "running" | "pending";
  message?: string;
  durationMs?: number;
  steps?: number;
  chapters?: number;
  words?: number;
}

function ImportTests() {
  const [results, setResults] = useState<TestResult[]>(TESTS.map((t) => ({ name: t.name, status: "pending" })));
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const next: TestResult[] = TESTS.map((t) => ({ name: t.name, status: "pending" }));
    setResults([...next]);
    for (let i = 0; i < TESTS.length; i++) {
      const t = TESTS[i];
      next[i] = { name: t.name, status: "running" };
      setResults([...next]);
      const start = performance.now();
      try {
        const file = await t.make();
        const preview = await readImportFile(file);
        const err = t.expect(preview);
        const dur = performance.now() - start;
        const totalWords = preview.story.chapters.reduce((a, c) => a + (c.wordCount ?? 0), 0);
        next[i] = err
          ? { name: t.name, status: "fail", message: err, durationMs: dur, steps: preview.diagnostics.length, chapters: preview.story.chapters.length, words: totalWords }
          : { name: t.name, status: "pass", durationMs: dur, steps: preview.diagnostics.length, chapters: preview.story.chapters.length, words: totalWords };
      } catch (e) {
        const dur = performance.now() - start;
        // For the "should-fail" test, an exception is actually a pass.
        if (t.name === "Ongeldig JSON") {
          next[i] = { name: t.name, status: "pass", message: `Correct afgewezen: ${(e as Error).message}`, durationMs: dur };
        } else {
          next[i] = { name: t.name, status: "fail", message: (e as Error).message, durationMs: dur };
        }
      }
      setResults([...next]);
    }
    setRunning(false);
  };

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl gradient-gold-text">Import Testset</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Voert automatisch klein / groot / afbeeldings- / 500+-hoofdstukken scenario's uit.
            </p>
          </div>
          <Button variant="hero" onClick={run} disabled={running}>
            {running ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            {running ? "Bezig…" : "Start tests"}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border bg-secondary/20 p-3 text-center">
            <div className="text-2xl font-display gradient-gold-text">{results.length}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Totaal</div>
          </div>
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
            <div className="text-2xl font-display text-emerald-500">{passCount}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Geslaagd</div>
          </div>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-center">
            <div className="text-2xl font-display text-destructive">{failCount}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Gefaald</div>
          </div>
        </div>

        <div className="space-y-2">
          {results.map((r, i) => {
            const tc = TESTS[i];
            return (
              <div key={r.name} className={
                "rounded-md border p-3 " +
                (r.status === "pass" ? "border-emerald-500/40 bg-emerald-500/5" :
                 r.status === "fail" ? "border-destructive/40 bg-destructive/5" :
                 r.status === "running" ? "border-gold/40 bg-gold/5" :
                 "border-border")
              }>
                <div className="flex items-start gap-3">
                  {r.status === "pass" && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
                  {r.status === "fail" && <XCircle className="h-5 w-5 text-destructive mt-0.5" />}
                  {r.status === "running" && <Loader2 className="h-5 w-5 text-gold mt-0.5 animate-spin" />}
                  {r.status === "pending" && <div className="h-5 w-5 rounded-full border-2 border-border mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{tc.description}</p>
                    {r.message && <p className="text-xs mt-1 font-mono">{r.message}</p>}
                    {r.status === "pass" && r.chapters != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.chapters} hoofdstukken · {r.words?.toLocaleString() ?? 0} woorden · {r.steps} diag-stappen · {r.durationMs?.toFixed(0)}ms
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
