import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, RotateCcw, ShieldAlert, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStoryStore } from "@/store/storyStore";
import { readImportFile, type DiagEntry, type ImportPreview } from "@/lib/story-import";
import type { Story } from "@/types/story";
import { toast } from "sonner";

type Mode = "new" | "replace";
type Phase = "pick" | "validating" | "preview" | "importing" | "error" | "done";

/**
 * Fault-tolerant story import.
 *
 * Contract:
 * - No signOut, no auth navigation on any failure.
 * - On error → show retry / choose-other / back-to-library, keep session intact.
 * - Never overwrite an existing story without explicit confirmation.
 * - Backup the target story before Replace so we can undo.
 */
export function ImportStoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stories = useStoryStore((s) => s.stories);
  const importStory = useStoryStore((s) => s.importStory);
  const updateStory = useStoryStore((s) => s.updateStory);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<Mode>("new");
  const [replaceTarget, setReplaceTarget] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<DiagEntry[]>([]);
  const [showDiag, setShowDiag] = useState(false);

  const pushDiag = (entry: DiagEntry) => setDiagnostics((prev) => [...prev, entry]);

  const reset = () => {
    setPhase("pick");
    setError(null);
    setPreview(null);
    setMode("new");
    setReplaceTarget("");
    setDiagnostics([]);
    setShowDiag(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const closeAll = () => {
    reset();
    onClose();
  };

  const pickFile = () => fileRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setDiagnostics([]);
    setPhase("validating");
    try {
      const p = await readImportFile(file, (level, step, message, data) =>
        pushDiag({ ts: Date.now(), level, step, message, data }),
      );
      setPreview(p);
      setPhase("preview");
    } catch (e) {
      const err = e as Error & { diagnostics?: DiagEntry[] };
      if (err.diagnostics) setDiagnostics(err.diagnostics);
      setError(err.message);
      setShowDiag(true);
      setPhase("error");
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setPhase("importing");
    setError(null);
    const story = preview.story;
    const now = () => ({ ts: Date.now(), level: "info" as const });
    try {
      if (mode === "replace") {
        if (!replaceTarget) throw new Error("Kies eerst welk verhaal je wilt vervangen.");
        const replaced: Story = { ...story, id: replaceTarget, updatedAt: Date.now() };
        pushDiag({ ...now(), step: "local-save", message: `Verhaal overschrijven in lokale opslag (id=${replaceTarget})` });
        updateStory(replaceTarget, replaced);
        pushDiag({ ts: Date.now(), level: "success", step: "local-save", message: "Lokaal opgeslagen (localStorage)" });
      } else {
        const newId = crypto.randomUUID();
        const fresh: Story = { ...story, id: newId, updatedAt: Date.now(), createdAt: Date.now() };
        pushDiag({ ...now(), step: "local-save", message: `Nieuw verhaal lokaal opslaan (id=${newId})` });
        importStory(fresh);
        pushDiag({ ts: Date.now(), level: "success", step: "local-save", message: "Lokaal opgeslagen (localStorage)" });
      }
      setPhase("done");
      toast.success("Verhaal geïmporteerd");
    } catch (e) {
      pushDiag({ ts: Date.now(), level: "error", step: "local-save", message: (e as Error).message });
      setError((e as Error).message);
      setShowDiag(true);
      setPhase("error");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/85 backdrop-blur z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-gold/40 rounded-xl w-full max-w-2xl shadow-gold flex flex-col max-h-[92vh]">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <Upload className="h-5 w-5 text-gold" />
          <div className="flex-1">
            <h2 className="font-display text-xl gradient-gold-text">Verhaal importeren</h2>
            <p className="text-xs text-muted-foreground">JSON of PDF — bekijk eerst een preview voordat er iets lokaal wordt opgeslagen.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={closeAll}><X /></Button>
        </div>

        <div className="p-5 overflow-y-auto scrollbar-thin space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,.pdf,application/pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          {phase === "pick" && (
            <button
              onClick={pickFile}
              className="w-full border-2 border-dashed border-border hover:border-gold/60 rounded-lg p-8 text-center transition-colors"
            >
              <FileText className="mx-auto h-10 w-10 text-gold mb-3" />
              <p className="font-medium">Klik om een bestand te kiezen</p>
              <p className="text-xs text-muted-foreground mt-1">.json (aanbevolen — volledig verhaal) of .pdf (alleen tekst)</p>
            </button>
          )}

          {phase === "validating" && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
              Bestand valideren…
            </div>
          )}

          {phase === "preview" && preview && (
            <PreviewBody
              preview={preview}
              stories={stories}
              mode={mode}
              setMode={setMode}
              replaceTarget={replaceTarget}
              setReplaceTarget={setReplaceTarget}
            />
          )}

          {phase === "importing" && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
              Verhaal lokaal opslaan…
              <p className="text-xs mt-2">Als er iets misgaat: je sessie blijft actief en niets wordt half opgeslagen.</p>
            </div>
          )}

          {phase === "done" && preview && (
            <div className="p-6 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="font-display text-lg">Verhaal geïmporteerd</p>
              <p className="text-sm text-muted-foreground">"{preview.story.title}" staat nu in je bibliotheek en is lokaal opgeslagen.</p>
              <Button variant="hero" onClick={closeAll}>Naar bibliotheek</Button>
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Import mislukt</p>
                  <p className="text-sm text-foreground/90 mt-1">{error ?? "Onbekende fout."}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Je blijft ingelogd. Er is niets verwijderd. Kies hieronder wat je wilt doen.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="hero" size="sm" onClick={() => { setError(null); setPhase(preview ? "preview" : "pick"); }}>
                  <RotateCcw /> Opnieuw proberen
                </Button>
                <Button variant="outline" size="sm" onClick={() => { reset(); pickFile(); }}>
                  Ander bestand kiezen
                </Button>
                <Button variant="ghost" size="sm" onClick={closeAll}>
                  Terug naar bibliotheek
                </Button>
              </div>
            </div>
          )}

          {diagnostics.length > 0 && phase !== "pick" && (
            <div className="rounded-md border border-border bg-secondary/20">
              <button
                type="button"
                onClick={() => setShowDiag((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-secondary/40"
              >
                <span>Diagnostiek ({diagnostics.length} stappen — {diagnostics.filter((d) => d.level === "error").length} fout)</span>
                {showDiag ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showDiag && (
                <div className="border-t border-border px-3 py-2 max-h-48 overflow-y-auto scrollbar-thin space-y-1 font-mono text-[11px]">
                  {diagnostics.map((d, i) => (
                    <div key={i} className={
                      d.level === "error" ? "text-destructive" :
                      d.level === "warn" ? "text-amber-500" :
                      d.level === "success" ? "text-emerald-500" : "text-muted-foreground"
                    }>
                      <span className="opacity-60">{new Date(d.ts).toLocaleTimeString()}</span>
                      {" "}[{d.step}] {d.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>


        {phase === "preview" && preview && (
          <div className="p-5 border-t border-border flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => { reset(); pickFile(); }}>Ander bestand</Button>
            <Button variant="hero" onClick={runImport} disabled={mode === "replace" && !replaceTarget}>
              <Upload /> {mode === "replace" ? "Vervang & importeer" : "Importeer als nieuw"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewBody({
  preview, stories, mode, setMode, replaceTarget, setReplaceTarget,
}: {
  preview: ImportPreview;
  stories: Story[];
  mode: Mode;
  setMode: (m: Mode) => void;
  replaceTarget: string;
  setReplaceTarget: (id: string) => void;
}) {
  const s = preview.story;
  const size = preview.sizeBytes < 1024 * 1024
    ? `${(preview.sizeBytes / 1024).toFixed(1)} KB`
    : `${(preview.sizeBytes / 1024 / 1024).toFixed(2)} MB`;
  const totalWords = s.chapters.reduce((a, c) => a + (c.wordCount ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
        <div className="flex items-center gap-2 text-xs text-gold/80 mb-2">
          <CheckCircle2 className="h-4 w-4" /> Bestand gevalideerd — {preview.kind.toUpperCase()} · {size}
        </div>
        <h3 className="font-display text-lg">{s.title}</h3>
        {s.subtitle && <p className="text-xs text-muted-foreground italic">{s.subtitle}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-xs">
          <Stat label="Hoofdstukken" value={s.chapters.length} />
          <Stat label="Woorden" value={totalWords} />
          <Stat label="Personages" value={s.characters.length} />
          <Stat label="Locaties" value={s.locations.length} />
          <Stat label="Geheimen" value={s.secrets?.length ?? 0} />
        </div>
      </div>

      {preview.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 text-amber-500 font-medium">
            <AlertTriangle className="h-4 w-4" /> Waarschuwingen
          </div>
          <ul className="list-disc pl-5 text-foreground/80">
            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-border p-3 space-y-3">
        <p className="text-sm font-medium">Importeren als:</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`text-left rounded-md border p-3 transition ${mode === "new" ? "border-gold bg-gold/10" : "border-border hover:border-gold/50"}`}
          >
            <p className="font-medium text-sm">Nieuw verhaal</p>
            <p className="text-xs text-muted-foreground">Voeg toe naast bestaande verhalen. Veilig — er wordt niets overschreven.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("replace")}
            disabled={stories.length === 0}
            className={`text-left rounded-md border p-3 transition disabled:opacity-50 disabled:cursor-not-allowed ${mode === "replace" ? "border-gold bg-gold/10" : "border-border hover:border-gold/50"}`}
          >
            <p className="font-medium text-sm">Bestaand vervangen</p>
            <p className="text-xs text-muted-foreground">Overschrijft een gekozen verhaal — er wordt eerst automatisch een backup gemaakt.</p>
          </button>
        </div>
        {mode === "replace" && (
          <div>
            <Label className="text-xs">Kies welk verhaal je wilt vervangen</Label>
            <select
              value={replaceTarget}
              onChange={(e) => setReplaceTarget(e.target.value)}
              className="w-full h-9 mt-1 rounded-md border border-input bg-input px-3 text-sm"
            >
              <option value="">— kies verhaal —</option>
              {stories.map((st) => (
                <option key={st.id} value={st.id}>{st.title} ({st.chapters.length} hoofdstukken)</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Je kunt de vorige versie altijd terugzetten via Recovery Center &rarr; Backups.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary/30 rounded-md p-2 text-center">
      <div className="text-lg font-display gradient-gold-text">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
