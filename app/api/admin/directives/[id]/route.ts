import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';
import {
  DIRECTIVE_STATUSES,
  diffDirectiveFields,
  fanOutCells,
  isDirectiveMovable,
  isDirectiveType,
  type DirectiveFieldValues,
  type DirectiveStatus,
  type DirectiveType,
} from '@/lib/client-library/directives';

// Batch 012 — Pulse directive CRUD. Edit / archive / restore / move ONE
// directive. Spec: docs/batch-012-directive-crud-spec.md §3, §4, §5, §6.
//
// Sits beside the two Phase A routes and follows their shape exactly: cookie-
// bound session → admin gate → supabaseAdmin write → getChangedBy() server-side,
// client changed_by ignored with a warn, one audit_log row per changed field.
//
// SOFT DELETE IS `status = 'archived'`. There is no is_deleted column and there
// must never be one — migration 024 already ships the flag, and a second would
// create the two-flag state the spec's decision A forbids. Cells are NEVER
// deleted on archive (decision 6): a restore must find them as they were.

const ROUTE = '[admin/directives/[id] PATCH]';

interface PatchDirectiveBody {
  title?: unknown;
  description?: unknown;
  directive_type?: unknown;
  status?: unknown;
  project_key?: unknown;
  changed_by?: unknown;
}

interface StoredDirective {
  id: string;
  project_key: string;
  title: string;
  directive_type: DirectiveType;
  description: string | null;
  status: DirectiveStatus;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isDirectiveStatus(value: unknown): value is DirectiveStatus {
  return typeof value === 'string' && (DIRECTIVE_STATUSES as readonly string[]).includes(value);
}

// Postgres unique_violation. The pre-checks below are NOT locks — two concurrent
// requests both pass them and the index catches one — so the constraint path
// must land on the same 409 as the pre-check rather than a 500 carrying a raw
// constraint name. Precedent: app/api/admin/milestones/route.ts.
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === UNIQUE_VIOLATION;
}

const DUPLICATE_MESSAGE = (title: string, projectKey: string) =>
  `A directive titled "${title}" already exists in ${projectKey}. ` +
  'Titles must be unique within a project, including archived directives.';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: PatchDirectiveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // §13 r19 — changed_by is server-derived, always.
  if ('changed_by' in (body ?? {})) {
    console.warn(`${ROUTE} ignored client-supplied changed_by`, {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  // ---------------------------------------------------------------------
  // Load the stored row. This is ALSO the source of every audit old_value —
  // never the client's copy, which is §13 r19's shape one field over and would
  // let a stale page write a false "before" into the permanent trail.
  // ---------------------------------------------------------------------
  const { data: stored, error: fetchErr } = await supabaseAdmin
    .from('directives')
    .select('id, project_key, title, directive_type, description, status')
    .eq('id', id)
    .maybeSingle<StoredDirective>();
  if (fetchErr) {
    console.error(`${ROUTE} fetch failed`, fetchErr);
    return NextResponse.json({ error: 'Failed to load directive' }, { status: 500 });
  }
  if (!stored) {
    return NextResponse.json({ error: 'Directive not found' }, { status: 404 });
  }

  // ---------------------------------------------------------------------
  // Validate whatever was supplied. Every field is optional — a PATCH carrying
  // one key must not require the rest.
  // ---------------------------------------------------------------------
  const next: DirectiveFieldValues = {};

  if ('title' in body) {
    // MUST trim, exactly as POST does. Without it " Chat Started" coexists with
    // "Chat Started" under an exact unique index, defeating the constraint
    // through a door the spec's case/whitespace decision never covered.
    const title = asTrimmedString(body.title);
    if (!title) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
    }
    next.title = title;
  }

  if ('description' in body) {
    next.description = asTrimmedString(body.description); // optional → null
  }

  if ('directive_type' in body) {
    if (!isDirectiveType(body.directive_type)) {
      return NextResponse.json(
        { error: "directive_type must be one of 'goal', 'trigger', 'site_area', 'audience'" },
        { status: 400 },
      );
    }
    next.directive_type = body.directive_type;
  }

  if ('status' in body) {
    if (!isDirectiveStatus(body.status)) {
      return NextResponse.json(
        { error: "status must be 'active' or 'archived'" },
        { status: 400 },
      );
    }
    next.status = body.status;
  }

  if ('project_key' in body) {
    const projectKey = asTrimmedString(body.project_key);
    if (!projectKey) {
      return NextResponse.json({ error: 'project_key cannot be empty' }, { status: 400 });
    }
    next.project_key = projectKey;
  }

  const targetProjectKey = next.project_key ?? stored.project_key;
  const targetTitle = next.title ?? stored.title;
  // ⚠ THE MOVE FLAG. Everything gated on it below must stay gated on it:
  // checking movability unconditionally would 409 every title/description/type
  // edit on any directive that holds work — which is nearly all of them — and
  // kill the feature on day one. Same shape as the self-collision bug the
  // duplicate pre-check guards against: a check firing on an unchanged field.
  const isMoving = targetProjectKey !== stored.project_key;

  // ---------------------------------------------------------------------
  // Destination project must exist AND be active.
  //
  // Without the is_active half, a move to an INACTIVE project succeeds and the
  // directive becomes unreachable through the UI entirely — the Pulse page's
  // project picker loads is_active projects only — while its cells have already
  // been re-fanned to that project's brands. Unrecoverable without SQL, from a
  // one-character typo.
  // ---------------------------------------------------------------------
  if (isMoving) {
    const { data: project, error: projectErr } = await supabaseAdmin
      .from('projects')
      .select('jira_project_key, is_active')
      .eq('jira_project_key', targetProjectKey)
      .maybeSingle();
    if (projectErr) {
      console.error(`${ROUTE} project lookup failed`, projectErr);
      return NextResponse.json({ error: 'Failed to verify project' }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: `Project "${targetProjectKey}" not found` }, { status: 400 });
    }
    if (!project.is_active) {
      return NextResponse.json(
        { error: `Project "${targetProjectKey}" is not active` },
        { status: 400 },
      );
    }
  }

  // ---------------------------------------------------------------------
  // Duplicate title — scoped to the DESTINATION project, and excluding self.
  //
  // `.neq('id', id)` is load-bearing: without it, saving a row whose title is
  // unchanged collides with itself and every ordinary edit returns 409.
  // ---------------------------------------------------------------------
  if (next.title !== undefined || isMoving) {
    const { data: clash, error: clashErr } = await supabaseAdmin
      .from('directives')
      .select('id')
      .eq('project_key', targetProjectKey)
      .eq('title', targetTitle)
      .neq('id', id)
      .maybeSingle();
    if (clashErr) {
      console.error(`${ROUTE} duplicate pre-check failed`, clashErr);
      return NextResponse.json({ error: 'Failed to check for duplicate title' }, { status: 500 });
    }
    if (clash) {
      return NextResponse.json(
        { error: DUPLICATE_MESSAGE(targetTitle, targetProjectKey) },
        { status: 409 },
      );
    }
  }

  const changedBy = await getChangedBy(supabase);

  // ---------------------------------------------------------------------
  // ⚠ MOVABILITY — RE-CHECKED HERE, SERVER-SIDE, AGAINST FRESH CELLS.
  //
  // The editor's lock is a convenience: the page snapshots cells once per load,
  // so its view goes stale the moment another admin edits a cell from the brand
  // page or a script runs. This is the guarantee. Both call the SAME predicate.
  //
  // Why it matters: a move re-fans the cells, which DELETES them, and cells have
  // no soft delete. A stale-page move would destroy notes and statuses with only
  // a summary audit row to show for it — the trail would show the other admin's
  // write, then a move, and nothing about what was lost.
  // ---------------------------------------------------------------------
  let movedCellCount = 0;
  if (isMoving) {
    // Destination brands first — the fan-out target AND the disjointness the
    // delete below relies on. A brand carries exactly ONE project_key, so the
    // destination brand set and the source brand set cannot overlap. That is
    // structural, not incidental, and it is what makes "delete every cell whose
    // brand is not in the destination set" precise.
    const { data: destBrands, error: brandsErr } = await supabaseAdmin
      .from('brands')
      .select('id, is_paused')
      .eq('project_key', targetProjectKey)
      .eq('is_active', true);
    if (brandsErr) {
      console.error(`${ROUTE} destination brand fetch failed`, brandsErr);
      return NextResponse.json({ error: 'Failed to load destination brands' }, { status: 500 });
    }
    const destBrandIds = new Set((destBrands ?? []).map((b) => b.id as string));

    const { data: liveCells, error: cellsErr } = await supabaseAdmin
      .from('directive_brand_status')
      .select('id, brand_id, status, note, updated_by')
      .eq('directive_id', id);
    if (cellsErr) {
      console.error(`${ROUTE} cell read for movability failed`, cellsErr);
      return NextResponse.json({ error: 'Failed to verify directive cells' }, { status: 500 });
    }

    // Only the cells this move would DESTROY are judged. On a normal move that
    // is all of them (disjoint brand sets). On a RE-RUN after a partial failure,
    // destination cells already exist and must not be counted as work standing
    // in the way of their own move.
    const staleCells = (liveCells ?? []).filter(
      (c) => !destBrandIds.has(c.brand_id as string),
    );

    const verdict = isDirectiveMovable(staleCells);
    if (!verdict.movable) {
      return NextResponse.json(
        { error: verdict.reason, blocking_cells: verdict.blockingCells },
        { status: 409 },
      );
    }

    // Fan out via the same helper create uses, so the two paths cannot drift on
    // the paused → n_a rule.
    const freshCells = fanOutCells(id, (destBrands ?? []) as { id: string; is_paused: boolean }[]);

    // INSERT FIRST, then delete. Delete-first with a failing insert strands the
    // directive at ZERO cells — renders unstarted, all hollow, Outstanding 0 —
    // and there is no re-fan-out affordance anywhere in the UI to repair it.
    //
    // UPSERT rather than INSERT, ignoring duplicates, so the whole move is
    // RE-RUNNABLE. If a later step fails, the recovery instruction is "re-run
    // the move" — and a plain insert would hit UNIQUE (directive_id, brand_id)
    // on the second attempt, making that advice impossible to follow and wedging
    // the directive holding cells for two projects.
    if (freshCells.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from('directive_brand_status')
        .upsert(freshCells, { onConflict: 'directive_id,brand_id', ignoreDuplicates: true });
      if (insertErr) {
        console.error(`${ROUTE} destination fan-out failed`, insertErr);
        return NextResponse.json(
          { error: 'Failed to create cells for the destination project. Nothing was changed.' },
          { status: 500 },
        );
      }
    }
    movedCellCount = freshCells.length;

    // ⚠ THE PREDICATE IS CARRIED INTO THE DELETE'S WHERE, not merely checked
    // before it. A cell written between the movability check and this statement
    // then SURVIVES rather than being destroyed. That degrades the residual race
    // from silent data loss to a partial apply with a signal — which is what
    // lets "lossless" be literally true instead of nearly true.
    //
    // Scoped by brand, not by id: the destination rows are fresh fan-out output
    // (updated_by NULL, note NULL, status todo/n_a) and match the predicate
    // exactly, so without this exclusion they would delete themselves.
    const destList = [...destBrandIds];
    let del = supabaseAdmin
      .from('directive_brand_status')
      .delete()
      .eq('directive_id', id)
      .is('updated_by', null)
      .is('note', null)
      .in('status', ['todo', 'n_a']);
    if (destList.length > 0) del = del.not('brand_id', 'in', `(${destList.join(',')})`);
    const { data: deleted, error: deleteErr } = await del.select('id');
    if (deleteErr) {
      console.error(`${ROUTE} stale cell delete failed`, deleteErr);
      return NextResponse.json(
        {
          error:
            'Destination cells were created but the old ones could not be removed. ' +
            'The directive has NOT been moved; re-run the move.',
        },
        { status: 500 },
      );
    }

    // AND THE MISMATCH IS CHECKED, not merely made possible. Every stale cell
    // passed the predicate moments ago, so all of them should be gone. Fewer
    // means one was written inside the window and survived — the good outcome,
    // but the operator must be told, because the directive is now holding cells
    // for two projects and has NOT been moved.
    if ((deleted ?? []).length !== staleCells.length) {
      const survived = staleCells.length - (deleted ?? []).length;
      console.error(`${ROUTE} concurrent cell write during move`, {
        directive_id: id,
        expected: staleCells.length,
        deleted: (deleted ?? []).length,
      });
      return NextResponse.json(
        {
          error:
            `${survived} cell(s) were edited by someone else while this move was in ` +
            'progress and were preserved rather than deleted. The directive has NOT ' +
            'been moved. Reload and try again.',
        },
        { status: 409 },
      );
    }
  }

  // ---------------------------------------------------------------------
  // Diff against the STORED row so no-ops are true no-ops and the audit trail
  // reflects only real changes.
  // ---------------------------------------------------------------------
  const changes = diffDirectiveFields(
    {
      title: stored.title,
      description: stored.description,
      directive_type: stored.directive_type,
      status: stored.status,
      project_key: stored.project_key,
    },
    next,
  );

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  // The directive row UPDATE goes LAST, after the cell work.
  //
  // If it went first and the cell work then failed, we would land in exactly the
  // state this route exists to prevent: directive in the new project, OLD cells
  // intact, loaded by directive_id and counted into the destination's KPIs while
  // rendering nowhere. The defect produced by its own repair path. Row-last
  // means a cell failure leaves the directive in the old project — visible, and
  // fixed by re-running the move.
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const change of changes) updatePayload[change.field] = change.after;

  const { error: updateErr } = await supabaseAdmin
    .from('directives')
    .update(updatePayload)
    .eq('id', id);
  if (updateErr) {
    if (isUniqueViolation(updateErr)) {
      return NextResponse.json(
        { error: DUPLICATE_MESSAGE(targetTitle, targetProjectKey) },
        { status: 409 },
      );
    }
    console.error(`${ROUTE} update failed`, updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // §13 r2 — one audit row per changed field, plus a summary row for the
  // re-fan-out. changed_by is server-derived; old_value came from this route's
  // own read of the stored row, never from the client.
  const auditRows: Record<string, unknown>[] = changes.map((change) => ({
    log_entry_id: null,
    target_type: 'directive',
    target_id: id,
    action: 'UPDATE',
    field_name: change.field,
    old_value: change.before,
    new_value: change.after,
    changed_by: changedBy,
    notes: 'Directive edited via Pulse',
  }));
  if (isMoving) {
    auditRows.push({
      log_entry_id: null,
      target_type: 'directive',
      target_id: id,
      action: 'UPDATE',
      field_name: 'directive_brand_status',
      old_value: null,
      new_value: `re-fanned to ${movedCellCount} brands on project move`,
      changed_by: changedBy,
      notes: 'Directive edited via Pulse',
    });
  }

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    // The directive is already updated. Mirror the sibling routes: surface the
    // audit failure without rolling back, so the caller knows the trail is
    // incomplete rather than believing the write failed.
    console.error(`${ROUTE} audit insert failed`, auditErr);
    return NextResponse.json(
      { ok: true, changed: changes.length, auditError: auditErr.message },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    changed: changes.length,
    ...(isMoving ? { cells_refanned: movedCellCount } : {}),
  });
}
