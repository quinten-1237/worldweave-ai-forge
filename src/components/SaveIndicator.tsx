import { useSyncStatus } from "@/lib/story-sync";
import { Check, Loader2, CloudOff, Cloud } from "lucide-react";

export function SaveIndicator() {
  const s = useSyncStatus();
  if (s.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laden…
      </span>
    );
  }
  if (s.status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opslaan…
      </span>
    );
  }
  if (s.status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-destructive"
        title={s.lastError}
      >
        <CloudOff className="h-3.5 w-3.5" /> Opslaan mislukt
      </span>
    );
  }
  if (s.status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gold/80">
        <Check className="h-3.5 w-3.5" /> Opgeslagen
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Cloud className="h-3.5 w-3.5" /> Cloud
    </span>
  );
}
