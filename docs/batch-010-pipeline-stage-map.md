# Batch 010 — Coverage Pipeline Stage Map

Single source of truth for how live Jira ticket statuses roll up into the
five Coverage **pipeline** stage columns, plus the overlay-tag definitions.

The data layer (`app/api/coverage/pipeline/route.ts`) reads this map from
`lib/coverage/pipeline-stages.ts` — the map is defined **once** in code as a
const; this doc is its prose companion. If you change one, change the other
(§13 rule 23, atomic docs).

> **Scope note:** Batch 010 ships the pipeline **counts** only. The drought
> pill + threshold logic (010.1) and contract counts (010.2) are explicitly
> out. The pipeline table has **no status column** in 010 — pure counts.

---

## Data source

- **LIVE JQL at render.** Per active project, one JQL fetch for tickets
  whose status is in the union of the five stage buckets. No
  `jira_tickets` cache table (that is Batch 007). Read-only against Jira
  (§13 rule 5).

---

## Stage → status map (authoritative)

| Stage      | Jira statuses                                                                   |
| ---------- | ------------------------------------------------------------------------------- |
| Strategy   | `Strategy`                                                                      |
| Design     | `Active Design` · `Design QA` · `Ready for Design` · `Design Client Review`     |
| Dev        | `Active Dev` · `Active Development` · `Dev QA` · `Ready for Dev` · `Dev Client Review` |
| Queued     | `Queued`                                                                        |
| Live       | `Live`                                                                          |

**Excluded — NOT counted in any column:** `Done`, `Reporting`.

Both `Active Dev` and `Active Development` are listed for the Dev bucket so
the map is portable across projects that name the status either way. As of
2026-06-03 the two active projects (NBLYCRO, SPLCRO) both use `Active Dev`;
`Active Development` matches nothing today but is kept forward-looking.

---

## Overlay tags

Overlays are visual annotations on stage counts — they do **not** move a
ticket between columns and do **not** filter rows out.

**Storage (verified against production 2026-06-03):** overlays live on the
Jira multi-select custom field **`customfield_12528` ("CRO Labels")** —
**not** the `labels` field (NBLYCRO/SPLCRO tickets carry no `labels`). The
matcher keys on the option `value` string with **exact Jira casing**:

| Overlay (UI label) | Jira `CRO Labels` option value |
| ------------------ | ------------------------------ |
| Needs Info         | `Needs info`                   |
| Troubleshooting    | `Troubleshooting`              |
| On Hold            | `On hold`                      |

The full `CRO Labels` option set in prod is: `Go live`, `Awaiting client
input`, `On hold`, `Needs info`, `Troubleshooting`, `Deployment`, `Paused`.
Only the three above are surfaced as Batch 010 overlay toggles. (`Deployment`
is the same tag §13 rule 4 reads for `test_type`.)

---

## Age in stage

`statuscategorychangedate` is used as the **v1 approximation** of "age in
stage". True per-status age requires walking the changelog — out of scope
for Batch 010 (flagged in the route code).

---

## Brand resolution

Reuses the project brand-model chain (§13 rules 13 + 28), matching the
webhook (`supabase/functions/jira-webhook/index.ts`):

- `single_brand` project → all tickets assigned to `projects.default_brand_id`.
- `multi_brand` project → read `projects.brand_jira_field_id` off each
  ticket → `brands.jira_value` → `brand_aliases.jira_value` →
  `projects.default_brand_id` → null.

Brand strings are never constructed; unresolved tickets are excluded from
per-brand counts (and logged).
