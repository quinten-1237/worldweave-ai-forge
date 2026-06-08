
# StoryForge AI — Volledige uitbreiding

Grote build. Ik activeer Lovable Cloud en bouw alles in één doorloop (2FA en active-sessions komen later, zoals afgesproken).

## Fase 1 — Backend & data
- **Lovable Cloud aanzetten** (Supabase onder de motorkap).
- **DB**:
  - `profiles` (id → auth.users, display_name, username, bio, avatar_url, language, theme, accent_color, font_size, high_contrast, reduced_motion, email_notifications, in_app_notifications, autosave, default_homepage, remember_last_page, last_page)
  - `user_images` (id, user_id, storage_path, public_url, label, created_at) — voor uploads buiten avatar
  - RLS: alleen eigenaar lees/schrijf. Service-role grants. Trigger maakt automatisch profile aan bij signup.
- **Storage buckets**: `avatars` (public), `user-uploads` (public, met RLS-policies op storage.objects).

## Fase 2 — Auth
- `/auth` route met Email+Password (signup/login) en **Google Sign-In** via `lovable.auth.signInWithOAuth("google")`.
- `supabase--configure_social_auth` voor Google.
- `_authenticated/` layout-gate (integration-managed).
- Bestaande verhalen blijven werken voor ingelogde gebruikers; localStorage-store wordt per-user namespaced.

## Fase 3 — Welkomstscherm & i18n
- **WelcomeScreen** bij eerste bezoek: taalkeuze (EN default, NL, FR, DE, ES) → opgeslagen in profile + localStorage.
- **i18n systeem**: lichte custom hook (`useT`) met dictionaries per taal — geen zware lib. Alle UI-strings vertaald in 5 talen. Live switchen.

## Fase 4 — Thema & accessibility
- **ThemeProvider**: light / dark / system. Persist in profile + `localStorage`.
- **Accent color picker** → CSS variable update.
- **Font size** (sm/md/lg) → root font-size class.
- **High contrast** → extra CSS class.
- **Reduced motion** → respecteert OS + override.

## Fase 5 — Settings volledig werkend
Tab-layout met secties:
- Appearance (thema, accent, theme preview)
- Language
- Account (username, email via `updateUser`, password change, **delete account** via server fn met admin client)
- Notifications (toggles → profile)
- Privacy (download data als JSON, delete personal data)
- Accessibility (font size, contrast, reduced motion)
- Storage (gebruik + lijst uploads + delete)
- Profile (avatar upload, display name, bio)
- Preferences (autosave, default homepage, remember last page)
- Security (alleen "Change password" + logout; 2FA/sessions → later)

## Fase 6 — Image uploads
- `<ImageUploader>` component: file-input (JPG/JPEG/PNG/WEBP), preview, replace, delete.
- Upload via Supabase storage → public URL → opgeslagen in `user_images` of direct in `stories.coverUrl`.
- Stories krijgen optioneel `coverImageUrl`; character/location entries krijgen `imageUrl`.
- **Geen AI-image-generatie** — alleen user upload.

## Fase 7 — UX polish
- Persistente sessies (Supabase default).
- Sonner-toasts in juiste taal.
- Loading-skeletons.
- Mobile sidebar (Sheet) toegevoegd aan AppShell.

## Technische notities
- Alle server-fn's met `requireSupabaseAuth` waar nodig.
- Story-store wordt hybride: schrijft naar Supabase (`stories`-tabel) wanneer ingelogd, anders blijft localStorage werken (gast-modus).
- Migratie: bij eerste login worden lokale verhalen optioneel geüpload.

## Geschatte impact
~25-35 nieuwe/aangepaste bestanden, 1 grote migratie. Daarna run ik een security-scan.

Akkoord om te starten?
