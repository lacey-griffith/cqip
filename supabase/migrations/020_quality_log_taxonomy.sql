-- Batch 005.28 — quality_log_taxonomy reference table + needs_review
-- column on quality_logs. Implements Option B from the 2026-05-20 root
-- cause audit (docs/root-cause-audit-2026-05-20.md) and the variant
-- mapping plan (docs/root-cause-taxonomy-mapping.md).
--
-- Closes the long-standing free-text drift hole on the four
-- multi-select fields (issue_category, issue_subtype, root_cause_initial
-- + root_cause_final, resolution_type). After this migration ships:
--   · Edit dialog reads taxonomy → multi-select with no free-text input
--   · /api/logs/edit validates values against the taxonomy server-side
--   · Webhook + sync continue writing Jira-verbatim strings; this seed
--     uses those same verbatim strings so the writes pass validation
--   · A normalize-quality-log-fields.ts one-shot maps historical drift
--     to canonical, flags ambiguous rows via the new needs_review column
--   · /dashboard/logs gains a "Needs review" worklist filter
--
-- N2 spacing policy (locked 2026-05-20): canonical_value is Jira's
-- option string verbatim — including the inconsistent `X/ Y` spacing
-- some Jira options carry. The dialog dropdown renders these strings
-- unmodified so what users see matches what Jira fires via webhook.
-- See §13 rule 28 (brand strings verbatim) precedent.
--
-- field_name for root_cause is 'root_cause' singular, even though the
-- application uses it for BOTH `root_cause_initial` and
-- `root_cause_final` columns (they share customfield_12905 in Jira).
--
-- Idempotent: re-running this migration is a no-op.

-- -------------------------------------------------------------------------
-- Taxonomy table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quality_log_taxonomy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name      TEXT NOT NULL
                    CHECK (field_name IN (
                      'issue_category',
                      'issue_subtype',
                      'root_cause',
                      'resolution_type'
                    )),
  canonical_value TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxonomy_field_value
  ON quality_log_taxonomy(field_name, canonical_value);

CREATE INDEX IF NOT EXISTS idx_taxonomy_active
  ON quality_log_taxonomy(field_name, sort_order)
  WHERE is_active = TRUE;

ALTER TABLE quality_log_taxonomy ENABLE ROW LEVEL SECURITY;

-- SELECT open to all authenticated users — read-only viewers need
-- access too (the dialog dropdown and the docs hub both read this).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'quality_log_taxonomy_select_authenticated'
      AND tablename = 'quality_log_taxonomy'
  ) THEN
    CREATE POLICY quality_log_taxonomy_select_authenticated
      ON quality_log_taxonomy
      FOR SELECT TO authenticated USING (TRUE);
  END IF;
END
$$;

-- No INSERT/UPDATE/DELETE policies for `authenticated` — taxonomy
-- additions happen via SQL editor (admin UI deferred) and use the
-- service role, which bypasses RLS. Matches the append-only pattern
-- set by audit_log (migration 016) and sync_runs (migration 018).

-- -------------------------------------------------------------------------
-- needs_review column on quality_logs
-- -------------------------------------------------------------------------
ALTER TABLE quality_logs
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_quality_logs_needs_review
  ON quality_logs(needs_review)
  WHERE needs_review = TRUE;

COMMENT ON COLUMN quality_logs.needs_review IS
  'Set TRUE by normalize-quality-log-fields.ts when a historical value '
  'was auto-mapped to a default during taxonomy normalization, or by the '
  'normalizer''s cross-field-pollution path when a value was found in '
  'the wrong column. Cleared by /api/logs/edit when an admin saves the '
  'row — the edit IS the review decision. Batch 005.28.';

-- -------------------------------------------------------------------------
-- Seed: issue_category (9 canonical options, Jira-verbatim)
-- -------------------------------------------------------------------------
INSERT INTO quality_log_taxonomy (field_name, canonical_value, description, sort_order) VALUES
  ('issue_category', 'CRO Implementation',         'Issues introduced by CRO-authored variation code, snippets, injected CSS, or DOM manipulation. The variation itself is the source.', 10),
  ('issue_category', 'Experiment Configuration',   'Problems within the experiment platform setup (Convert, etc.) — targeting, audience, goals, activation conditions, snippet behavior.', 20),
  ('issue_category', 'Client Website Code',        'Issues in the client''s baseline site (CSS, JS, layout, backend) that interrupt CRO work or variation behavior. Granularity (frontend vs backend) lives in Subtype.', 30),
  ('issue_category', 'Client Data/Feed',           'Inconsistent, incorrect, or unclean data provided by the client. Includes mismatched slugs, phone numbers, source-file discrepancies, low-quality assets.', 40),
  ('issue_category', 'Third Party Tool',           'Issues caused by a known vendor relationship — Convert, GA, a CDP, etc. A vendor we have a contact with and can engage.', 50),
  ('issue_category', 'Process/ Communication',     'Delays or errors from miscommunication, unclear handoffs, or workflow breakdowns. Mislabeled tasks, missing QA details, incorrect status movement.', 60),
  ('issue_category', 'Missing Information / Access', 'Required information, assets, instructions, or credentials weren''t provided. Use the Subtype to specify what was missing.', 70),
  ('issue_category', 'Experiment Concept',         'The test''s direction, functionality, or expectations changed after work began. Often paired with a "Requirement or Scope Change" root cause.', 80),
  ('issue_category', 'External Factor',            'Issues caused by uncontrollable environmental shifts — browser updates, network/CDN changes, OS updates. Distinct from Third Party Tool: no vendor relationship to engage.', 90)
ON CONFLICT (field_name, canonical_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- Seed: root_cause (14 canonical options, Jira-verbatim)
-- Used by BOTH root_cause_initial and root_cause_final columns.
-- -------------------------------------------------------------------------
INSERT INTO quality_log_taxonomy (field_name, canonical_value, description, sort_order) VALUES
  ('root_cause', 'CRO Code Error',                       'A bug in CRO-authored variation code (logic error, missing case, type bug).', 10),
  ('root_cause', 'Experiment Setup Error',               'The experiment''s configuration was wrong (targeting, goals, activation, snippet config) but the variation code itself was sound.', 20),
  ('root_cause', 'Missing Assets/ Info',                 'Required assets, copy, or instructions were never provided. Work couldn''t proceed because something didn''t exist.', 30),
  ('root_cause', 'Process Gap',                          'The workflow / process itself had a flaw — missing step, unclear ownership, no QA checkpoint where one was needed.', 40),
  ('root_cause', 'QA Gap',                               'A QA step existed but failed to catch the issue — reviewer missed it, test was incomplete, edge case not covered.', 50),
  ('root_cause', 'Client Side Code Issue',               'The client''s baseline website code (HTML, CSS, JS, CMS, backend) caused the problem.', 60),
  ('root_cause', 'Client Data/ Feed Issue',              'The client-provided data was incorrect, incomplete, or malformed.', 70),
  ('root_cause', 'Third Party Tool Change',              'A known vendor (Convert, GA, etc.) changed their behavior. We have a relationship to engage.', 80),
  ('root_cause', 'Requirement or Scope Change',          'Requirements changed after work began. The work was correct against the original spec.', 90),
  ('root_cause', 'Client Request',                       'The client explicitly asked for a change that introduced the issue or required rework.', 100),
  ('root_cause', 'Unknown/ Needs Investigation',         'Root cause not yet determined. Use this when investigation is genuinely incomplete — don''t use as a default for unclear cases.', 110),
  ('root_cause', 'External Factor/ Environment Change',  'Browser, OS, network, CDN, or other uncontrollable environmental shift. No vendor to engage.', 120),
  ('root_cause', 'Unclear/ Conflicting Requirements',    'Information WAS provided but was ambiguous, incomplete, or led to a different outcome than intended.', 130),
  ('root_cause', 'Late Assets/ Info',                    'Information was provided eventually but past the point of usefulness — a timing/sequencing failure rather than a content failure.', 140)
ON CONFLICT (field_name, canonical_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- Seed: issue_subtype (38 canonical options, Jira-verbatim)
-- -------------------------------------------------------------------------
INSERT INTO quality_log_taxonomy (field_name, canonical_value, description, sort_order) VALUES
  ('issue_subtype', 'Javascript Error',              'JS exception thrown, console error, broken behavior',                                     10),
  ('issue_subtype', 'CSS/ Styling Issue',            'Visual styles wrong, missing, or conflicting',                                            20),
  ('issue_subtype', 'Layout Broken',                 'Page or component layout collapsed or shifted',                                           30),
  ('issue_subtype', 'Element Not Loading',           'Expected element doesn''t appear on the page',                                            40),
  ('issue_subtype', 'Content Missing',               'Copy, image, or other content absent from rendered page',                                 50),
  ('issue_subtype', 'Page Flash/ Flicker',           'Visible flash of original content before variation applies',                              60),
  ('issue_subtype', 'Variation Not Rendering',       'The variation code ran but its changes aren''t visible',                                  70),
  ('issue_subtype', 'Event Not Firing',              'Expected tracking event not sent to analytics',                                           80),
  ('issue_subtype', 'Incorrect Event Values',        'Tracking event fires with wrong parameters',                                              90),
  ('issue_subtype', 'Experiment Trigger not Firing', 'Variation activation event not registering',                                             100),
  ('issue_subtype', 'Duplicate Event',               'Event firing more than once when it should fire once',                                   110),
  ('issue_subtype', 'Incorrect Traffic Allocation',  'Variation distribution doesn''t match configured split',                                 120),
  ('issue_subtype', 'Variant Assignment Issue',      'Users assigned to wrong variation or reassigned mid-session',                            130),
  ('issue_subtype', 'Data Mismatch',                 'Data values don''t match between sources',                                               140),
  ('issue_subtype', 'Visual Overlap',                'Elements rendering on top of each other or misaligned',                                  150),
  ('issue_subtype', 'Mobile/ Responsive Issue',      'Layout/behavior breaks on specific viewports or devices',                                160),
  ('issue_subtype', 'Device Targeting Issue',        'Mobile/desktop/tablet targeting misfiring',                                              170),
  ('issue_subtype', 'Location Targeting Issue',      'Geo-targeting includes or excludes wrong locations',                                     180),
  ('issue_subtype', 'Audience Condition Issue',      'Audience targeting matches users it shouldn''t or misses users it should',               190),
  ('issue_subtype', 'Cookie/ Session Logic Issue',   'Session detection, cookie handling, or persistence broken',                              200),
  ('issue_subtype', 'Client Frontend Conflict',      'Client''s frontend code interferes with CRO variation',                                  210),
  ('issue_subtype', 'Client Backend Issue',          'Client''s backend (CMS, API, server) causing variation problem',                         220),
  ('issue_subtype', 'CMS Conflict',                  'Content management system overriding or interfering',                                    230),
  ('issue_subtype', 'Data Mapping Issue',            'Data field mapping incorrect between source and destination',                            240),
  ('issue_subtype', 'Product / Service Data Missing','Specific product or service data absent from feed',                                      250),
  ('issue_subtype', 'Feed Update Error',             'Data feed update failed or applied incorrectly',                                         260),
  ('issue_subtype', 'Vendor Script Conflict',        'A third-party script interferes with the variation',                                     270),
  ('issue_subtype', 'API Failure',                   'Third-party API call returns error or unexpected response',                              280),
  ('issue_subtype', 'External Tool Change',          'A vendor changed something on their side (Convert, GA, etc.)',                           290),
  ('issue_subtype', 'Requirements Unclear',          'Brief is ambiguous, contradictory, or open to interpretation',                           300),
  ('issue_subtype', 'Missing Requirements',          'Specific requirements missing from the brief',                                           310),
  ('issue_subtype', 'Change not Communicated',       'A change happened upstream but wasn''t relayed to team',                                 320),
  ('issue_subtype', 'Incorrect Instructions',        'Provided instructions led to a different outcome than intended',                         330),
  ('issue_subtype', 'Missing Assets',                'Required creative, copy, or files weren''t provided',                                    340),
  ('issue_subtype', 'Missing Access/ Credentials',   'Required logins, API keys, or access not granted',                                       350),
  ('issue_subtype', 'Browser Update',                'A browser update broke something we depend on',                                          360),
  ('issue_subtype', 'Network/ CDN Issue',            'Transient network problem, CDN propagation lag, or routing issue',                       370),
  ('issue_subtype', 'OS or Device Updates',          'A device OS update changed behavior we depend on',                                       380)
ON CONFLICT (field_name, canonical_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- Seed: resolution_type (9 canonical options, Jira-verbatim)
-- -------------------------------------------------------------------------
INSERT INTO quality_log_taxonomy (field_name, canonical_value, description, sort_order) VALUES
  ('resolution_type', 'CRO Code Fix',                   'Updated variation code, snippet, or CRO-authored asset',                              10),
  ('resolution_type', 'Experiment Configuration Update','Changed targeting, audience, goal, or activation in the experiment platform',         20),
  ('resolution_type', 'Analytics Tracking Fix',         'Corrected event firing, parameters, or analytics integration',                        30),
  ('resolution_type', 'Design Adjustment',              'Visual change to address layout, styling, or design intent',                          40),
  ('resolution_type', 'Client Code Fix',                'Client made a change to their baseline website',                                      50),
  ('resolution_type', 'Client Data Fix',                'Client corrected provided data, file, or feed',                                       60),
  ('resolution_type', 'Process Improvement',            'Workflow, checklist, or handoff updated to prevent recurrence',                       70),
  ('resolution_type', 'Documentation Update',           'Documentation added or revised to clarify expectations',                              80),
  ('resolution_type', 'No Fix Needed',                  'Investigation complete; no action required (false alarm, expected behavior, etc.)',  90)
ON CONFLICT (field_name, canonical_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- Verification (hand-run in SQL editor after migration applies)
-- -------------------------------------------------------------------------
-- Expect: issue_category=9, issue_subtype=38, root_cause=14, resolution_type=9
-- SELECT field_name, COUNT(*) FROM quality_log_taxonomy GROUP BY field_name ORDER BY field_name;
--
-- Expect needs_review column exists, default FALSE on all rows
-- SELECT COUNT(*), bool_or(needs_review) FROM quality_logs;
