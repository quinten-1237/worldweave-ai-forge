import { HardDrive } from "lucide-react";

export function SaveIndicator() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title="Verhalen worden lokaal in deze browser opgeslagen"
    >
      <HardDrive className="h-3.5 w-3.5" /> Lokaal opgeslagen
    </span>
  );
}
