'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/layout/toaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDeleteDialog } from '@/components/logs/confirm-delete-dialog';
import type { Brand, Milestone } from '@/lib/coverage/queries';

// Rendered as an inline section (NOT a modal) per the /settings/coverage
// spec — that's the canonical admin surface. The coverage page's brand
// detail drawer links here with ?brand=<id> to open with filter pre-set.

const ALL = '__all__';
const TICKET_PATTERN = /^[A-Z]+-\d+$/;

interface ManageMilestonesDialogProps {
  brands: Brand[];
  currentUserEmail: string;
  initialBrandId?: string | null;
}

interface EditState {
  reachedAt: string;
  notes: string;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function sourceVariant(source: string): 'default' | 'in_progress' | 'resolved' | 'open' {
  switch (source) {
    case 'webhook':  return 'resolved';
    case 'manual':   return 'in_progress';
    case 'backfill': return 'default';
    default:         return 'open';
  }
}

export function ManageMilestonesDialog({ brands, currentUserEmail, initialBrandId }: ManageMilestonesDialogProps) {
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [brandFilter, setBrandFilter] = useState<string>(initialBrandId ?? ALL);

  // Add form
  const defaultBrandForAdd = brands[0]?.id ?? '';
  const [addTicket, setAddTicket] = useState('');
  const [addBrandId, setAddBrandId] = useState(initialBrandId ?? defaultBrandForAdd);
  const [addReachedAt, setAddReachedAt] = useState(toDatetimeLocal(new Date()));
  const [addNotes, setAddNotes] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ reachedAt: '', notes: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadMilestones = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('test_milestones')
      .select('id, jira_ticket_id, jira_ticket_url, jira_summary, brand_id, brand_jira_value, milestone_type, reached_at, source, created_by, notes, is_deleted')
      .eq('is_deleted', false)
      .order('reached_at', { ascending: false });
    if (error) {
      console.error('[milestones] load failed', error);
    }
    setMilestones((data ?? []) as Milestone[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  // If brands arrives after first render (parent is still fetching), sync
  // the add-form brand default. Without this the form stays stuck on ''
  // and every submit toasts 'Pick a brand'.
  useEffect(() => {
    if (!addBrandId && brands.length > 0) {
      setAddBrandId(initialBrandId ?? brands[0].id);
    }
  }, [brands, addBrandId, initialBrandId]);

  const brandLookup = useMemo(() => {
    const m = new Map<string, Brand>();
    for (const b of brands) m.set(b.id, b);
    return m;
  }, [brands]);

  const visible = useMemo(() => {
    if (brandFilter === ALL) return milestones;
    return milestones.filter(m => m.brand_id === brandFilter);
  }, [milestones, brandFilter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addSubmitting) return;

    const ticket = addTicket.trim().toUpperCase();
    if (!TICKET_PATTERN.test(ticket)) {
      toast('❌ Ticket must look like NBLYCRO-123');
      return;
    }
    if (!addBrandId) {
      toast('❌ Pick a brand');
      return;
    }
    const reachedAtIso = fromDatetimeLocal(addReachedAt);
    if (!reachedAtIso) {
      toast('❌ Invalid reached-at timestamp');
      return;
    }

    setAddSubmitting(true);
    try {
      const brand = brandLookup.get(addBrandId);
      const notes = addNotes.trim() || null;

      // Look for any existing milestone on the same (ticket, milestone_type),
      // including soft-deleted rows. If the latest is soft-deleted, offer to
      // restore + update it rather than letting the partial unique index
      // silently accept a parallel INSERT (which would leave two rows: the
      // soft-deleted original and the new active one).
      const { data: existing } = await supabase
        .from('test_milestones')
        .select('id, is_deleted')
        .eq('jira_ticket_id', ticket)
        .eq('milestone_type', 'dev_client_review')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && existing.is_deleted) {
        const confirmed = window.confirm(
          `A previously deleted milestone exists for ${ticket}. ` +
          `Restore and update it? (Click Cancel to create a separate new record.)`,
        );
        if (confirmed) {
          const { error: restoreErr } = await supabase
            .from('test_milestones')
            .update({
              is_deleted: false,
              reached_at: reachedAtIso,
              notes,
              brand_id: addBrandId,
              brand_jira_value: brand?.jira_value ?? null,
              source: 'manual',
              created_by: currentUserEmail,
            })
            .eq('id', existing.id);
          if (restoreErr) {
            console.error('[milestones] restore failed', restoreErr);
            toast('❌ Failed to restore milestone');
            return;
          }
          const { error: auditErr } = await supabase.from('audit_log').insert({
            log_entry_id: null,
            target_type: 'test_milestone',
            target_id: existing.id,
            action: 'UPDATE',
            field_name: 'is_deleted',
            old_value: 'true',
            new_value: 'false',
            changed_by: currentUserEmail,
            notes: 'Restored via admin UI (previously soft-deleted)',
          });
          if (auditErr) {
            console.warn('[milestones] audit insert failed', auditErr);
            if (process.env.NODE_ENV !== 'production') {
              toast(`⚠️ Audit write failed: ${auditErr.message ?? 'unknown'}`);
            }
          }
          toast('♻️ Milestone restored');
          setAddTicket('');
          setAddNotes('');
          setAddReachedAt(toDatetimeLocal(new Date()));
          await loadMilestones();
          return;
        }
        // Admin opted out of restore — fall through to normal INSERT, which
        // creates a parallel active row next to the soft-deleted one.
      }

      const { data: inserted, error } = await supabase
        .from('test_milestones')
        .insert({
          jira_ticket_id: ticket,
          jira_ticket_url: `https://fusion92.atlassian.net/browse/${ticket}`,
          jira_summary: null,
          brand_id: addBrandId,
          brand_jira_value: brand?.jira_value ?? null,
          milestone_type: 'dev_client_review',
          reached_at: reachedAtIso,
          source: 'manual',
          created_by: currentUserEmail,
          notes,
        })
        .select('id, jira_ticket_id')
        .single();
      if (error) {
        if (error.code === '23505' || (error.message ?? '').includes('duplicate')) {
          toast(`❌ A milestone already exists for ${ticket}. Edit the existing one or soft-delete it first if you need to change the ticket, brand, or type.`);
        } else {
          console.error('[milestones] insert failed', error);
          toast('❌ Failed to add milestone');
        }
        return;
      }
      if (inserted) {
        const { error: auditErr } = await supabase.from('audit_log').insert({
          log_entry_id: null,
          target_type: 'test_milestone',
          target_id: inserted.id,
          action: 'CREATE',
          field_name: null,
          old_value: null,
          new_value: inserted.jira_ticket_id,
          changed_by: currentUserEmail,
          notes: 'Manual milestone added via admin UI',
        });
        if (auditErr) {
          console.warn('[milestones] audit insert failed', auditErr);
          if (process.env.NODE_ENV !== 'production') {
            toast(`⚠️ Audit write failed: ${auditErr.message ?? 'unknown'}`);
          }
        }
      }
      toast('✅ Milestone added');
      setAddTicket('');
      setAddNotes('');
      setAddReachedAt(toDatetimeLocal(new Date()));
      await loadMilestones();
    } finally {
      setAddSubmitting(false);
    }
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id);
    setEditState({
      reachedAt: toDatetimeLocal(new Date(m.reached_at)),
      notes: m.notes ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState({ reachedAt: '', notes: '' });
  }

  async function saveEdit(m: Milestone) {
    if (editSubmitting) return;
    const reachedAtIso = fromDatetimeLocal(editState.reachedAt);
    if (!reachedAtIso) {
      toast('❌ Invalid reached-at timestamp');
      return;
    }
    setEditSubmitting(true);
    try {
      const nextNotes = editState.notes.trim() || null;
      const reachedAtChanged = reachedAtIso !== m.reached_at;
      const notesChanged = nextNotes !== (m.notes ?? null);
      const { error } = await supabase
        .from('test_milestones')
        .update({
          reached_at: reachedAtIso,
          notes: nextNotes,
        })
        .eq('id', m.id);
      if (error) {
        console.error('[milestones] update failed', error);
        toast('❌ Failed to save changes');
        return;
      }
      const auditRows: Array<Record<string, unknown>> = [];
      if (reachedAtChanged) {
        auditRows.push({
          log_entry_id: null,
          target_type: 'test_milestone',
          target_id: m.id,
          action: 'UPDATE',
          field_name: 'reached_at',
          old_value: m.reached_at,
          new_value: reachedAtIso,
          changed_by: currentUserEmail,
        });
      }
      if (notesChanged) {
        auditRows.push({
          log_entry_id: null,
          target_type: 'test_milestone',
          target_id: m.id,
          action: 'UPDATE',
          field_name: 'notes',
          old_value: m.notes ?? null,
          new_value: nextNotes,
          changed_by: currentUserEmail,
        });
      }
      if (auditRows.length > 0) {
        const { error: auditErr } = await supabase.from('audit_log').insert(auditRows);
        if (auditErr) {
          console.warn('[milestones] audit insert failed', auditErr);
          if (process.env.NODE_ENV !== 'production') {
            toast(`⚠️ Audit write failed: ${auditErr.message ?? 'unknown'}`);
          }
        }
      }
      toast('✅ Milestone updated');
      cancelEdit();
      await loadMilestones();
    } finally {
      setEditSubmitting(false);
    }
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deletingId) return;
    const { error } = await supabase
      .from('test_milestones')
      .update({ is_deleted: true })
      .eq('id', deletingId);
    if (error) {
      throw new Error(error.message);
    }
    const { error: auditErr } = await supabase.from('audit_log').insert({
      log_entry_id: null,
      target_type: 'test_milestone',
      target_id: deletingId,
      action: 'DELETE',
      field_name: null,
      old_value: null,
      new_value: null,
      changed_by: currentUserEmail,
      notes: 'Soft-deleted via admin UI',
    });
    if (auditErr) {
      console.warn('[milestones] audit insert failed', auditErr);
      if (process.env.NODE_ENV !== 'production') {
        toast(`⚠️ Audit write failed: ${auditErr.message ?? 'unknown'}`);
      }
    }
    setDeletingId(null);
    await loadMilestones();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-[color:var(--f92-dark)]">Add manual milestone</h3>
        <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
          Records a Dev Client Review entry that the webhook missed (e.g. from before the webhook was live).
        </p>
        <form onSubmit={handleAdd} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="addTicket" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Jira ticket</Label>
            <Input
              id="addTicket"
              value={addTicket}
              onChange={e => setAddTicket(e.target.value)}
              placeholder="NBLYCRO-1234"
              required
              className="h-9 text-sm uppercase"
            />
          </div>
          <div>
            <Label htmlFor="addBrand" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Brand</Label>
            <Select value={addBrandId} onValueChange={setAddBrandId}>
              <SelectTrigger id="addBrand" className="h-9 text-sm">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.display_name} ({b.brand_code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="addReachedAt" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Reached at</Label>
            <Input
              id="addReachedAt"
              type="datetime-local"
              value={addReachedAt}
              onChange={e => setAddReachedAt(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="addNotes" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Notes</Label>
            <Textarea
              id="addNotes"
              value={addNotes}
              onChange={e => setAddNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={addSubmitting}>
              {addSubmitting ? 'Adding…' : 'Add milestone'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem]">
            <Label htmlFor="filterBrand" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Filter by brand</Label>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger id="filterBrand" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All brands</SelectItem>
                {brands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.display_name} ({b.brand_code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="ml-auto text-xs text-[color:var(--f92-gray)]">
            {loading ? 'Loading…' : `${visible.length} milestone${visible.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="mt-4 max-h-[32rem] overflow-x-auto overflow-y-auto pr-2">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-[color:var(--f92-surface)]">
              <tr className="text-[color:var(--f92-gray)]">
                <th className="px-2 py-2 font-semibold">Ticket</th>
                <th className="px-2 py-2 font-semibold">Brand</th>
                <th className="px-2 py-2 font-semibold">Reached at</th>
                <th className="px-2 py-2 font-semibold">Source</th>
                <th className="px-2 py-2 font-semibold">Notes</th>
                <th className="px-2 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-[color:var(--f92-gray)]">Loading milestones…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-[color:var(--f92-gray)]">No milestones for this filter.</td></tr>
              ) : visible.map(m => {
                const brand = m.brand_id ? brandLookup.get(m.brand_id) : null;
                const isEditing = editingId === m.id;
                return (
                  <tr key={m.id} className="border-t border-[color:var(--f92-border)] align-top">
                    <td className="px-2 py-2">
                      {m.jira_ticket_url ? (
                        <a href={m.jira_ticket_url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--f92-orange)] hover:underline">
                          {m.jira_ticket_id}
                        </a>
                      ) : (
                        <span className="font-medium text-[color:var(--f92-dark)]">{m.jira_ticket_id}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-[color:var(--f92-dark)]">
                      {brand ? `${brand.display_name} (${brand.brand_code})` : (m.brand_jira_value ?? '—')}
                    </td>
                    <td className="px-2 py-2 text-[color:var(--f92-dark)]">
                      {isEditing ? (
                        <Input
                          type="datetime-local"
                          value={editState.reachedAt}
                          onChange={e => setEditState(s => ({ ...s, reachedAt: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      ) : (
                        formatDateTime(m.reached_at)
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={sourceVariant(m.source)}>{m.source}</Badge>
                    </td>
                    <td className="px-2 py-2 text-xs text-[color:var(--f92-dark)] max-w-[20rem]">
                      {isEditing ? (
                        <Textarea
                          value={editState.notes}
                          onChange={e => setEditState(s => ({ ...s, notes: e.target.value }))}
                          rows={2}
                          className="text-xs"
                        />
                      ) : (
                        m.notes ?? '—'
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => saveEdit(m)} disabled={editSubmitting}>
                            {editSubmitting ? 'Saving…' : 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" onClick={() => startEdit(m)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => openDelete(m.id)} className="text-red-600 hover:text-red-700">Delete</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={open => {
          setDeleteOpen(open);
          if (!open) setDeletingId(null);
        }}
        title="Delete this milestone?"
        description="This will soft-delete the milestone. It will no longer count toward coverage metrics."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
