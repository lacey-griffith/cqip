'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface Project {
  id: string;
  jira_project_key: string;
  client_name: string;
  display_name: string;
  jira_project_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ProjectsSettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [clientName, setClientName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [jiraProjectUrl, setJiraProjectUrl] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      const [{ data: projectData, error: projectError }, { data: logData, error: logError }] = await Promise.all([
        supabase.from('projects').select('id, jira_project_key, client_name, display_name, jira_project_url, is_active, created_at').order('created_at', { ascending: false }),
        supabase.from('quality_logs').select('project_key').is('is_deleted', false),
      ]);

      if (projectError) throw projectError;
      if (logError) throw logError;

      const nextCounts: Record<string, number> = {};
      (logData || []).forEach((log: any) => {
        if (log.project_key) {
          nextCounts[log.project_key] = (nextCounts[log.project_key] || 0) + 1;
        }
      });

      setProjects((projectData as Project[]) || []);
      setCounts(nextCounts);
    } catch (err) {
      console.error(err);
      setError('Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }

  async function addProject() {
    if (!projectKey.trim() || !clientName.trim() || !displayName.trim()) {
      setMessage('Project key, client name, and display name are required.');
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const { error } = await supabase.from('projects').insert({
        jira_project_key: projectKey.trim(),
        client_name: clientName.trim(),
        display_name: displayName.trim(),
        jira_project_url: jiraProjectUrl.trim() || null,
      });

      if (error) throw error;

      setProjectKey('');
      setClientName('');
      setDisplayName('');
      setJiraProjectUrl('');
      setMessage('Project added successfully.');
      loadProjects();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to add project.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(projectId: string, isActive: boolean) {
    try {
      setMessage(null);
      setError(null);
      const { error } = await supabase.from('projects').update({ is_active: isActive }).eq('id', projectId);
      if (error) throw error;
      setProjects(projects.map(project => project.id === projectId ? { ...project, is_active: isActive } : project));
    } catch (err) {
      console.error(err);
      setError('Unable to update project.');
    }
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
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Project Management</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">Manage Jira project integrations and review log volume by project.</p>
      </div>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Add new project</h2>
          <p className="text-sm text-[color:var(--f92-gray)]">Add the Jira project key and client details for new CRO projects.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <Label htmlFor="projectKey">Jira project key</Label>
            <Input id="projectKey" value={projectKey} onChange={e => setProjectKey(e.target.value)} placeholder="e.g. NBLY" />
          </div>
          <div>
            <Label htmlFor="clientName">Client name</Label>
            <Input id="clientName" value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="jiraUrl">Jira project URL</Label>
            <Input id="jiraUrl" value={jiraProjectUrl} onChange={e => setJiraProjectUrl(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={addProject} disabled={saving}>{saving ? 'Saving...' : 'Add project'}</Button>
          {message && <p className="text-sm text-[color:var(--f92-dark)]">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Projects</h2>
            <p className="text-sm text-[color:var(--f92-gray)]">Review active projects and track how many logs each project has generated.</p>
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
                <th className="px-3 py-3 font-semibold">Log count</th>
                <th className="px-3 py-3 font-semibold">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--f92-border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">Loading projects...</td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">No projects configured.</td>
                </tr>
              ) : projects.map(project => (
                <tr key={project.id} className="hover:bg-[color:var(--f92-warm)]">
                  <td className="px-3 py-3 font-medium text-[color:var(--f92-dark)]">{project.jira_project_key}</td>
                  <td className="px-3 py-3">{project.client_name}</td>
                  <td className="px-3 py-3">{project.display_name}</td>
                  <td className="px-3 py-3">{counts[project.jira_project_key] || 0}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`project-active-${project.id}`}
                        checked={project.is_active}
                        onCheckedChange={(checked) => toggleActive(project.id, checked)}
                      />
                      <Label htmlFor={`project-active-${project.id}`} className="text-xs">
                        {project.is_active ? 'Active' : 'Inactive'}
                      </Label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
