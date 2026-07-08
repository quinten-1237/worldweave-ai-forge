
-- Explicit grants so PostgREST can reach these tables under the authenticated role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_versions TO authenticated;
GRANT ALL ON public.story_versions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_backups TO authenticated;
GRANT ALL ON public.story_backups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_images TO authenticated;
GRANT ALL ON public.user_images TO service_role;

-- Tighten story_versions / story_backups policies to the authenticated role.
DROP POLICY IF EXISTS "own story_versions all" ON public.story_versions;
CREATE POLICY "own story_versions all"
  ON public.story_versions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own story_backups all" ON public.story_backups;
CREATE POLICY "own story_backups all"
  ON public.story_backups
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
