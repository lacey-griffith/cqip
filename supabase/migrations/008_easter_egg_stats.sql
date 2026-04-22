-- Tracks how often each named easter egg has been triggered.
-- Keyed by egg name so we can add more counters without schema changes.

CREATE TABLE IF NOT EXISTS easter_egg_stats (
  egg_name           TEXT PRIMARY KEY,
  hit_count          INTEGER NOT NULL DEFAULT 0,
  last_triggered_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the sunshine entry so first increment has something to UPDATE.
INSERT INTO easter_egg_stats (egg_name, hit_count)
VALUES ('array_of_sunshine_unlock', 0)
ON CONFLICT (egg_name) DO NOTHING;

-- RLS: read for authenticated, increment via RPC only.
ALTER TABLE easter_egg_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "easter_egg_stats_read" ON easter_egg_stats;
CREATE POLICY "easter_egg_stats_read" ON easter_egg_stats
  FOR SELECT TO authenticated
  USING (TRUE);

-- Atomic increment RPC. SECURITY DEFINER lets any authenticated user
-- bump a counter without direct UPDATE privilege on the table.
CREATE OR REPLACE FUNCTION increment_easter_egg(p_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO easter_egg_stats (egg_name, hit_count, last_triggered_at)
  VALUES (p_name, 1, NOW())
  ON CONFLICT (egg_name) DO UPDATE
    SET hit_count = easter_egg_stats.hit_count + 1,
        last_triggered_at = NOW()
  RETURNING hit_count INTO v_count;
  RETURN v_count;
END;
$$;

-- Limit increment to authenticated users (no anon abuse).
REVOKE ALL ON FUNCTION increment_easter_egg(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_easter_egg(TEXT) TO authenticated;
