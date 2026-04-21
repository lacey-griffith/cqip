'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { BackToSettings } from '@/components/ui/back-to-settings';

interface AlertRule {
  id: string;
  rule_name: string;
  rule_type: string;
  config: any;
  is_active: boolean;
  notification_channels: string[];
  created_at: string;
  updated_at?: string;
}

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      const admin = data?.role === 'admin';
      setIsAdmin(admin);
      if (admin) {
        fetchAlertRules();
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function fetchAlertRules() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setRules(data || []);
    } catch (err) {
      console.error('Error fetching alert rules:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  }

  async function toggleRuleEnabled(ruleId: string, enabled: boolean) {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .update({ is_active: enabled })
        .eq('id', ruleId);

      if (error) throw error;

      setRules(rules.map(rule =>
        rule.id === ruleId ? { ...rule, is_active: enabled } : rule
      ));
    } catch (err) {
      console.error('Error updating rule:', err);
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  }

  async function updateRuleConfig(ruleId: string, config: any) {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .update({ config })
        .eq('id', ruleId);

      if (error) throw error;

      setRules(rules.map(rule =>
        rule.id === ruleId ? { ...rule, config } : rule
      ));
      setEditingRule(null);
      setEditForm({});
    } catch (err) {
      console.error('Error updating rule config:', err);
      setError(err instanceof Error ? err.message : 'Failed to update rule configuration');
    }
  }

  const startEditing = (rule: AlertRule) => {
    setEditingRule(rule.id);
    setEditForm({ ...rule.config });
  };

  const cancelEditing = () => {
    setEditingRule(null);
    setEditForm({});
  };

  const getRuleTypeDescription = (ruleType: string) => {
    switch (ruleType) {
      case 'severity_threshold':
        return 'Triggers when logs exceed severity thresholds';
      case 'frequency_pattern':
        return 'Triggers based on log frequency patterns';
      case 'per_ticket':
        return 'Triggers for specific ticket conditions';
      case 'aging':
        return 'Triggers for logs that remain open too long';
      default:
        return 'Unknown rule type';
    }
  };

  const renderConfigEditor = (rule: AlertRule) => {
    if (editingRule !== rule.id) return null;

    switch (rule.rule_type) {
      case 'severity_threshold':
        return (
          <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="critical_threshold">Critical Threshold</Label>
              <Input
                id="critical_threshold"
                type="number"
                value={editForm.critical_threshold || 0}
                onChange={(e) => setEditForm({ ...editForm, critical_threshold: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="high_threshold">High Threshold</Label>
              <Input
                id="high_threshold"
                type="number"
                value={editForm.high_threshold || 0}
                onChange={(e) => setEditForm({ ...editForm, high_threshold: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="time_window_hours">Time Window (hours)</Label>
              <Input
                id="time_window_hours"
                type="number"
                value={editForm.time_window_hours || 24}
                onChange={(e) => setEditForm({ ...editForm, time_window_hours: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateRuleConfig(rule.id, editForm)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditing}
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'frequency_pattern':
        return (
          <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="threshold_count">Threshold Count</Label>
              <Input
                id="threshold_count"
                type="number"
                value={editForm.threshold_count || 5}
                onChange={(e) => setEditForm({ ...editForm, threshold_count: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="time_window_hours">Time Window (hours)</Label>
              <Input
                id="time_window_hours"
                type="number"
                value={editForm.time_window_hours || 24}
                onChange={(e) => setEditForm({ ...editForm, time_window_hours: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="pattern_type">Pattern Type</Label>
              <Select
                value={editForm.pattern_type || 'spike'}
                onValueChange={(value) => setEditForm({ ...editForm, pattern_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spike">Spike</SelectItem>
                  <SelectItem value="trend">Trend</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateRuleConfig(rule.id, editForm)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditing}
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'aging':
        return (
          <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="max_age_hours">Max Age (hours)</Label>
              <Input
                id="max_age_hours"
                type="number"
                value={editForm.max_age_hours || 168}
                onChange={(e) => setEditForm({ ...editForm, max_age_hours: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="severity_filter">Severity Filter</Label>
              <Select
                value={editForm.severity_filter || 'all'}
                onValueChange={(value) => setEditForm({ ...editForm, severity_filter: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical_high">Critical & High Only</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateRuleConfig(rule.id, editForm)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditing}
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Configuration editor not available for this rule type.</p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditing}
              >
                Cancel
              </Button>
            </div>
          </div>
        );
    }
  };

  if (isAdmin === false) {
    return (
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Admin access required</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">You do not have permission to manage alert rules.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading alert rules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">Error loading alert rules: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToSettings />
      {/* Header */}
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Alert Rules Management</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Configure automated alerts for quality monitoring and issue detection.
        </p>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.id} className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-[color:var(--f92-navy)]">
                    {rule.rule_name}
                  </h3>
                  <Badge variant="default" className="text-xs">
                    {rule.rule_type}
                  </Badge>
                  <Badge
                    variant="default"
                    className={`text-xs ${rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                  >
                    {rule.is_active ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {getRuleTypeDescription(rule.rule_type)}
                </p>

                {/* Configuration Summary */}
                <div className="text-sm text-gray-700 mb-4">
                  <strong>Configuration:</strong>
                  <pre className="mt-1 text-xs bg-gray-50 p-2 rounded font-mono">
                    {JSON.stringify(rule.config, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex items-center gap-4 ml-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`enabled-${rule.id}`}
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRuleEnabled(rule.id, checked)}
                  />
                  <Label htmlFor={`enabled-${rule.id}`} className="text-sm">
                    {rule.is_active ? 'Enabled' : 'Disabled'}
                  </Label>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEditing(rule)}
                  disabled={editingRule === rule.id}
                >
                  Edit Config
                </Button>
              </div>
            </div>

            {/* Config Editor */}
            {renderConfigEditor(rule)}
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <Card className="border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
          <div className="text-center">
            <p className="text-gray-500">No alert rules configured</p>
            <p className="text-sm text-gray-400 mt-1">
              Default rules will be seeded when the system processes its first log entry.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
