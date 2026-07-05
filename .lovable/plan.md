## Fase 1 — Persistent Story Storage, Versies, Backups & Character Types

Deze fase legt de fundering. Nu draait alles op localStorage; dat gaan we vervangen door de bestaande `stories`-tabel in Lovable Cloud, met versiegeschiedenis en herstelpunten. Character Types komen er direct in mee zodat het datamodel later niet weer migreert.

De grote features uit je briefing (World Bible engine, Future Planner, Secret Scheduler, PDF/DOCX-export, kaart, offline sync, multi-device conflict resolution, …) komen in latere fases. Dit document is Fase 1.

### Wat de gebruiker gaat merken

- Verhalen leven in de cloud en verschijnen op elk apparaat waar je inlogt.
- Boven aan het scherm staat een status: *Bezig met opslaan… / Opgeslagen*.
- Voor elke wijziging wordt automatisch een versie bewaard. Voor elke AI-generatie wordt een backup gemaakt.
- Nieuw menu **Recovery Center** met tijdlijn van versies + backups, preview en één-klik herstellen.
- Bij het maken van een personage kies je eerst een **Character Type** (Mens, Draak, Direwolf, Wolf, Hond, Paard, Reus, White Walker, Kind van het Bos, Mythisch wezen, Beest, Vogel, Zeewezen, Demon, Geest, Onbekend, Aangepast). Type-specifieke velden verschijnen automatisch.

### Wat *niet* in Fase 1 zit (komt daarna)

- Future Planner + Secret Scheduler (fase 2, direct hierna).
- World Bible auto-update + Consistency Engine bij generatie.
- PDF/DOCX export, PDF/DOCX import, kaart, animals/magic/timeline UI-pagina's.
- Offline queue en cross-device conflict-merge UI. Basissynchronisatie via realtime werkt wel.

### Technisch — datamodel

De bestaande `stories`-tabel blijft de bron van waarheid: `data jsonb` bevat de volledige `Story` (chapters, characters, locations, factions, relationships, timeline, presets, …). Twee nieuwe tabellen:

```text
story_versions          # elke autosave-diff
  id, story_id, user_id, data jsonb, summary text, created_at, kind='autosave'|'manual'

story_backups           # snapshots vóór AI-generatie / dagelijks / handmatig
  id, story_id, user_id, data jsonb, label text, created_at, kind='pre-generation'|'daily'|'manual'
```

Beide met RLS `auth.uid() = user_id`, GRANT voor `authenticated` + `service_role`, en `story_id` FK naar `stories(id) ON DELETE CASCADE`. Retentie: versies dun-uitknijpen na 100 (elke 10e blijft); backups onbeperkt.

`Character` in `src/types/story.ts` krijgt:
```ts
type: CharacterType;           // 'human' | 'dragon' | 'direwolf' | 'horse' | 'white_walker' | ...
typeFields: Record<string,string>;  // fire_color, wingspan, pack, breed, rank, occupation, house, ...
inventory?: string[];
aliases?: string[];
biography?: string;
```

De bestaande `house`-informatie zit al in `relationships`; we voegen `house` als los veld toe voor `type='human'`.

### Technisch — sync-laag

Nieuwe `src/lib/story-sync.ts`:

- `useStoryStore` (zustand) blijft de client-cache, maar de `persist`-middleware gaat weg.
- Bij login: `loadStoriesFromCloud()` → `stories`-tabel lezen (via `createServerFn` + `requireSupabaseAuth`) en in de store zetten.
- Bij elke `updateStory` / `updateCharacter` / … in de store: `queueSave(storyId)` → 800ms debounce → `saveStoryToCloud` server-fn die (1) UPDATE stories.data, (2) INSERT story_versions row.
- `saveBackup(storyId, kind, label)` server-fn wordt aangeroepen vóór `generateChapter` en `generateCharacter`, plus dagelijks bij eerste load van een verhaal.
- Realtime channel op `stories` en `story_versions` → invalideert queryClient → andere apparaten pullen de nieuwe versie.

Server functions in `src/lib/story-sync.functions.ts`:
```
listStories()  → { id, title, updated_at }[]
loadStory(id)  → Story
saveStory({ id, data, summary? })
listVersions(storyId) → StoryVersion[]
listBackups(storyId) → StoryBackup[]
restoreVersion(versionId) / restoreBackup(backupId)
saveBackup({ storyId, kind, label })
```

Alle met `.middleware([requireSupabaseAuth])`; anon-toegang is er niet.

Bestaande localStorage-inhoud wordt éénmalig geïmporteerd bij eerste login (`migrateLocalStorageToCloud`) en dan gewist.

### Technisch — UI

- Nieuwe `<SaveIndicator />` in de header van `story.$id.tsx`: reageert op een `syncStatus` store (`idle | saving | saved | error`).
- Nieuwe route `src/routes/story.$id.history.tsx` = Recovery Center: twee tabs (Versies / Backups), lijst met tijd + omschrijving, preview-panel (readonly render), knop *Herstel deze versie* (creëert eerst een backup van de huidige staat, dan overschrijft).
- `CharacterEditor` (bestaand in `story.$id.tsx`) krijgt bovenaan een `Select` voor Character Type; per gekozen type een dynamische veldenset uit `src/lib/character-types.ts`.
- `generateCharacter` server-fn krijgt `type` als input; system prompt vermeldt het type zodat de AI passende velden invult.

### Files

Nieuw:
- migratie: `story_versions`, `story_backups`, GRANTs, RLS, indexes op `(story_id, created_at desc)`.
- `src/lib/story-sync.ts` (client sync/debounce/realtime)
- `src/lib/story-sync.functions.ts` (server fns)
- `src/lib/character-types.ts` (types + veldschema's)
- `src/components/SaveIndicator.tsx`
- `src/components/CharacterTypeSelect.tsx`
- `src/routes/story.$id.history.tsx` (Recovery Center)

Aangepast:
- `src/types/story.ts` — Character krijgt `type`, `typeFields`, `inventory`, `aliases`, `biography`.
- `src/store/storyStore.ts` — `persist` verwijderen, bij elke mutatie `queueSave` triggeren.
- `src/lib/ai.functions.ts` — `generateCharacter` accepteert `type`; roep `saveBackup` vóór `generateChapter`.
- `src/routes/story.$id.tsx` — SaveIndicator + Recovery-link + CharacterType in de editor.
- `src/routes/__root.tsx` — bij session `loadStoriesFromCloud` starten; realtime channel opzetten.
- `src/routes/library.tsx` — leest uit gesynchroniseerde store.

### Risico's die ik expliciet afvang

- Grote `data`-JSONB per save: we schrijven de hele blob, dat is bewust simpel voor Fase 1. Retentie voor `story_versions` wordt beperkt tot 100 rijen per verhaal (trigger die overtollige oude rijen dunt), backups blijven onbeperkt zoals gevraagd.
- Bestaande `Chapter[]` in JSONB kan groot worden; huidige verhalen blijven ruim onder de 1 MB per row-grens.
- Race conditions tussen tabs: elke save stuurt `updated_at`; als de server-versie nieuwer is dan de client-versie, weigert de save en toont Recovery Center een merge-hint. Volledige merge-UI komt in een latere fase.
- Character Types met dynamische velden: `typeFields` is een vrije `Record<string,string>` — geen migratie nodig als we later velden toevoegen.

Zeg akkoord en ik begin met de migratie (nieuwe tabellen) — dat is de eerste stap en de rest hangt eraan vast.
