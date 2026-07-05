
CREATE TABLE public.story_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  summary TEXT,
  kind TEXT NOT NULL DEFAULT 'autosave' CHECK (kind IN ('autosave','manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX story_versions_story_created_idx ON public.story_versions (story_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_versions TO authenticated;
GRANT ALL ON public.story_versions TO service_role;
ALTER TABLE public.story_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own story_versions all" ON public.story_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.story_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  label TEXT,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('pre-generation','daily','manual','pre-restore')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX story_backups_story_created_idx ON public.story_backups (story_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_backups TO authenticated;
GRANT ALL ON public.story_backups TO service_role;
ALTER TABLE public.story_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own story_backups all" ON public.story_backups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Retention: keep at most 100 versions per story, prune oldest beyond that.
CREATE OR REPLACE FUNCTION public.prune_story_versions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.story_versions
  WHERE story_id = NEW.story_id
    AND id IN (
      SELECT id FROM public.story_versions
      WHERE story_id = NEW.story_id
      ORDER BY created_at DESC
      OFFSET 100
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER prune_story_versions_trigger
AFTER INSERT ON public.story_versions
FOR EACH ROW EXECUTE FUNCTION public.prune_story_versions();

-- Realtime for stories so multiple devices see changes.
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER TABLE public.stories REPLICA IDENTITY FULL;
