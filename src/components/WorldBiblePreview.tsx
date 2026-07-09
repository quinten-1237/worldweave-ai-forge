import { useState } from "react";
import { BookOpen, Download, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoryStore } from "@/store/storyStore";
import { buildWorldBible, partitionSecrets } from "@/lib/world-bible";

function downloadTextFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Modal die exact toont wat de AI ziet vóór het schrijven van het volgende hoofdstuk:
 * Story context + toekomstplan-instructies + onthulbare geheimen.
 * Verborgen geheimen worden apart getoond zodat je weet wát er verborgen wordt gehouden.
 */
export function WorldBiblePreviewButton({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId));
  if (!story) return null;
  const nextChapter = story.chapters.length + 1;
  const bible = buildWorldBible(story, nextChapter);
  const { unlockable, hidden } = partitionSecrets(story, nextChapter);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BookOpen /> World Bible preview
      </Button>
      {open && (
        <div
          className="fixed inset-0 bg-background/85 backdrop-blur z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-gold/40 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-gold"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-gold" />
              <div className="flex-1">
                <h2 className="font-display text-xl gradient-gold-text">World Bible — hoofdstuk {nextChapter}</h2>
                <p className="text-xs text-muted-foreground">Exact wat de AI leest voordat het volgende hoofdstuk wordt geschreven.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                const header = `# World Bible — ${story.title}\n# Volgend hoofdstuk: ${nextChapter}\n# Geëxporteerd: ${new Date().toISOString()}\n\n`;
                const hiddenBlock = hidden.length
                  ? `\n\n---\nVERBORGEN GEHEIMEN (NIET aan AI meegegeven):\n${hidden.map((s) => `- ${s.title}: ${s.truth}`).join("\n")}\n`
                  : "";
                const unlockBlock = unlockable.length
                  ? `\n\n---\nONTHULBARE GEHEIMEN (mag AI zien):\n${unlockable.map((s) => `- ${s.title}: ${s.truth}`).join("\n")}\n`
                  : "";
                const safeTitle = story.title.replace(/[^\w-]+/g, "_").slice(0, 40) || "story";
                downloadTextFile(`world-bible_${safeTitle}_h${nextChapter}.txt`, header + bible + unlockBlock + hiddenBlock);
              }}>
                <Download /> Export
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X /></Button>
            </div>
            <div className="overflow-y-auto scrollbar-thin p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Personages" value={story.characters.length} />
                <Stat label="Toekomstplannen" value={story.futurePlans?.length ?? 0} />
                <Stat label="Geheimen" value={story.secrets?.length ?? 0} />
              </div>
              <section>
                <h3 className="font-display text-sm text-gold mb-2 flex items-center gap-2"><Eye className="h-4 w-4" /> Passages die AI gebruikt</h3>
                <pre className="text-xs whitespace-pre-wrap font-mono bg-secondary/40 border border-border rounded-md p-3 max-h-[45vh] overflow-y-auto scrollbar-thin">{bible}</pre>
              </section>
              {unlockable.length > 0 && (
                <section className="rounded-md border border-gold/30 bg-gold/5 p-3">
                  <h3 className="font-display text-sm text-gold mb-2">Onthulbare geheimen ({unlockable.length})</h3>
                  <ul className="space-y-1 text-xs">
                    {unlockable.map((s) => <li key={s.id}>• {s.title}</li>)}
                  </ul>
                </section>
              )}
              {hidden.length > 0 && (
                <section className="rounded-md border border-border bg-secondary/20 p-3">
                  <h3 className="font-display text-sm mb-2 flex items-center gap-2"><EyeOff className="h-4 w-4" /> Verborgen voor AI ({hidden.length})</h3>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {hidden.map((s) => <li key={s.id}>• {s.title} — waarheid wordt weggelaten</li>)}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary/30 rounded-md p-2 text-center">
      <div className="text-xl font-display gradient-gold-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
