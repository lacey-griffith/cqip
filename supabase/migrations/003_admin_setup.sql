-- Ensures an admin-tier account exists for "lacey".
--
-- Strategy:
--   1. If an auth.users row already exists matching the known Fusion92 admin
--      email (case-insensitive), upsert a user_profiles row pointing at it
--      with display_name = 'lacey' and role = 'admin'.
--   2. Otherwise, create a local account at lacey@cqip.local with a known
--      temporary password, then upsert the admin user_profiles row.
--
-- The temporary password below should be rotated immediately after first
-- login via Settings → Profile → Change password.

DO $$
DECLARE
  existing_id UUID;
  existing_email TEXT;
  new_id UUID;
  tmp_password TEXT := 'CqipLacey1!';
BEGIN
  SELECT id, email INTO existing_id, existing_email
  FROM auth.users
  WHERE LOWER(email) IN ('lhay@fusion92.com', 'l.hay@fusion92.com')
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, email, display_name, role, is_active, color_preference)
    VALUES (existing_id, existing_email, 'lacey', 'admin', TRUE, '#F47920')
    ON CONFLICT (id) DO UPDATE
      SET role = 'admin',
          display_name = 'lacey',
          is_active = TRUE;
    RAISE NOTICE 'Upgraded existing account % to admin with username "lacey".', existing_email;
  ELSE
    SELECT id INTO new_id FROM auth.users WHERE email = 'lacey@cqip.local' LIMIT 1;

    IF new_id IS NULL THEN
      new_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_id,
        'authenticated',
        'authenticated',
        'lacey@cqip.local',
        crypt(tmp_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"lacey","role":"admin"}'::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      );
      RAISE NOTICE 'Created local admin account lacey@cqip.local with password %.', tmp_password;
    END IF;

    INSERT INTO user_profiles (id, email, display_name, role, is_active, color_preference)
    VALUES (new_id, 'lacey@cqip.local', 'lacey', 'admin', TRUE, '#F47920')
    ON CONFLICT (id) DO UPDATE
      SET role = 'admin',
          display_name = 'lacey',
          is_active = TRUE;
  END IF;
END $$;
