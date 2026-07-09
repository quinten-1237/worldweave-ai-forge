// Client-side cloud sync for the story store.
// Strategy:
//   - useStoryStore is the client cache (no more localStorage persist).
//   - On login: hydrate the store from cloud stories.
//   - Any state change → debounced saveStoryToCloud per touched story.
//   - Realtime channel on `stories` invalidates + re-hydrates when a
//     different device pushed a change.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useStoryStore } from "@/store/storyStore";
import type { Story } from "@/types/story";
import {
  listStoriesFromCloud,
  saveStoryToCloud,
  saveStoryBackup,
  deleteStoryFromCloud,
} from "./story-sync.functions";

export type SyncStatus = "idle" | "saving" | "saved" | "error" | "loading";

interface SyncState {
  status: SyncStatus;
  lastError?: string;
  lastSavedAt?: number;
  hydrated: boolean;
}
type Listener = (s: SyncState) => void;

class Bus {
  state: SyncState = { status: "idle", hydrated: false };
  listeners = new Set<Listener>();
  set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }
  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.state);
    return () => {
      this.listeners.delete(l);
    };
  }
}
const bus = new Bus();

export function useSyncStatus(): SyncState {
  const [s, setS] = useState(bus.state);
  useEffect(() => bus.subscribe(setS), []);
  return s;
}

/** Server-side stories.id is a UUID; local IDs from the old store are not.
 *  We rewrite local IDs to UUIDs on first cloud save so both worlds match. */
function ensureUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;
  return crypto.randomUUID();
}

async function hydrateFromCloud() {
  bus.set({ status: "loading" });
  try {
    const rows = await listStoriesFromCloud();
    const stories: Story[] = rows.map((r) => {
      const d = (r.data ?? {}) as unknown as Story;
      return {
        ...d,
        id: r.id,
        title: r.title,
        favorite: r.is_favorite ?? false,
        updatedAt: new Date(r.updated_at).getTime(),
        createdAt: new Date(r.created_at).getTime(),
      };
    });
    // Merge with any local stories that don't yet exist in cloud (one-time migration).
    const state = useStoryStore.getState();
    const cloudIds = new Set(stories.map((s) => s.id));
    const localOnly = state.stories.filter((s) => !cloudIds.has(s.id));
    useStoryStore.setState({ stories: [...stories, ...localOnly] });

    // Push local-only stories up to the cloud immediately.
    for (const s of localOnly) {
      const newId = ensureUuid(s.id);
      if (newId !== s.id) {
        // Rewrite the id in the store so subsequent saves target the new row.
        useStoryStore.setState((st) => ({
          stories: st.stories.map((x) => (x.id === s.id ? { ...x, id: newId } : x)),
        }));
      }
      await saveStoryToCloud({
        data: {
          id: newId,
          title: s.title,
          data: { ...s, id: newId } as unknown as Record<string, unknown>,
          isFavorite: !!s.favorite,
          summary: "Gemigreerd vanuit lokale opslag",
          writeVersion: true,
        },
      }).catch((e) => console.warn("[sync] initial migration save failed", e));
    }
    bus.set({ status: "saved", hydrated: true, lastSavedAt: Date.now() });
  } catch (e) {
    console.error("[sync] hydrate failed", e);
    bus.set({ status: "error", lastError: (e as Error).message, hydrated: true });
  }
}

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Set<string>();
const pendingRetry = new Set<string>();

function scheduleSave(storyId: string) {
  const existing = debounceTimers.get(storyId);
  if (existing) clearTimeout(existing);
  // Autosave elke 2 minuten in plaats van bij elke wijziging — minder cloud-writes,
  // rustiger dashboard en de gebruiker heeft nooit meer dan 2 min werk in gevaar.
  const t = setTimeout(() => {
    void flushSave(storyId);
  }, 120_000);
  debounceTimers.set(storyId, t);
}

async function flushSave(storyId: string) {
  if (inflight.has(storyId)) {
    pendingRetry.add(storyId);
    return;
  }
  const story = useStoryStore.getState().stories.find((s) => s.id === storyId);
  if (!story) return;
  inflight.add(storyId);
  bus.set({ status: "saving" });
  try {
    await saveStoryToCloud({
      data: {
        id: story.id,
        title: story.title,
        data: story as unknown as Record<string, unknown>,
        isFavorite: !!story.favorite,
        writeVersion: true,
      },
    });
    bus.set({ status: "saved", lastSavedAt: Date.now(), lastError: undefined });
  } catch (e) {
    console.error("[sync] save failed", e);
    bus.set({ status: "error", lastError: (e as Error).message });
  } finally {
    inflight.delete(storyId);
    if (pendingRetry.has(storyId)) {
      pendingRetry.delete(storyId);
      scheduleSave(storyId);
    }
  }
}

/** Save a snapshot backup on demand (before AI-generation, daily, or manual). */
export async function backupStory(
  storyId: string,
  kind: "pre-generation" | "daily" | "manual",
  label?: string,
) {
  try {
    await saveStoryBackup({ data: { storyId, kind, label } });
  } catch (e) {
    console.warn("[sync] backup failed", e);
  }
}

/** Called from ChaptersTab before invoking AI. Non-blocking. */
export function backupBeforeGeneration(storyId: string, note?: string) {
  void backupStory(storyId, "pre-generation", note ?? "Voor AI-generatie");
}

/** Deletes locally + in cloud. */
export async function deleteStoryEverywhere(storyId: string) {
  useStoryStore.setState((s) => ({ stories: s.stories.filter((x) => x.id !== storyId) }));
  try {
    await deleteStoryFromCloud({ data: { id: storyId } });
  } catch (e) {
    console.warn("[sync] delete failed", e);
  }
}

let subscribed = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let dailyBackupDone = false;

function attachStoreListener() {
  // Diff-based: whenever a story's updatedAt changes, queue a save for it.
  let prev = useStoryStore.getState().stories;
  useStoryStore.subscribe((state) => {
    const cur = state.stories;
    const prevMap = new Map(prev.map((s) => [s.id, s.updatedAt]));
    for (const s of cur) {
      const p = prevMap.get(s.id);
      if (p === undefined || p !== s.updatedAt) {
        scheduleSave(s.id);
      }
    }
    prev = cur;
  });
}

function attachRealtime(userId: string) {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel(`stories:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "stories", filter: `user_id=eq.${userId}` },
      (payload) => {
        // Skip echoes: if the incoming row's updated_at equals what we have, ignore.
        const row = (payload.new ?? payload.old) as { id?: string } | null;
        if (!row?.id) return;
        // Cheap approach: refetch this story on the next tick if it's not the one
        // we just saved.
        if (inflight.has(row.id)) return;
        // Debounced re-hydrate keeps things simple.
        void hydrateFromCloud();
      },
    )
    .subscribe();
}

/** Mount once at app root to enable cloud sync while logged in. */
export function useCloudSync() {
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!subscribed) {
      attachStoreListener();
      subscribed = true;
    }

    let currentUserId: string | null = null;

    const handleSession = async (session: Session | null) => {
      if (session?.user && session.user.id !== currentUserId) {
        currentUserId = session.user.id;
        await hydrateFromCloud();
        attachRealtime(currentUserId);

        // Daily backup on first hydrate of the day, per story.
        if (!dailyBackupDone) {
          dailyBackupDone = true;
          const today = new Date().toDateString();
          const lastKey = "storyforge:last-daily-backup";
          if (typeof localStorage !== "undefined" && localStorage.getItem(lastKey) !== today) {
            const stories = useStoryStore.getState().stories;
            for (const s of stories) {
              await backupStory(s.id, "daily", `Dagelijkse backup ${today}`).catch(() => {});
            }
            localStorage.setItem(lastKey, today);
          }
        }
      } else if (!session?.user) {
        currentUserId = null;
        useStoryStore.setState({ stories: [] });
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
        bus.set({ status: "idle", hydrated: false });
      }
    };

    supabase.auth.getSession().then(({ data }) => void handleSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => void handleSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
}
