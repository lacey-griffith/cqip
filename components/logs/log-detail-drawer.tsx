'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { getSeverityVariant, getStatusVariant } from '@/components/logs/badge-variants';

interface FullLog {
  id: string;
  jira_ticket_id: string;
  jira_ticket_url: string | null;
  jira_summary: string | null;
  project_key: string;
  client_brand: string | null;
  trigger_from_status: string | null;
  trigger_to_status: string | null;
  triggered_at: string;
  log_number: number;
  log_status: string;
  detected_by: string | null;
  experiment_paused: boolean | null;
  issue_category: string[] | null;
  issue_subtype: string[] | null;
  issue_details: string | null;
  reproducibility: string | null;
  severity: string | null;
  resolution_type: string[] | null;
  root_cause_initial: string[] | null;
  root_cause_final: string[] | null;
  root_cause_description: string | null;
  resolution_notes: string | null;
  who_owns_fix: string | null;
  test_type: string | null;
  preventable: boolean | null;
  documentation_updated: boolean | null;
  process_improvement_needed: boolean | null;
  screenshot_urls: string[] | null;
  affected_url: string | null;
  jira_created_at: string | null;
  resolved_at: string | null;
  created_by: string;
  updated_at: string;
  notes: string | null;
}

interface LogDetailDrawerProps {
  logId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  isAdmin: boolean;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function yesNo(v: boolean | null | undefined): string {
  if (v == null) return '—';
  return v ? 'Yes' : 'No';
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">{label}</dt>
      <dd className="mt-1 text-sm text-[color:var(--f92-dark)]">{value ?? '—'}</dd>
    </div>
  );
}

function Chips({ values }: { values: string[] | null | undefined }) {
  if (!values || values.length === 0) return <span className="text-[color:var(--f92-gray)]">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="rounded-full border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] px-2 py-0.5 text-xs text-[color:var(--f92-dark)]"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function TextCard({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value.trim() === '') return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">{label}</p>
      <div className="mt-1 whitespace-pre-wrap rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-3 text-sm text-[color:var(--f92-dark)]">
        {value}
      </div>
    </div>
  );
}

// Arrays are equivalent if same length + same members in same order.
function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i += 1) if (aa[i] !== bb[i]) return false;
  return true;
}

export function LogDetailDrawer({ logId, open, onOpenChange, onEdit, isAdmin }: LogDetailDrawerProps) {
  const [log, setLog] = useState<FullLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !logId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setLog(null);
    (async () => {
      const { data, error } = await supabase
        .from('quality_logs')
        .select('*')
        .eq('id', logId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
      } else {
        setLog(data as FullLog | null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, logId]);

  const rootCauseChanged = log
    ? !arraysEqual(log.root_cause_initial, log.root_cause_final)
    : false;

  const hasScreenshots = log && Array.isArray(log.screenshot_urls) && log.screenshot_urls.length > 0;
  const hasAffectedUrl = Boolean(log?.affected_url);
  const showLinksSection = hasScreenshots || hasAffectedUrl;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>{log?.jira_summary ?? log?.jira_ticket_id ?? 'Log detail'}</SheetTitle>
          {log ? (
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {log.jira_ticket_url ? (
                  <a
                    href={log.jira_ticket_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--f92-orange)] px-2 py-0.5 font-semibold text-white hover:opacity-90"
                  >
                    {log.jira_ticket_id}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="rounded-full bg-[color:var(--f92-tint)] px-2 py-0.5 font-semibold text-[color:var(--f92-dark)]">
                    {log.jira_ticket_id}
                  </span>
                )}
                {log.client_brand ? <span className="text-[color:var(--f92-gray)]">{log.client_brand}</span> : null}
                <span className="text-[color:var(--f92-gray)]">Log #{log.log_number}</span>
                <span className="text-[color:var(--f92-gray)]">{formatDate(log.triggered_at)}</span>
              </div>
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-6 overflow-y-auto pr-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-[color:var(--f92-gray)]">Loading…</p>
          ) : loadError ? (
            <p className="py-8 text-center text-sm text-red-600">Couldn&apos;t load log: {loadError}</p>
          ) : !log ? (
            <p className="py-8 text-center text-sm text-[color:var(--f92-gray)]">Log not found.</p>
          ) : (
            <>
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2">
                {log.severity ? (
                  <Badge variant={getSeverityVariant(log.severity)}>{log.severity}</Badge>
                ) : null}
                <Badge variant={getStatusVariant(log.log_status)}>{log.log_status}</Badge>
                {log.log_number > 1 ? (
                  <Badge variant="default">Sendback #{log.log_number}</Badge>
                ) : null}
              </div>

              {/* Key fields */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Key fields</h3>
                <dl className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Triggered" value={formatDateTime(log.triggered_at)} />
                  <Field
                    label="Transition"
                    value={
                      log.trigger_from_status || log.trigger_to_status
                        ? `${log.trigger_from_status ?? '—'} → ${log.trigger_to_status ?? '—'}`
                        : '—'
                    }
                  />
                  <Field label="Detected by" value={log.detected_by ?? '—'} />
                  <Field label="Who owns fix" value={log.who_owns_fix ?? '—'} />
                  <Field label="Experiment paused" value={yesNo(log.experiment_paused)} />
                  <Field label="Test type" value={log.test_type ?? '—'} />
                  <Field label="Reproducibility" value={log.reproducibility ?? '—'} />
                  <Field label="Preventable" value={yesNo(log.preventable)} />
                  <Field label="Documentation updated" value={yesNo(log.documentation_updated)} />
                  <Field label="Process improvement needed" value={yesNo(log.process_improvement_needed)} />
                </dl>
              </section>

              {/* Categories & causes */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Categories &amp; causes</h3>
                <dl className="mt-3 grid grid-cols-1 gap-4">
                  <Field label="Issue category" value={<Chips values={log.issue_category} />} />
                  <Field label="Issue subtype" value={<Chips values={log.issue_subtype} />} />
                  <Field label="Root cause initial" value={<Chips values={log.root_cause_initial} />} />
                  <Field
                    label={rootCauseChanged ? 'Root cause final (updated)' : 'Root cause final'}
                    value={<Chips values={log.root_cause_final} />}
                  />
                  <Field label="Resolution type" value={<Chips values={log.resolution_type} />} />
                </dl>
              </section>

              {/* Free text */}
              {(log.issue_details || log.root_cause_description || log.resolution_notes || log.notes) ? (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Narrative</h3>
                  <TextCard label="Issue details" value={log.issue_details} />
                  <TextCard label="Root cause description" value={log.root_cause_description} />
                  <TextCard label="Resolution notes" value={log.resolution_notes} />
                  <TextCard label="Notes" value={log.notes} />
                </section>
              ) : null}

              {/* Links */}
              {showLinksSection ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Links</h3>
                  <div className="mt-3 space-y-2">
                    {hasAffectedUrl && log.affected_url ? (
                      <a
                        href={log.affected_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-[color:var(--f92-orange)] hover:underline"
                      >
                        Affected URL
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : null}
                    {hasScreenshots && log.screenshot_urls ? (
                      <ul className="space-y-1">
                        {log.screenshot_urls.map((url, i) => (
                          <li key={`${url}-${i}`}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-[color:var(--f92-orange)] hover:underline"
                            >
                              Screenshot {i + 1}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {/* Audit meta */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Audit</h3>
                <dl className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Created" value={formatDateTime(log.updated_at ?? log.triggered_at)} />
                  <Field label="Created by" value={log.created_by ?? 'system'} />
                  <Field label="Updated" value={formatDateTime(log.updated_at)} />
                  {log.resolved_at ? <Field label="Resolved" value={formatDateTime(log.resolved_at)} /> : null}
                  {log.jira_created_at ? <Field label="Jira created" value={formatDateTime(log.jira_created_at)} /> : null}
                </dl>
              </section>
            </>
          )}
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t border-[color:var(--f92-border)] pt-4">
          {isAdmin && onEdit ? (
            <Button variant="secondary" size="sm" onClick={onEdit} disabled={!log}>
              Edit
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
