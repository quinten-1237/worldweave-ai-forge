-- Performance indexes for story queries.
-- GIN on stories.data lets us search inside the JSONB blob (futurePlans, secrets)
-- without a full table scan; user_id + updated_at speeds the library list.
CREATE INDEX IF NOT EXISTS stories_data_gin ON public.stories USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS stories_user_updated_idx ON public.stories (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS stories_user_favorite_idx ON public.stories (user_id, is_favorite) WHERE is_favorite = true;

-- Version + backup lookups always filter by story_id and sort by created_at desc.
CREATE INDEX IF NOT EXISTS story_versions_story_created_idx ON public.story_versions (story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS story_versions_user_idx ON public.story_versions (user_id);
CREATE INDEX IF NOT EXISTS story_backups_story_created_idx ON public.story_backups (story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS story_backups_user_idx ON public.story_backups (user_id);

-- Belt-and-braces: make sure the RLS grants match the policies.
-- (Idempotent — safe to re-run.)
REVOKE ALL ON public.stories FROM anon;
REVOKE ALL ON public.story_versions FROM anon;
REVOKE ALL ON public.story_backups FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_backups TO authenticated;
GRANT ALL ON public.stories TO service_role;
GRANT ALL ON public.story_versions TO service_role;
GRANT ALL ON public.story_backups TO service_role;