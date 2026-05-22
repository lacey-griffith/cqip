-- Batch 005.29 — additive taxonomy seed: Client Request issue category +
-- 6 client-change-request issue subtypes. Closes a gap surfaced after
-- Batch 005.28 shipped: Client Request existed as a Root Cause canonical
-- (customfield_12905) but not as an Issue Category, so logs couldn't
-- categorize "client asked for a change" at the top level. The 6 new
-- subtypes (Copy / Image / Link / Styling / Layout / Functionality
-- Change Request) capture what KIND of client request drove the
-- rework.
--
-- All values are Jira-verbatim per N2 Policy A (locked in Batch 005.28).
-- Re-fetched from Jira on 2026-05-22 after Lacey's adds completed.
-- The two slash-containing subtypes carry spaces both sides of the slash
-- ("Image / Asset Change Request", "Link / URL Change Request") —
-- matches Jira's actual option spelling, unlike most other slash-
-- containing options in this taxonomy.
--
-- No schema change. No data migration needed (these are net-new
-- canonical values — no historical drift to normalize since no log
-- has ever held them).
--
-- Idempotent: ON CONFLICT DO NOTHING on (field_name, canonical_value)
-- means re-running this migration is a no-op once the rows exist.
--
-- =====================================================================
-- UNANNOUNCED ADDITION FLAGGED FOR DC/LACEY REVIEW:
-- "Base: New Account Support" was also present in Jira's Issue Category
-- list at re-fetch time (position 10) but was NOT in this batch's
-- directive. Seeding it here with a placeholder description so the
-- /api/logs/edit server-side taxonomy validator (§13 r29) doesn't
-- reject saves on rows that pick up this value via webhook/sync.
-- DC + Lacey: please confirm intent and replace the description via
-- a follow-up UPDATE statement (admin SQL — backlog item 5.29 is the
-- future admin UI). If this option was added by mistake and should be
-- removed, follow up with `UPDATE quality_log_taxonomy SET is_active =
-- FALSE WHERE field_name = 'issue_category' AND canonical_value =
-- 'Base: New Account Support';` and remove from Jira.
-- =====================================================================

-- -------------------------------------------------------------------------
-- Issue Category additions (2 rows — 1 directive + 1 unannounced placeholder)
-- Sort orders extend the migration 020 sequence (last used: 90).
-- -------------------------------------------------------------------------
INSERT INTO quality_log_taxonomy (field_name, canonical_value, description, sort_order) VALUES
  ('issue_category', 'Base: New Account Support',
   'PLACEHOLDER — added in Jira 2026-05-22 outside Batch 005.29 scope. DC + Lacey to confirm intent and replace this description with the canonical wording before users rely on it. Seeded so /api/logs/edit validation doesn''t reject saves on rows that receive this value.',
   100),
  ('issue_category', 'Client Request',
   'The client explicitly asked for a change that introduced the issue or required rework. Use Issue Subtype to specify what kind of change.',
   110)
ON CONFLICT (field_name, canonical_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- Issue Subtype additions (6 rows)
-- Sort orders extend the migration 020 sequence (last used: 380).
-- Order matches Jira's return order from the 2026-05-22 re-fetch.
-- -------------------------------------------------------------------------
INSERT INTO quality_log_taxonomy (field_name, canonical_value, description, sort_order) VALUES
  ('issue_subtype', 'Copy Change Request',
   'Client requested a change to text, copy, headlines, body content, or labels.',
   390),
  ('issue_subtype', 'Image / Asset Change Request',
   'Client requested a change to images, logos, videos, or downloadable files.',
   400),
  ('issue_subtype', 'Link / URL Change Request',
   'Client requested a change to internal or external links, anchor targets, or URL structures.',
   410),
  ('issue_subtype', 'Styling Change Request',
   'Client requested a change to color, font, visual treatment, or spacing.',
   420),
  ('issue_subtype', 'Layout Change Request',
   'Client requested a change to page structure, grid, or element positioning.',
   430),
  ('issue_subtype', 'Functionality Change Request',
   'Client requested a change to behavior, interactions, form fields, or other functional elements.',
   440)
ON CONFLICT (field_name, canonical_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- Verification (hand-run in SQL editor after migration applies)
-- -------------------------------------------------------------------------
-- Expect: issue_category=11, issue_subtype=44, root_cause=14, resolution_type=9
-- (issue_category=11 includes the placeholder "Base: New Account Support" —
-- expected to drop back to 10 once DC/Lacey resolves it.)
--
-- SELECT field_name, COUNT(*) FROM quality_log_taxonomy
--   WHERE is_active = TRUE GROUP BY field_name ORDER BY field_name;
