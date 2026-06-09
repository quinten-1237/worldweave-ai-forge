DROP POLICY IF EXISTS "user-uploads public read" ON storage.objects;
CREATE POLICY "user-uploads own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = (auth.uid())::text);