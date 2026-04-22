-- Updates avatar patterns and adds profile photo support.
--
-- Pattern changes: drop `flowers`, `spirals`, `cheetah`; keep the rest;
-- add `checkered_large`. Migrates any legacy values to `none` so the new
-- CHECK constraint can be applied cleanly.
--
-- Profile photos: adds `user_profiles.avatar_url`, creates a public `avatars`
-- storage bucket, and scopes write access so each signed-in user can only
-- upload to their own folder (`<uid>/…`).

-- -------------------------------------------------------------------------
-- avatar_url column
-- -------------------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- -------------------------------------------------------------------------
-- pattern_preference — refresh the allowed set
-- -------------------------------------------------------------------------
UPDATE user_profiles
  SET pattern_preference = 'none'
  WHERE pattern_preference NOT IN ('none', 'polka_dots', 'stripes', 'squiggles', 'checkered', 'checkered_large');

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_pattern_preference_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_pattern_preference_check
    CHECK (pattern_preference IN (
      'none',
      'polka_dots',
      'stripes',
      'squiggles',
      'checkered',
      'checkered_large'
    ));

-- -------------------------------------------------------------------------
-- avatars storage bucket + RLS
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Public read so <img src="…/avatars/<uid>/…"> works without signing.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Each user may write only under their own `<uid>/…` folder.
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
