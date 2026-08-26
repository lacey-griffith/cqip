'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { BackToSettings } from '@/components/ui/back-to-settings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BADGE_TEXT,
  brandConfigChecks,
  worstState,
  type Check,
  type CheckState,
  type ProjectBrandFacts,
} from '@/lib/onboarding/checks';
import { DEFAULT_BRAND_FIELD_ID, type BrandModel } from '@/lib/onboarding/project-config';

// Batch "single-brand onboarding" §2.2.
//
// Spec: docs/specs/batch-single-brand-onboarding.md. Cite by section number.
//
// WHAT CHANGED AND WHY. This page used to write projects with a DIRECT BROWSER
// SUPABASE INSERT of four columns, which meant brand_model, brand_jira_field_id
// and default_brand_id were unreachable — every project was created
// multi_brand/customfield_12220 by column default, silently, with no edit path
// afterwards (§0.1-0.2). HDCRO is live in that state. Both writes now go through
// /api/admin/projects, which is admin-gated, audited, and validates the brand
// config as a unit.
//
// THE ORDERING PROBLEM (§2.2.5). A single-brand project needs a default brand;
// a brand needs the project to exist. That is handled here in two VISIBLE steps
// rather than in the schema: the project is created multi_brand, the user is
// dropped straight into the brand form, and on brand creation the project is
// PATCHed to single_brand. If they abandon after step 1 the project is left
// multi_brand and the row carries a "brand config incomplete" badge — the
// half-state is never invisible.
//
// Brand model is a Select rather than the radio the spec sketched: this repo has
// no radio-group component and adding one for two options is not worth the
// surface area.

interface ProjectRow {
  id: string;
  jira_project_key: string;
  client_name: string;
  display_name: string;
  jira_project_url: string | null;
  is_active: boolean;
  created_at: string;
  brand_model: BrandModel;
  brand_jira_field_id: string | null;
  default_brand_id: string | null;
}

interface BrandRow {
  id: string;
  project_key: string;
  brand_code: string;
  display_name: string;
  is_active: boolean;
}

const PROJECT_COLS =
  'id, jira_project_key, client_name, display_name, jira_project_url, is_active, created_at, brand_model, brand_jira_field_id, default_brand_id';

const BADGE_VARIANT: Record<CheckState, 'resolved' | 'medium' | 'critical'> = {
  ok: 'resolved',
  warning: 'medium',
  blocking: 'critical',
};

interface AddForm {
  projectKey: string;
  clientName: string;
  displayName: string;
  jiraProjectUrl: string;
  brandModel: BrandModel;
  brandFieldId: string;
}

const EMPTY_ADD: AddForm = {
  projectKey: '',
  clientName: '',
  displayName: '',
  jiraProjectUrl: '',
  brandModel: 'multi_brand',
  brandFieldId: DEFAULT_BRAND_FIELD_ID,
};

interface EditForm {
  clientName: string;
  displayName: string;
  jiraProjectUrl: string;
  brandModel: BrandModel;
  brandFieldId: string;
  defaultBrandId: string;
}

interface FinishSetup {
  projectId: string;
  projectKey: string;
  brandCode: string;
  jiraValue: string;
  displayName: string;
}

/** Sentinel for "no fallback brand" in a Select, which cannot hold an empty value. */
const NO_BRAND = '__none__';

interface ApiError {
  error?: string;
  field?: string;
}

async function callApi(
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const res = await fetch('/api/admin/projects', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed: Record<string, unknown> & ApiError;
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, error: `Request failed (${res.status})` };
  }
  if (!res.ok) {
    return { ok: false, error: parsed.error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: parsed };
}

export default function ProjectsSettingsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [add, setAdd] = useState<AddForm>(EMPTY_ADD);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [finish, setFinish] = useState<FinishSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const [
        { data: projectData, error: projectError },
        { data: brandData, error: brandError },
        { data: logData, error: logError },
      ] = await Promise.all([
        supabase.from('projects').select(PROJECT_COLS).order('created_at', { ascending: false }),
        supabase.from('brands').select('id, project_key, brand_code, display_name, is_active'),
        supabase.from('quality_logs').select('project_key').is('is_deleted', false),
      ]);

      if (projectError) throw projectError;
      if (brandError) throw brandError;
      if (logError) throw logError;

      const nextCounts: Record<string, number> = {};
      ((logData ?? []) as { project_key: string | null }[]).forEach(log => {
        if (log.project_key) {
          nextCounts[log.project_key] = (nextCounts[log.project_key] ?? 0) + 1;
        }
      });

      setProjects((projectData as ProjectRow[] | null) ?? []);
      setBrands((brandData as BrandRow[] | null) ?? []);
      setCounts(nextCounts);
    } catch (err) {
      console.error(err);
      setError('Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      const admin = data?.role === 'admin';
      setIsAdmin(admin);
      if (admin) {
        loadProjects();
      } else {
        setLoading(false);
      }
    }
    init();
  }, [loadProjects]);

  // -----------------------------------------------------------------------
  // Derived: the facts brandConfigChecks() needs, assembled per project.
  // -----------------------------------------------------------------------

  const brandProjectKeyById = useMemo(() => {
    const map: Record<string, string> = {};
    brands.forEach(b => {
      map[b.id] = b.project_key;
    });
    return map;
  }, [brands]);

  const activeBrandCountByProject = useMemo(() => {
    const map: Record<string, number> = {};
    brands.forEach(b => {
      if (b.is_active) map[b.project_key] = (map[b.project_key] ?? 0) + 1;
    });
    return map;
  }, [brands]);

  const factsFor = useCallback(
    (project: ProjectRow): ProjectBrandFacts => ({
      jira_project_key: project.jira_project_key,
      brand_model: project.brand_model,
      brand_jira_field_id: project.brand_jira_field_id,
      default_brand_id: project.default_brand_id,
      activeBrandCount: activeBrandCountByProject[project.jira_project_key] ?? 0,
      defaultBrandProjectKey: project.default_brand_id
        ? brandProjectKeyById[project.default_brand_id] ?? null
        : null,
    }),
    [activeBrandCountByProject, brandProjectKeyById],
  );

  const checksByProject = useMemo(() => {
    const map: Record<string, Check[]> = {};
    projects.forEach(p => {
      map[p.id] = brandConfigChecks(factsFor(p));
    });
    return map;
  }, [projects, factsFor]);

  const blockingCount = useMemo(
    () => projects.filter(p => worstState(checksByProject[p.id] ?? []) === 'blocking').length,
    [projects, checksByProject],
  );

  function brandsFor(projectKey: string): BrandRow[] {
    return brands
      .filter(b => b.project_key === projectKey && b.is_active)
      .sort((a, b) => a.brand_code.localeCompare(b.brand_code));
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  async function addProject() {
    if (!add.projectKey.trim() || !add.clientName.trim() || !add.displayName.trim()) {
      setMessage('Project key, client name, and display name are required.');
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    // Always created multi_brand. A single-brand project needs a brand that
    // cannot exist yet (§2.2.5); step 2 flips it.
    const result = await callApi('POST', {
      jira_project_key: add.projectKey.trim().toUpperCase(),
      client_name: add.clientName.trim(),
      display_name: add.displayName.trim(),
      jira_project_url: add.jiraProjectUrl.trim() || null,
      brand_model: 'multi_brand',
      brand_jira_field_id: add.brandFieldId.trim() || DEFAULT_BRAND_FIELD_ID,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const created = result.data.project as ProjectRow | undefined;
    const wantsSingleBrand = add.brandModel === 'single_brand';

    setAdd(EMPTY_ADD);
    await loadProjects();

    if (wantsSingleBrand && created) {
      setFinish({
        projectId: created.id,
        projectKey: created.jira_project_key,
        brandCode: '',
        jiraValue: '',
        displayName: '',
      });
      setMessage(
        `${created.jira_project_key} created. Step 2 of 2: add its brand below to finish the single-brand setup.`,
      );
      return;
    }

    setMessage(`${created?.jira_project_key ?? 'Project'} added. Add its brands from Coverage.`);
  }

  // -----------------------------------------------------------------------
  // Step 2 of the single-brand create: make the brand, then flip the project.
  // -----------------------------------------------------------------------

  async function finishSingleBrand() {
    if (!finish) return;
    if (!finish.brandCode.trim() || !finish.jiraValue.trim() || !finish.displayName.trim()) {
      setError('Brand code, Jira value, and display name are all required.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const brandRes = await fetch('/api/admin/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_key: finish.projectKey,
        brand_code: finish.brandCode.trim().toUpperCase(),
        jira_value: finish.jiraValue.trim(),
        display_name: finish.displayName.trim(),
      }),
    });

    let brandBody: { brand?: { id?: string }; error?: string };
    try {
      brandBody = await brandRes.json();
    } catch {
      setSaving(false);
      setError(`Brand creation failed (${brandRes.status}).`);
      return;
    }
    if (!brandRes.ok || !brandBody.brand?.id) {
      setSaving(false);
      // The project still exists and is multi_brand. Its row will carry the
      // incomplete badge, so nothing is silently half-done.
      setError(
        `${brandBody.error ?? 'Brand creation failed'} — ${finish.projectKey} is still set to multi-brand. Fix the brand, then switch it with Edit config.`,
      );
      await loadProjects();
      return;
    }

    const patch = await callApi('PATCH', {
      id: finish.projectId,
      brand_model: 'single_brand',
      default_brand_id: brandBody.brand.id,
    });

    setSaving(false);

    if (!patch.ok) {
      setError(
        `Brand created, but switching ${finish.projectKey} to single-brand failed: ${patch.error}. Use Edit config on its row.`,
      );
      await loadProjects();
      return;
    }

    setFinish(null);
    setMessage(`${finish.projectKey} is configured as single-brand.`);
    await loadProjects();
  }

  // -----------------------------------------------------------------------
  // Edit — the path that did not exist before (§0.2)
  // -----------------------------------------------------------------------

  function startEdit(project: ProjectRow) {
    setEditingId(project.id);
    setError(null);
    setMessage(null);
    setEdit({
      clientName: project.client_name,
      displayName: project.display_name,
      jiraProjectUrl: project.jira_project_url ?? '',
      brandModel: project.brand_model,
      brandFieldId: project.brand_jira_field_id ?? DEFAULT_BRAND_FIELD_ID,
      defaultBrandId: project.default_brand_id ?? NO_BRAND,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEdit(null);
  }

  async function saveEdit(project: ProjectRow) {
    if (!edit) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const result = await callApi('PATCH', {
      id: project.id,
      client_name: edit.clientName,
      display_name: edit.displayName,
      jira_project_url: edit.jiraProjectUrl.trim() || null,
      brand_model: edit.brandModel,
      brand_jira_field_id: edit.brandModel === 'multi_brand' ? edit.brandFieldId : null,
      default_brand_id: edit.defaultBrandId === NO_BRAND ? null : edit.defaultBrandId,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    cancelEdit();
    setMessage(`${project.jira_project_key} updated.`);
    await loadProjects();
  }

  async function toggleActive(project: ProjectRow, isActive: boolean) {
    setMessage(null);
    setError(null);
    const result = await callApi('PATCH', { id: project.id, is_active: isActive });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProjects(projects.map(p => (p.id === project.id ? { ...p, is_active: isActive } : p)));
  }

  if (isAdmin === false) {
    return (
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Admin access required</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">You do not have permission to manage projects.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToSettings />
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Project Management</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Manage Jira project integrations, brand resolution config, and review log volume by project.
        </p>
      </div>

      {blockingCount > 0 && (
        <div
          role="alert"
          className="rounded-3xl border border-[color:var(--severity-critical)] bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[color:var(--f92-dark)]">
            {blockingCount === 1
              ? '1 project has an incomplete brand configuration'
              : `${blockingCount} projects have an incomplete brand configuration`}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
            Sync resolves no brand for these projects and writes an empty brand over any existing
            value. Use <span className="font-medium">Edit config</span> on the flagged rows below.
          </p>
        </div>
      )}

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Add new project</h2>
          <p className="text-sm text-[color:var(--f92-gray)]">
            Add the Jira project key, client details, and how brands are resolved for this client.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <Label htmlFor="projectKey">Jira project key</Label>
            <Input
              id="projectKey"
              value={add.projectKey}
              onChange={e => setAdd({ ...add, projectKey: e.target.value })}
              placeholder="e.g. NBLYCRO, SPLCRO"
            />
          </div>
          <div>
            <Label htmlFor="clientName">Client name</Label>
            <Input
              id="clientName"
              value={add.clientName}
              onChange={e => setAdd({ ...add, clientName: e.target.value })}
              placeholder="e.g. Neighborly"
            />
          </div>
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={add.displayName}
              onChange={e => setAdd({ ...add, displayName: e.target.value })}
              placeholder="e.g. Neighborly CRO"
            />
          </div>
          <div>
            <Label htmlFor="jiraUrl">Jira project URL</Label>
            <Input
              id="jiraUrl"
              value={add.jiraProjectUrl}
              onChange={e => setAdd({ ...add, jiraProjectUrl: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <Label htmlFor="brandModel">Brand model</Label>
            <Select
              value={add.brandModel}
              onValueChange={value => setAdd({ ...add, brandModel: value as BrandModel })}
            >
              <SelectTrigger id="brandModel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multi_brand">Multi-brand — one Jira project, many brands</SelectItem>
                <SelectItem value="single_brand">Single-brand — the project is the brand</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
              {add.brandModel === 'multi_brand'
                ? 'Brands are read from a Jira field on each ticket. Add the brands from Coverage after this.'
                : 'Two steps: the project is created first, then you add its one brand here to finish.'}
            </p>
          </div>
          {add.brandModel === 'multi_brand' && (
            <div>
              <Label htmlFor="brandFieldId">Jira brand field</Label>
              <Input
                id="brandFieldId"
                value={add.brandFieldId}
                onChange={e => setAdd({ ...add, brandFieldId: e.target.value })}
                placeholder={DEFAULT_BRAND_FIELD_ID}
              />
              <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                The custom field each ticket&apos;s brand is read from. Neighborly uses{' '}
                {DEFAULT_BRAND_FIELD_ID}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={addProject} disabled={saving}>
            {saving ? 'Saving...' : add.brandModel === 'single_brand' ? 'Create project (step 1 of 2)' : 'Add project'}
          </Button>
          {message && <p className="text-sm text-[color:var(--f92-dark)]">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {finish && (
        <Card className="border-[color:var(--f92-navy)] bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">
              Step 2 of 2 — add {finish.projectKey}&apos;s brand
            </h2>
            <p className="text-sm text-[color:var(--f92-gray)]">
              {finish.projectKey} exists but is still set to multi-brand. Adding its brand switches it
              to single-brand. Leaving now is safe — the row will be flagged until it is finished.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Label htmlFor="finishBrandCode">Brand code</Label>
              <Input
                id="finishBrandCode"
                value={finish.brandCode}
                onChange={e => setFinish({ ...finish, brandCode: e.target.value })}
                placeholder="e.g. SPL"
              />
            </div>
            <div>
              <Label htmlFor="finishJiraValue">Jira value</Label>
              <Input
                id="finishJiraValue"
                value={finish.jiraValue}
                onChange={e => setFinish({ ...finish, jiraValue: e.target.value })}
                placeholder="e.g. SPL - Spotloan"
              />
            </div>
            <div>
              <Label htmlFor="finishBrandName">Brand display name</Label>
              <Input
                id="finishBrandName"
                value={finish.displayName}
                onChange={e => setFinish({ ...finish, displayName: e.target.value })}
                placeholder="e.g. Spotloan"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={finishSingleBrand} disabled={saving}>
              {saving ? 'Saving...' : 'Finish single-brand setup'}
            </Button>
            <Button variant="outline" onClick={() => setFinish(null)} disabled={saving}>
              Finish later
            </Button>
          </div>
        </Card>
      )}

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Projects</h2>
            <p className="text-sm text-[color:var(--f92-gray)]">
              Review active projects, their brand configuration, and how many logs each has generated.
            </p>
          </div>
          <Badge variant="default" className="text-sm">{projects.length} projects</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--f92-border)] text-left text-sm">
            <thead className="bg-[color:var(--f92-warm)] text-[color:var(--f92-dark)]">
              <tr>
                <th className="px-3 py-3 font-semibold">Project key</th>
                <th className="px-3 py-3 font-semibold">Client</th>
                <th className="px-3 py-3 font-semibold">Display Name</th>
                <th className="px-3 py-3 font-semibold">Brand model</th>
                <th className="px-3 py-3 font-semibold">Brand config</th>
                <th className="px-3 py-3 font-semibold">Log count</th>
                <th className="px-3 py-3 font-semibold">Active</th>
                <th className="px-3 py-3 font-semibold">Config</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--f92-border)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">
                    Loading projects...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">
                    No projects configured.
                  </td>
                </tr>
              ) : (
                projects.map(project => {
                  const checks = checksByProject[project.id] ?? [];
                  const state = worstState(checks);
                  const projectBrands = brandsFor(project.jira_project_key);
                  const isEditing = editingId === project.id;

                  return (
                    // The key belongs on the FRAGMENT — it is the list item.
                    // Keys on the <tr> children inside it are ignored, and React
                    // would warn and reconcile rows by index.
                    <Fragment key={project.id}>
                      <tr className="hover:bg-[color:var(--f92-warm)]">
                        <td className="px-3 py-3 font-medium text-[color:var(--f92-dark)]">
                          {project.jira_project_key}
                        </td>
                        <td className="px-3 py-3">{project.client_name}</td>
                        <td className="px-3 py-3">{project.display_name}</td>
                        <td className="px-3 py-3">
                          {project.brand_model === 'single_brand' ? 'Single-brand' : 'Multi-brand'}
                          <span className="block text-xs text-[color:var(--f92-gray)]">
                            {projectBrands.length} active {projectBrands.length === 1 ? 'brand' : 'brands'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={BADGE_VARIANT[state]}>{BADGE_TEXT[state]}</Badge>
                        </td>
                        <td className="px-3 py-3">{counts[project.jira_project_key] ?? 0}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`project-active-${project.id}`}
                              checked={project.is_active}
                              onCheckedChange={checked => toggleActive(project, checked)}
                            />
                            <Label htmlFor={`project-active-${project.id}`} className="text-xs">
                              {project.is_active ? 'Active' : 'Inactive'}
                            </Label>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => (isEditing ? cancelEdit() : startEdit(project))}
                          >
                            {isEditing ? 'Cancel' : 'Edit config'}
                          </Button>
                        </td>
                      </tr>

                      {state !== 'ok' && !isEditing && (
                        <tr className="bg-[color:var(--f92-warm)]">
                          <td colSpan={8} className="px-3 pb-3 pt-0">
                            <ul className="space-y-1 text-xs text-[color:var(--f92-dark)]">
                              {checks.map(check => (
                                <li key={check.id}>
                                  <span className="font-medium">{check.detail}</span>{' '}
                                  <span className="text-[color:var(--f92-gray)]">{check.fix}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}

                      {isEditing && edit && (
                        <tr className="bg-[color:var(--f92-warm)]">
                          <td colSpan={8} className="px-3 py-4">
                            <div className="grid gap-4 lg:grid-cols-3">
                              <div>
                                <Label htmlFor={`edit-client-${project.id}`}>Client name</Label>
                                <Input
                                  id={`edit-client-${project.id}`}
                                  value={edit.clientName}
                                  onChange={e => setEdit({ ...edit, clientName: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-display-${project.id}`}>Display name</Label>
                                <Input
                                  id={`edit-display-${project.id}`}
                                  value={edit.displayName}
                                  onChange={e => setEdit({ ...edit, displayName: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-url-${project.id}`}>Jira project URL</Label>
                                <Input
                                  id={`edit-url-${project.id}`}
                                  value={edit.jiraProjectUrl}
                                  onChange={e => setEdit({ ...edit, jiraProjectUrl: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-model-${project.id}`}>Brand model</Label>
                                <Select
                                  value={edit.brandModel}
                                  onValueChange={value =>
                                    setEdit({ ...edit, brandModel: value as BrandModel })
                                  }
                                >
                                  <SelectTrigger id={`edit-model-${project.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="multi_brand">Multi-brand</SelectItem>
                                    <SelectItem value="single_brand">Single-brand</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {edit.brandModel === 'multi_brand' && (
                                <div>
                                  <Label htmlFor={`edit-field-${project.id}`}>Jira brand field</Label>
                                  <Input
                                    id={`edit-field-${project.id}`}
                                    value={edit.brandFieldId}
                                    onChange={e => setEdit({ ...edit, brandFieldId: e.target.value })}
                                  />
                                </div>
                              )}
                              <div>
                                <Label htmlFor={`edit-default-${project.id}`}>
                                  {edit.brandModel === 'single_brand' ? 'Default brand' : 'Fallback brand (optional)'}
                                </Label>
                                <Select
                                  value={edit.defaultBrandId}
                                  onValueChange={value => setEdit({ ...edit, defaultBrandId: value })}
                                >
                                  <SelectTrigger id={`edit-default-${project.id}`}>
                                    <SelectValue placeholder="Pick a brand" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {edit.brandModel === 'multi_brand' && (
                                      <SelectItem value={NO_BRAND}>No fallback brand</SelectItem>
                                    )}
                                    {projectBrands.length === 0 ? (
                                      <SelectItem value="__empty__" disabled>
                                        No active brands on this project yet
                                      </SelectItem>
                                    ) : (
                                      projectBrands.map(b => (
                                        <SelectItem key={b.id} value={b.id}>
                                          {b.brand_code} — {b.display_name}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                                {projectBrands.length === 0 && (
                                  <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                                    Add a brand for {project.jira_project_key} from Coverage first.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                              <Button onClick={() => saveEdit(project)} disabled={saving}>
                                {saving ? 'Saving...' : 'Save config'}
                              </Button>
                              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                                Cancel
                              </Button>
                              <span className="text-xs text-[color:var(--f92-gray)]">
                                The Jira project key cannot be changed — brands and logs join on it.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
