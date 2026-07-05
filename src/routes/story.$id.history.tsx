import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  listStoryVersions,
  listStoryBackups,
  restoreStoryVersion,
  restoreStoryBackup,
  saveStoryBackup,
  getStoryVersionData,
  getStoryBackupData,
} from "@/lib/story-sync.functions";
import { ArrowLeft, History, ShieldCheck, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStoryStore } from "@/store/storyStore";

export const Route = createFileRoute("/story/$id/history")({
  head: () => ({ meta: [{ title: "Recovery Center — StoryForge AI" }] }),
  component: HistoryView,
});

interface VersionRow { id: string; summary: string | null; kind: string; created_at: string }
interface BackupRow { id: string; label: string | null; kind: string; created_at: string }

function HistoryView() {
  const { id } = Route.useParams();
  const story = useStoryStore((s) => s.stories.find((st) => st.id === id));
  const [tab, setTab] = useState<"versions" | "backups">("versions");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<unknown | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selected, setSelected] = useState<{ kind: "version" | "backup"; id: string } | null>(null);

  const listV = useServerFn(listStoryVersions);
  const listB = useServerFn(listStoryBackups);
  const restoreV = useServerFn(restoreStoryVersion);
  const restoreB = useServerFn(restoreStoryBackup);
  const backup = useServerFn(saveStoryBackup);
  const getV = useServerFn(getStoryVersionData);
  const getB = useServerFn(getStoryBackupData);

  useEffect(() => {
    setLoading(true);
    Promise.all([listV({ data: { storyId: id } }), listB({ data: { storyId: id } })])
      .then(([v, b]) => { setVersions(v as VersionRow[]); setBackups(b as BackupRow[]); })
      .catch((e) => toast.error("Kon geschiedenis niet laden: " + (e as Error).message))
      .finally(() => setLoading(false));
  }, [id, listV, listB]);

  const selectItem = async (kind: "version" | "backup", itemId: string) => {
    setSelected({ kind, id: itemId });
    setPreviewLoading(true);
    setPreview(null);
    try {
      const d = kind === "version"
        ? await getV({ data: { versionId: itemId } })
        : await getB({ data: { backupId: itemId } });
      setPreview(d);
    } catch (e) {
      toast.error("Kon preview niet laden: " + (e as Error).message);
    } finally { setPreviewLoading(false); }
  };

  const restore = async () => {
    if (!selected) return;
    if (!confirm("Weet je zeker dat je deze staat wilt herstellen? Er wordt eerst een backup van je huidige verhaal gemaakt.")) return;
    setRestoring(true);
    try {
      await backup({ data: { storyId: id, kind: "pre-restore", label: "Voor handmatig herstel" } });
      if (selected.kind === "version") await restoreV({ data: { versionId: selected.id } });
      else await restoreB({ data: { backupId: selected.id } });
      toast.success("Hersteld — verhaal wordt opnieuw geladen…");
      // Wipe local cache so realtime + hydrate rebuilds fresh state.
      useStoryStore.setState((s) => ({ stories: s.stories.filter((x) => x.id !== id) }));
      window.location.href = `/story/${id}`;
    } catch (e) {
      toast.error("Herstel mislukt: " + (e as Error).message);
    } finally { setRestoring(false); }
  };

  const rows = tab === "versions" ? versions : backups;

  return (
    <AppShell>
      <div className="min-h-screen">
        <div className="border-b border-border bg-card/40 sticky top-0 z-20">
          <div className="px-6 md:px-12 py-4 flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/story/$id" params={{ id }}><ArrowLeft /> Terug</Link>
            </Button>
            <div>
              <h1 className="font-display text-2xl gradient-gold-text">Recovery Center</h1>
              <p className="text-xs text-muted-foreground">{story?.title ?? "Verhaal"}</p>
            </div>
          </div>
          <div className="px-6 md:px-12 pb-2 flex gap-2">
            <button
              onClick={() => setTab("versions")}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md ${tab === "versions" ? "text-gold border-b-2 border-gold" : "text-muted-foreground"}`}
            ><History className="h-4 w-4" /> Versies <span className="text-xs opacity-60">{versions.length}</span></button>
            <button
              onClick={() => setTab("backups")}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md ${tab === "backups" ? "text-gold border-b-2 border-gold" : "text-muted-foreground"}`}
            ><ShieldCheck className="h-4 w-4" /> Backups <span className="text-xs opacity-60">{backups.length}</span></button>
          </div>
        </div>

        <div className="px-6 md:px-12 py-8 grid lg:grid-cols-[380px,1fr] gap-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />Laden…</div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nog niets opgeslagen.</div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto scrollbar-thin divide-y divide-border">
                {rows.map((r) => {
                  const active = selected?.id === r.id;
                  const dt = new Date(r.created_at);
                  const label = "summary" in r ? r.summary : r.label;
                  return (
                    <button
                      key={r.id}
                      onClick={() => selectItem(tab === "versions" ? "version" : "backup", r.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-secondary/40 transition ${active ? "bg-secondary/60" : ""}`}
                    >
                      <div className="text-sm font-medium">{label ?? (tab === "versions" ? "Autosave" : "Backup")}</div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>{dt.toLocaleString("nl-NL")}</span>
                        <span className="text-[10px] uppercase tracking-wider text-gold/70">{r.kind}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-6 min-h-[400px]">
            {!selected ? (
              <p className="text-muted-foreground text-sm">Selecteer een versie of backup om een preview te zien.</p>
            ) : previewLoading ? (
              <div className="text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />Preview laden…</div>
            ) : (
              <PreviewPanel data={preview} onRestore={restore} restoring={restoring} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PreviewPanel({ data, onRestore, restoring }: { data: unknown; onRestore: () => void; restoring: boolean }) {
  if (!data || typeof data !== "object") return <p className="text-sm text-muted-foreground">Lege snapshot.</p>;
  const d = data as Record<string, unknown>;
  const chapters = Array.isArray(d.chapters) ? (d.chapters as { title: string; number: number; wordCount?: number }[]) : [];
  const characters = Array.isArray(d.characters) ? (d.characters as { name: string }[]) : [];
  const locations = Array.isArray(d.locations) ? (d.locations as { name: string }[]) : [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">{(d.title as string) ?? "Verhaal"}</h2>
        <Button variant="hero" size="sm" onClick={onRestore} disabled={restoring}>
          {restoring ? <Loader2 className="animate-spin" /> : <RotateCcw />} Herstel deze staat
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Hoofdstukken" value={chapters.length} />
        <Stat label="Personages" value={characters.length} />
        <Stat label="Locaties" value={locations.length} />
      </div>
      {chapters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gold">Hoofdstukken</h3>
          <ul className="space-y-1 text-sm max-h-64 overflow-y-auto scrollbar-thin">
            {chapters.map((c, i) => (
              <li key={i} className="text-muted-foreground"><span className="text-foreground">H{c.number}.</span> {c.title} <span className="text-xs opacity-60">({c.wordCount ?? "?"} w)</span></li>
            ))}
          </ul>
        </div>
      )}
      {characters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gold">Personages</h3>
          <p className="text-sm text-muted-foreground">{characters.map((c) => c.name).join(", ")}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary/30 rounded-md p-3">
      <div className="text-2xl font-display gradient-gold-text">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
