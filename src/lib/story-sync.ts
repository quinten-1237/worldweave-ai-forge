// Local-only storage mode.
// De story store bewaart alles in localStorage (zie src/store/storyStore.ts).
// Er wordt niets meer automatisch naar de cloud gesynchroniseerd.

import { useStoryStore } from "@/store/storyStore";

export type SyncStatus = "idle" | "saving" | "saved" | "error" | "loading" | "local";

interface SyncState {
  status: SyncStatus;
  lastError?: string;
  lastSavedAt?: number;
  hydrated: boolean;
}

/** Statisch: opslag is lokaal, dus altijd "local". */
export function useSyncStatus(): SyncState {
  return { status: "local", hydrated: true };
}

/** No-op in lokale modus (backups liepen via de cloud). */
export async function backupStory(
  _storyId: string,
  _kind: "pre-generation" | "daily" | "manual",
  _label?: string,
) {
  return;
}

export function backupBeforeGeneration(_storyId: string, _note?: string) {
  return;
}

/** Verwijdert het verhaal uit de lokale opslag. */
export async function deleteStoryEverywhere(storyId: string) {
  useStoryStore.setState((s) => ({ stories: s.stories.filter((x) => x.id !== storyId) }));
}

/** Bewaard voor compatibiliteit: doet niets in lokale modus. */
export function useCloudSync() {
  return;
}
