-- Adds avatar pattern and theme preferences; enables realtime on user_profiles.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS pattern_preference TEXT NOT NULL DEFAULT 'none';

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'light';

DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_pattern_preference_check
      CHECK (pattern_preference IN ('none', 'flowers', 'polka_dots', 'stripes'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_theme_preference_check
      CHECK (theme_preference IN ('light', 'dark'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure user_profiles is part of the realtime publication so clients can
-- subscribe to live changes (avatar color / pattern / theme / role updates).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
