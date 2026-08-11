'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MultiCombobox, type MultiComboboxOption } from '@/components/ui/multi-combobox';
import { useToast } from '@/components/layout/toaster';
import { CONFIDENCE_BANDS, type ConfidenceBand } from '@/lib/classifier/confidence';

// AI review queue — Batch classifier-1, Phase 1, COMMIT 3.
// Spec: docs/HANDOFF-root-cause-classifier.md §8 COMMIT 3, §11.4 (LOCKED: under
// Reports, NOT the logs page — that page has a render-only batch queued and would
// collide), §13.1, §13.8.
//
// SELF-CONTAINED, following the BrandWellnessReport template: its own fetch and
// state, NOT folded into the page's ReportKind union or its shared from/to
// controls. Its controls differ from every other report's, and keeping it
// separate is what made Brand Wellness cheap to re-home.
//
// ⚠ NO BULK OR SELECT-ALL ACTION, DELIBERATELY (§13.11). Bulk confirm is
// auto-confirm with a human's finger resting on it, and auto-confirm is the
// failure mode §9 names and forbids. One row, one decision. If a future batch
// wants throughput, that is a decision to take explicitly, not a checkbox column.

interface PendingRow {
  id: string;
  jira_ticket_id: string;
  jira_summary: string | null;
  jira_ticket_url: string | null;
  client_brand: string | null;
  // The prose the suggestion was derived from (§8 COMMIT 3: shown side by side).
  resolution_notes: string | null;
  notes: string | null;
  issue_details: string | null;
  ai_suggested_root_cause: string[] | null;
  ai_confidence_band: ConfidenceBand | null;
  // §13.1 — read at RENDER time, never snapshotted at classify time. r37 records
  // that a non-empty Jira value still wins on sync, so a row can acquire a
  // classification between being suggested and being reviewed. Showing the
  // current value is what stops a reviewer destroying it unknowingly.
  root_cause_final: string[] | null;
}

const BAND_STYLE: Record<ConfidenceBand, string> = {
  high: 'bg-[color:var(--pill-green-bg)] border-[color:var(--pill-green-border)] text-[color:var(--pill-green-fg)]',
  medium: 'bg-[color:var(--pill-amber-bg)] border-[color:var(--pill-amber-border)] text-[color:var(--pill-amber-fg)]',
  low: 'bg-[color:var(--pill-filter-bg)] border-[color:var(--f92-border)] text-[color:var(--pill-filter-fg)]',
};

function ProseBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-xs text-[color:var(--f92-dark)]">{value}</p>
    </div>
  );
}

export function AiReviewQueue() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correctedValues, setCorrectedValues] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // is_active is checked as well as role: a deactivated admin holding a live
        // session would otherwise see the affordance and get a 403. Cosmetic —
        // the route is the actual control — but there is no reason to render a
        // button that cannot work.
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .maybeSingle();
        setIsAdmin(profile?.role === 'admin' && profile?.is_active === true);
      }

      const [pending, tax] = await Promise.all([
        supabase
          .from('quality_logs')
          .select(
            'id, jira_ticket_id, jira_summary, jira_ticket_url, client_brand, resolution_notes, notes, issue_details, ai_suggested_root_cause, ai_confidence_band, root_cause_final',
          )
          .eq('ai_review_pending', true)
          .eq('is_deleted', false)
          .order('triggered_at', { ascending: false }),
        supabase
          .from('quality_log_taxonomy')
          .select('canonical_value, description')
          .eq('field_name', 'root_cause')
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (pending.error) throw new Error(pending.error.message);
      if (tax.error) throw new Error(tax.error.message);

      setRows((pending.data ?? []) as PendingRow[]);
      setVocabulary((tax.data ?? []).map((r) => r.canonical_value as string));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const taxonomyOptions: MultiComboboxOption[] = useMemo(
    () => vocabulary.map((v) => ({ value: v, label: v })),
    [vocabulary],
  );

  async function act(logId: string, action: 'confirm' | 'reject' | 'correct', values?: string[]) {
    setBusyId(logId);
    try {
      const res = await fetch('/api/admin/logs/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, action, ...(values ? { values } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The §13.1 409 is the interesting failure and gets its own message: the
        // row gained a root cause after the suggestion was made, so the reviewer
        // is sent to the edit dialog rather than being allowed to overwrite it.
        toast(`❌ ${body?.detail ?? body?.error ?? `Review failed (${res.status})`}`);
        await load(); // Refetch: our view of this row is stale by definition.
        return;
      }
      if (body?.warning) toast(`⚠️ ${body.warning}`);
      else toast(`✅ Recorded: ${body?.outcome ?? action}`);
      setCorrecting(null);
      setCorrectedValues([]);
      await load();
    } catch (err) {
      toast(`❌ ${err instanceof Error ? err.message : 'Review failed'}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            AI Review Queue
          </p>
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">
            Suggested root causes awaiting review
          </h2>
        </div>
        {/* The count is derived, never a literal. */}
        <p className="text-xs text-[color:var(--f92-gray)]" aria-live="polite">
          {loading ? 'Loading…' : `${rows.length} awaiting review`}
        </p>
      </div>

      <p className="mt-2 max-w-2xl text-xs text-[color:var(--f92-gray)]">
        Suggestions are never written to the canonical Root Cause field. Confirming is the only
        path — and your confirmations and corrections are how the classifier is measured.
      </p>

      {loadError && (
        <p className="mt-4 rounded-md border border-[color:var(--pill-red-border)] bg-[color:var(--pill-red-bg)] p-3 text-xs text-[color:var(--pill-red-fg)]">
          Could not load the queue: {loadError}
        </p>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <p className="mt-4 text-sm text-[color:var(--f92-gray)]">
          Nothing awaiting review.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const suggested = row.ai_suggested_root_cause ?? [];
          const existing = row.root_cause_final ?? [];
          const band = row.ai_confidence_band;
          const busy = busyId === row.id;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] p-4"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                {row.jira_ticket_url ? (
                  <a
                    href={row.jira_ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[color:var(--f92-orange)] hover:underline"
                  >
                    {row.jira_ticket_id}
                  </a>
                ) : (
                  <span className="font-mono text-xs">{row.jira_ticket_id}</span>
                )}
                {row.client_brand && (
                  <span className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                    {row.client_brand}
                  </span>
                )}
                {band && CONFIDENCE_BANDS.includes(band) && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${BAND_STYLE[band]}`}
                  >
                    {band} confidence
                  </span>
                )}
              </div>

              {row.jira_summary && (
                <p className="mt-1 text-sm font-medium text-[color:var(--f92-dark)]">
                  {row.jira_summary}
                </p>
              )}

              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {/* The prose the suggestion was derived from (§8 COMMIT 3). */}
                <div className="space-y-2">
                  <ProseBlock label="Issue details" value={row.issue_details} />
                  <ProseBlock label="Resolution notes" value={row.resolution_notes} />
                  <ProseBlock label="Notes" value={row.notes} />
                  {!row.issue_details && !row.resolution_notes && !row.notes && (
                    <p className="text-xs italic text-[color:var(--f92-gray)]">
                      No prose on this log beyond the summary.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                      Suggested
                    </p>
                    <p className="mt-0.5 text-sm text-[color:var(--f92-dark)]">
                      {suggested.length > 0 ? suggested.join(' · ') : '—'}
                    </p>
                  </div>

                  {/*
                    §13.1 — the existing value is rendered whenever there is one.
                    This is a DATA-SAFETY affordance, not a scoring device: §2
                    forbids grading the suggestion against history, and this is
                    only here so a reviewer cannot destroy a human classification
                    without seeing it. It should normally be absent, because
                    selection excludes non-empty rows — if it appears, sync moved
                    the value after the suggestion was made, and the route will
                    refuse the confirm.
                  */}
                  {existing.length > 0 && (
                    <div className="rounded-md border border-[color:var(--pill-amber-border)] bg-[color:var(--pill-amber-bg)] p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--pill-amber-fg)]">
                        Already classified
                      </p>
                      <p className="mt-0.5 text-xs text-[color:var(--pill-amber-fg)]">
                        {existing.join(' · ')} — confirming is blocked so this is not overwritten.
                        Use the edit dialog on the log if it needs changing.
                      </p>
                    </div>
                  )}

                  {isAdmin ? (
                    correcting === row.id ? (
                      <div className="space-y-2">
                        <MultiCombobox
                          values={correctedValues}
                          onChange={setCorrectedValues}
                          options={taxonomyOptions}
                          placeholder="Pick the correct root cause(s)…"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busy || correctedValues.length === 0}
                            onClick={() => act(row.id, 'correct', correctedValues)}
                          >
                            Save correction
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setCorrecting(null);
                              setCorrectedValues([]);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={busy || suggested.length === 0 || existing.length > 0}
                          onClick={() => act(row.id, 'confirm')}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setCorrecting(row.id);
                            setCorrectedValues(suggested);
                          }}
                        >
                          Correct…
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => act(row.id, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    )
                  ) : (
                    /*
                      Non-admins get an inert SPAN, never a disabled button
                      (§13.8, following the Batch 012 Pulse precedent). A disabled
                      control announces "unavailable" for something that is not a
                      control for this user at all.
                    */
                    <span className="text-xs italic text-[color:var(--f92-gray)]">
                      Review is admin-only.
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
