'use client';

// Batch 012 — Client Library, Phase A (Directive Matrix MVP).
//
// A directive × brand status matrix per project. Any authenticated user can
// VIEW; edit affordances render only for admins and the routes enforce admin
// server-side regardless. Reads/writes ONLY the two new tables (directives +
// directive_brand_status) — never the live coverage tables.
//
// Phase B/C/D are OUT OF SCOPE — TODOs only:
// TODO(Phase B): monitoring ingest (the surface Batch 008 will consume).
// TODO(Phase C): Jira ticketing from a cell.
// TODO(Phase D): public bug-submission form + per-cell ticket links.
// TODO(follow-on): directive edit/archive UI; brand-target picker (fan-out is
//   all-active-brands in Phase A).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toaster';
import {
  CELL_STATUSES,
  DIRECTIVE_TYPES,
  outstandingCount,
  type CellStatus,
  type DirectiveType,
} from '@/lib/client-library/directives';

interface ProjectRow {
  jira_project_key: string;
  display_name: string;
}

interface BrandRow {
  id: string;
  brand_code: string;
  display_name: string;
  is_paused: boolean;
}

interface DirectiveRow {
  id: string;
  title: string;
  directive_type: DirectiveType;
  description: string | null;
  status: string;
  created_at: string;
}

interface CellRow {
  id: string;
  directive_id: string;
  brand_id: string;
  status: CellStatus;
  note: string | null;
}

const TYPE_LABEL: Record<DirectiveType, string> = {
  goal: 'Goal',
  trigger: 'Trigger',
  site_area: 'Site area',
  audience: 'Audience',
};

const STATUS_LABEL: Record<CellStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  n_a: 'N/A',
};

// Cell status → token color (§13 r25 — reference tokens, no inline hex).
// done = --status-resolved (green), blocked = --status-blocked (red, the
// signal is load-bearing per spec §5). todo/in_progress/n_a use existing
// neutral + in-progress tokens; n_a renders hollow (not owed).
const STATUS_DOT: Record<CellStatus, string> = {
  todo: 'var(--f92-lgray)',
  in_progress: 'var(--status-in-progress)',
  done: 'var(--status-resolved)',
  blocked: 'var(--status-blocked)',
  n_a: 'transparent',
};

const DEFAULT_PROJECT = 'NBLYCRO';

export default function ClientLibraryPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectKey, setProjectKey] = useState<string>('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [directives, setDirectives] = useState<DirectiveRow[]>([]);
  const [cells, setCells] = useState<CellRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create-directive dialog.
  const [createOpen, setCreateOpen] = useState(false);
  // Cell editor dialog.
  const [editCell, setEditCell] = useState<{
    directiveId: string;
    directiveTitle: string;
    brand: BrandRow;
    cell: CellRow;
  } | null>(null);

  // Fetch brands + directives + cells for a project. RLS allows authenticated
  // SELECT on both new tables, so direct client queries are fine (spec §4).
  const loadProject = useCallback(async (key: string) => {
    if (!key) return;
    const [brandsRes, directivesRes] = await Promise.all([
      supabase
        .from('brands')
        .select('id, brand_code, display_name, is_paused')
        .eq('project_key', key)
        .eq('is_active', true)
        .order('display_name'),
      supabase
        .from('directives')
        .select('id, title, directive_type, description, status, created_at')
        .eq('project_key', key)
        .eq('status', 'active')
        .order('created_at'),
    ]);

    const failures: string[] = [];
    if (brandsRes.error) failures.push(`brands: ${brandsRes.error.message}`);
    if (directivesRes.error) failures.push(`directives: ${directivesRes.error.message}`);

    const directiveRows = (directivesRes.data ?? []) as DirectiveRow[];
    let cellRows: CellRow[] = [];
    if (directiveRows.length > 0) {
      const { data: cellData, error: cellErr } = await supabase
        .from('directive_brand_status')
        .select('id, directive_id, brand_id, status, note')
        .in('directive_id', directiveRows.map((d) => d.id));
      if (cellErr) failures.push(`cells: ${cellErr.message}`);
      cellRows = (cellData ?? []) as CellRow[];
    }

    setBrands((brandsRes.data ?? []) as BrandRow[]);
    setDirectives(directiveRows);
    setCells(cellRows);
    setLoadError(failures.length > 0 ? failures.join(' · ') : null);
    if (failures.length > 0) console.error('[client-library] fetch failures', failures);
  }, []);

  // Initial load: projects + admin role, then the default project's matrix.
  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      const { data: projectData, error: projectErr } = await supabase
        .from('projects')
        .select('jira_project_key, display_name')
        .eq('is_active', true)
        .order('display_name');
      if (cancelled) return;
      if (projectErr) {
        setLoadError(`projects: ${projectErr.message}`);
        setLoading(false);
        return;
      }
      const projectRows = (projectData ?? []) as ProjectRow[];
      const initialKey =
        projectRows.find((p) => p.jira_project_key === DEFAULT_PROJECT)?.jira_project_key ??
        projectRows[0]?.jira_project_key ??
        '';

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        if (!cancelled) setIsAdmin(profile?.role === 'admin');
      }

      if (cancelled) return;
      setProjects(projectRows);
      setProjectKey(initialKey);
      await loadProject(initialKey);
      if (!cancelled) setLoading(false);
    }
    initialLoad();
    return () => {
      cancelled = true;
    };
  }, [loadProject]);

  function handleProjectChange(key: string) {
    setProjectKey(key);
    void loadProject(key);
  }

  const cellByKey = useMemo(() => {
    const map = new Map<string, CellRow>();
    for (const cell of cells) map.set(`${cell.directive_id}:${cell.brand_id}`, cell);
    return map;
  }, [cells]);

  const outstandingByDirective = useMemo(() => {
    const byDirective = new Map<string, CellRow[]>();
    for (const cell of cells) {
      const list = byDirective.get(cell.directive_id) ?? [];
      list.push(cell);
      byDirective.set(cell.directive_id, list);
    }
    const result = new Map<string, number>();
    for (const [directiveId, list] of byDirective) {
      result.set(directiveId, outstandingCount(list));
    }
    return result;
  }, [cells]);

  const projectLabel = projects.find((p) => p.jira_project_key === projectKey)?.display_name ?? projectKey;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase text-[color:var(--f92-gray)]" style={{ letterSpacing: 'var(--tracking-eyebrow)' }}>
            Client Library
          </p>
          <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Directive Matrix</h1>
          <p className="mt-1 text-sm text-[color:var(--f92-gray)]">
            Cross-brand experimentation directives × brand status. Outstanding
            counts exclude paused brands.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <Label htmlFor="clProject" className="sr-only">Project</Label>
            <Select value={projectKey} onValueChange={handleProjectChange}>
              <SelectTrigger id="clProject" className="h-9 w-56 text-sm">
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.jira_project_key} value={p.jira_project_key}>
                    {p.display_name} ({p.jira_project_key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin ? (
            <Button onClick={() => setCreateOpen(true)} disabled={!projectKey}>
              + New directive
            </Button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <Card className="mb-4 border-[color:var(--status-blocked)] p-3 text-sm text-[color:var(--status-blocked)]">
          Failed to load part of the matrix: {loadError}
        </Card>
      ) : null}

      {loading ? (
        <Card className="p-8 text-center text-sm text-[color:var(--f92-gray)]">Loading…</Card>
      ) : directives.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
          No active directives for {projectLabel}.{' '}
          {isAdmin ? 'Create one to seed the matrix.' : 'An admin can create one.'}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0" style={{ boxShadow: 'var(--shadow-sm)' }}>
          {/* Horizontal scroll keeps ≥16-brand projects usable (spec §4). */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--f92-border)]">
                  <th className="sticky left-0 z-10 bg-[color:var(--f92-surface)] px-4 py-3 text-left text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]" style={{ letterSpacing: 'var(--tracking-wide)' }}>
                    Directive
                  </th>
                  {brands.map((brand) => (
                    <th
                      key={brand.id}
                      className="px-3 py-3 text-center text-[10px] font-semibold uppercase"
                      style={{
                        letterSpacing: 'var(--tracking-wide)',
                        color: brand.is_paused ? 'var(--f92-lgray)' : 'var(--f92-gray)',
                      }}
                      title={brand.is_paused ? `${brand.display_name} (paused)` : brand.display_name}
                    >
                      {brand.brand_code}
                      {brand.is_paused ? <span className="ml-0.5 opacity-70">·</span> : null}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]" style={{ letterSpacing: 'var(--tracking-wide)' }}>
                    Outstanding
                  </th>
                </tr>
              </thead>
              <tbody>
                {directives.map((directive) => {
                  const outstanding = outstandingByDirective.get(directive.id) ?? 0;
                  return (
                    <tr key={directive.id} className="border-b border-[color:var(--f92-border)] last:border-0">
                      <td className="sticky left-0 z-10 bg-[color:var(--f92-surface)] px-4 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <span
                            className="inline-flex w-fit items-center px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--f92-navy)]"
                            style={{
                              letterSpacing: 'var(--tracking-wide)',
                              background: 'var(--pill-filter-bg)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          >
                            {TYPE_LABEL[directive.directive_type]}
                          </span>
                          <span className="font-medium text-[color:var(--f92-dark)]">{directive.title}</span>
                          {directive.description ? (
                            <span className="max-w-xs text-xs text-[color:var(--f92-gray)]">{directive.description}</span>
                          ) : null}
                        </div>
                      </td>
                      {brands.map((brand) => {
                        const cell = cellByKey.get(`${directive.id}:${brand.id}`);
                        const status = cell?.status ?? 'todo';
                        const dotColor = STATUS_DOT[status];
                        const clickable = isAdmin && !!cell;
                        return (
                          <td key={brand.id} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              disabled={!clickable}
                              onClick={() =>
                                cell &&
                                setEditCell({
                                  directiveId: directive.id,
                                  directiveTitle: directive.title,
                                  brand,
                                  cell,
                                })
                              }
                              aria-label={`${directive.title} — ${brand.display_name}: ${STATUS_LABEL[status]}${clickable ? ' (edit)' : ''}`}
                              title={`${STATUS_LABEL[status]}${cell?.note ? ` — ${cell.note}` : ''}`}
                              className={
                                'mx-auto flex h-6 w-6 items-center justify-center rounded-full transition ' +
                                (clickable
                                  ? 'cursor-pointer hover:ring-2 hover:ring-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]'
                                  : 'cursor-default')
                              }
                            >
                              <span
                                className="block h-3 w-3 rounded-full"
                                style={
                                  status === 'n_a'
                                    ? { border: '1.5px dashed var(--f92-lgray)' }
                                    : { background: dotColor }
                                }
                              />
                              {cell?.note ? (
                                <span className="sr-only">has note</span>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        <span
                          className="inline-flex min-w-6 items-center justify-center px-2 py-0.5 text-xs font-semibold"
                          style={{
                            borderRadius: 'var(--radius-full)',
                            background: outstanding > 0 ? 'var(--pill-amber-bg)' : 'var(--pill-green-bg)',
                            border: `1px solid ${outstanding > 0 ? 'var(--pill-amber-border)' : 'var(--pill-green-border)'}`,
                            color: outstanding > 0 ? 'var(--pill-amber-fg)' : 'var(--pill-green-fg)',
                          }}
                        >
                          {outstanding}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isAdmin ? (
        <CreateDirectiveDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectKey={projectKey}
          projectLabel={projectLabel}
          onCreated={() => {
            setCreateOpen(false);
            void loadProject(projectKey);
          }}
        />
      ) : null}

      {isAdmin && editCell ? (
        <EditCellDialog
          open={!!editCell}
          onOpenChange={(open) => { if (!open) setEditCell(null); }}
          directiveTitle={editCell.directiveTitle}
          brand={editCell.brand}
          cell={editCell.cell}
          onSaved={() => {
            setEditCell(null);
            void loadProject(projectKey);
          }}
        />
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------------
// Create-directive dialog (admin only).
// -------------------------------------------------------------------------
function CreateDirectiveDialog({
  open,
  onOpenChange,
  projectKey,
  projectLabel,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectKey: string;
  projectLabel: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [directiveType, setDirectiveType] = useState<DirectiveType>('goal');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDirectiveType('goal');
      setDescription('');
    }
  }, [open]);

  const canSubmit = title.trim().length > 0 && !!projectKey && !submitting;

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/directives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_key: projectKey,
          title: title.trim(),
          directive_type: directiveType,
          description: description.trim() || undefined,
        }),
      });
      const result: { ok?: boolean; error?: string; auditError?: string; fanOutError?: string; cells_created?: number } =
        await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        toast(`❌ ${result.error ?? `Create failed (${res.status})`}`);
        return;
      }
      if (result.fanOutError) {
        toast(`⚠️ Directive created, but fan-out failed: ${result.fanOutError}`);
      } else if (result.auditError) {
        toast(`⚠️ Directive created (${result.cells_created ?? 0} cells), but audit write failed`);
      } else {
        toast(`✅ Directive created — ${result.cells_created ?? 0} brand cells`);
      }
      onCreated();
    } catch (err) {
      toast(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New directive</DialogTitle>
          <DialogDescription>
            Fans out one status cell per active brand in {projectLabel}. Paused
            brands start as N/A.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="dirTitle" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Title
            </Label>
            <Input
              id="dirTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add exit-intent modal"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="dirType" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Type
            </Label>
            <Select value={directiveType} onValueChange={(v) => setDirectiveType(v as DirectiveType)}>
              <SelectTrigger id="dirType" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dirDesc" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Description (optional)
            </Label>
            <Textarea
              id="dirDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context for the team"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create directive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------------
// Cell status/note editor dialog (admin only).
// -------------------------------------------------------------------------
function EditCellDialog({
  open,
  onOpenChange,
  directiveTitle,
  brand,
  cell,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  directiveTitle: string;
  brand: BrandRow;
  cell: CellRow;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<CellStatus>(cell.status);
  const [note, setNote] = useState(cell.note ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(cell.status);
      setNote(cell.note ?? '');
    }
  }, [open, cell.status, cell.note]);

  async function handleSave() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/directives/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directive_id: cell.directive_id,
          brand_id: cell.brand_id,
          status,
          note: note.trim() || null,
        }),
      });
      const result: { ok?: boolean; error?: string; changed?: number; auditError?: string } =
        await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        toast(`❌ ${result.error ?? `Save failed (${res.status})`}`);
        return;
      }
      if (result.auditError) {
        toast('⚠️ Saved, but audit write failed');
      } else if ((result.changed ?? 0) === 0) {
        toast('No changes');
      } else {
        toast('✅ Updated');
      }
      onSaved();
    } catch (err) {
      toast(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{brand.display_name}</DialogTitle>
          <DialogDescription>{directiveTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cellStatus" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Status
            </Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CellStatus)}>
              <SelectTrigger id="cellStatus" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CELL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cellNote" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Note (optional)
            </Label>
            <Textarea
              id="cellNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for this brand"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
