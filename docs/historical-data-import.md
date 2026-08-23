# Historical Data Import

**Relocated whole from `CLAUDE.md` on 2026-08-23** by the second extraction
pass, under §13 r41 remedy 3. **This file is live reference — it is NOT the
archive, and r40 does not apply to it.** CLAUDE.md keeps the section heading and
a pointer so existing `§11` citations still resolve.

---


**Source file:** `NBLY_QualityTrackingLog_Error_Log_.csv` (imported)
**Import rule:** Only import rows where `Type of Issue` is NOT empty.
Rows with only Date/Client/JiraTicket/Status and no other data are excluded.

### CSV → Schema Field Mapping
```
Date              → triggered_at
Client            → client_brand
Type of Issue     → issue_category (array wrap single value)
Issue Details     → root_cause_description
Origin            → detected_by
JIRA Ticket       → jira_ticket_id + jira_ticket_url
Status (csv)      → log_status (map: Resolved→Resolved, In Progress→In Progress,
                                 Open→Open, Blocked→Blocked)
Severity          → severity
Summary           → jira_summary
Screenshot Links  → screenshot_urls (array wrap if present, skip if 'N/A')
URL               → affected_url (skip if 'N/A')
Root Cause-Initial → root_cause_initial (array wrap)
Root Cause-Final  → root_cause_final (array wrap)
Resolution        → resolution_notes
Errored           → trigger_from_status
Who Owns the Fix  → who_owns_fix
Test Type         → test_type (default 'A/B' if empty)
```

For all imported rows: `created_by = 'csv_import'`, `log_number = 1`

---

