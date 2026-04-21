// Deno / Supabase Edge Function — Radara sweep.
// Triggered on a schedule by pg_cron (see migration 006) or manually by
// a human. Queries quality_logs, figures out what needs human attention,
// and posts a report card to Microsoft Teams.
//
// Self-contained: no imports outside this file except the supabase-js
// npm specifier. Mirrors the pattern used by jira-webhook and jira-sync.

import { createClient } from 'npm:@supabase/supabase-js@2';

// -------------------------------------------------------------------------
// Env
// -------------------------------------------------------------------------
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const teamsWebhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL');

if (!supabaseUrl || !serviceRoleKey || !teamsWebhookUrl) {
  throw new Error('radara-sweep: missing env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TEAMS_WEBHOOK_URL)');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
interface QualityLog {
  id: string;
  jira_ticket_id: string;
  jira_ticket_url: string | null;
  client_brand: string | null;
  severity: string | null;
  log_status: string;
  triggered_at: string;
  log_number: number;
  created_at: string | null;
  who_owns_fix: string | null;
  updated_at: string | null;
}

type SweepName = 'morning' | 'midday' | 'eod' | 'adhoc';

interface SweepMeta {
  name: SweepName;
  title: string;
  emoji: string;
  persist: boolean; // whether to update last_run_at
}

// -------------------------------------------------------------------------
// Sweep metadata
// -------------------------------------------------------------------------
function sweepMeta(raw: string | undefined): SweepMeta {
  const key = (raw ?? '').toLowerCase();
  if (key === 'morning') return { name: 'morning', title: 'Morning Sweep', emoji: '🌅', persist: true };
  if (key === 'midday') return { name: 'midday', title: 'Midday Check', emoji: '🔍', persist: true };
  if (key === 'eod') return { name: 'eod', title: 'End of Day Roundup', emoji: '🏁', persist: true };
  return { name: 'adhoc', title: 'Ad-hoc Check', emoji: '⏱️', persist: false };
}

// -------------------------------------------------------------------------
// Teams message card
// -------------------------------------------------------------------------
interface Section {
  text?: string;
  facts?: Array<{ name: string; value: string }>;
}

function buildCard(opts: {
  meta: SweepMeta;
  totalOpen: number;
  newCount: number;
  criticals: QualityLog[];
  aging: QualityLog[];
  repeats: QualityLog[];
  blocked: QualityLog[];
  comment: string;
}): Record<string, unknown> {
  const { meta, totalOpen, newCount, criticals, aging, repeats, blocked, comment } = opts;

  const sections: Section[] = [
    {
      facts: [
        { name: 'Total open', value: String(totalOpen) },
        { name: 'New since last sweep', value: String(newCount) },
      ],
    },
  ];

  if (criticals.length > 0) {
    sections.push({
      text: `**🔴 Critical issues (${criticals.length})**\n\n${criticals.map(formatLine).join('\n\n')}`,
    });
  }
  if (aging.length > 0) {
    sections.push({
      text: `**⚠️ Aging — no movement in 3+ days (${aging.length})**\n\n${aging.map(formatLine).join('\n\n')}`,
    });
  }
  if (repeats.length > 0) {
    sections.push({
      text: `**👀 Repeat offenders — 3+ sendbacks (${repeats.length})**\n\n${repeats.map(formatLine).join('\n\n')}`,
    });
  }
  if (blocked.length > 0) {
    sections.push({
      text: `**🚧 Blocked (${blocked.length})**\n\n${blocked.map(formatLine).join('\n\n')}`,
    });
  }

  sections.push({ text: `_— Radara: ${comment}_` });

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
  });

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: 'F47920',
    summary: `Radara ${meta.title}`,
    title: `${meta.emoji} ${meta.title} — ${date}`,
    sections,
  };
}

function formatLine(log: QualityLog): string {
  const age = daysAgo(log.triggered_at);
  const link = log.jira_ticket_url
    ? `[${log.jira_ticket_id}](${log.jira_ticket_url})`
    : log.jira_ticket_id;
  const sev = log.severity ? `· ${log.severity}` : '';
  const brand = log.client_brand ? `· ${log.client_brand}` : '';
  const owner = log.who_owns_fix ? `· @${log.who_owns_fix}` : '';
  return `• ${link} ${sev} ${brand} ${owner} · ${age}`;
}

function daysAgo(iso: string | null): string {
  if (!iso) return 'unknown age';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

// -------------------------------------------------------------------------
// Radara's editorial comment — picks based on the state of the queue
// -------------------------------------------------------------------------
function radaraComment(opts: {
  totalOpen: number;
  criticals: QualityLog[];
  aging: QualityLog[];
  repeats: QualityLog[];
  blocked: QualityLog[];
  newCount: number;
}): string {
  const { totalOpen, criticals, aging, repeats, blocked, newCount } = opts;

  if (totalOpen === 0 && blocked.length === 0 && criticals.length === 0) {
    return 'Clean sweep. Go touch grass. 🌿';
  }
  if (criticals.length >= 3) {
    return `${criticals.length} criticals in the queue. Someone cancel my lunch. 🔴`;
  }
  if (criticals.length === 2) {
    return `${criticals.length} criticals open. This is fine. (It's not fine.) 🔴`;
  }
  if (criticals.length === 1) {
    return 'One critical open. Drop what you\'re doing. 🔴';
  }
  if (aging.length >= 3) {
    return `${aging.length} tickets sitting untouched for days. You know who you are. 👀`;
  }
  if (repeats.length > 0) {
    return `${repeats.length} ticket${repeats.length === 1 ? '' : 's'} just won\'t quit coming back. Worth a conversation. 👀`;
  }
  if (blocked.length >= 2) {
    return `${blocked.length} blocked. Unblock someone today, please. 🚧`;
  }
  if (newCount === 0) {
    return 'Nothing new since last sweep. Proceed with moderate enthusiasm. ☕';
  }
  if (newCount >= 5) {
    return `${newCount} new since last sweep. Strap in. ☕`;
  }
  return `${newCount} new since last sweep. Carry on. ☕`;
}

// -------------------------------------------------------------------------
// Request handler
// -------------------------------------------------------------------------
Deno.serve(async (request: Request) => {
  let sweep: string | undefined;
  try {
    const body = await request.json();
    sweep = typeof body?.sweep === 'string' ? body.sweep : undefined;
  } catch {
    // body may be empty; that's fine — treat as ad-hoc
  }
  const meta = sweepMeta(sweep);
  const now = new Date();

  // Load the last_run_at for this sweep so we can compute "new since".
  const { data: config, error: configError } = await supabase
    .from('sweep_config')
    .select('last_run_at')
    .eq('sweep_name', meta.name)
    .maybeSingle();

  if (configError) {
    console.error('[radara] sweep_config lookup failed', configError);
  }
  const lastRunAt = config?.last_run_at ? new Date(config.last_run_at) : null;

  // Pull all non-deleted open/in-progress/blocked logs — small set, so one query.
  const { data: openLogs, error: openError } = await supabase
    .from('quality_logs')
    .select(
      'id, jira_ticket_id, jira_ticket_url, client_brand, severity, log_status, triggered_at, log_number, created_at, who_owns_fix, updated_at',
    )
    .eq('is_deleted', false)
    .in('log_status', ['Open', 'In Progress', 'Blocked'])
    .order('triggered_at', { ascending: true });

  if (openError) {
    console.error('[radara] quality_logs query failed', openError);
    return new Response(JSON.stringify({ error: 'quality_logs query failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const logs = (openLogs ?? []) as QualityLog[];

  const threeDaysAgoMs = now.getTime() - 3 * 86_400_000;

  const workingLogs = logs.filter(l => l.log_status === 'Open' || l.log_status === 'In Progress');
  const totalOpen = workingLogs.length;
  const criticals = logs.filter(l => l.severity === 'Critical' && l.log_status !== 'Resolved');
  const aging = workingLogs.filter(l => new Date(l.triggered_at).getTime() < threeDaysAgoMs);
  const blocked = logs.filter(l => l.log_status === 'Blocked');
  const newSinceLast = lastRunAt
    ? logs.filter(l => l.created_at && new Date(l.created_at) > lastRunAt)
    : logs; // first-ever run: everything is "new"
  const newCount = newSinceLast.length;

  // Repeat offenders: tickets with 3+ total (non-deleted) logs. Separate query
  // so we count across the whole ticket lifetime, not just the open set.
  const { data: ticketCounts } = await supabase
    .from('quality_logs')
    .select('jira_ticket_id')
    .eq('is_deleted', false);

  const countByTicket: Record<string, number> = {};
  for (const row of (ticketCounts ?? []) as Array<{ jira_ticket_id: string }>) {
    countByTicket[row.jira_ticket_id] = (countByTicket[row.jira_ticket_id] || 0) + 1;
  }
  const repeats = workingLogs
    .filter(l => (countByTicket[l.jira_ticket_id] ?? 0) >= 3)
    // one log per ticket in the report, most recent triggered_at first
    .reduce<QualityLog[]>((acc, log) => {
      if (!acc.find(x => x.jira_ticket_id === log.jira_ticket_id)) acc.push(log);
      return acc;
    }, []);

  const comment = radaraComment({
    totalOpen,
    criticals,
    aging,
    repeats,
    blocked,
    newCount,
  });

  const card = buildCard({
    meta,
    totalOpen,
    newCount,
    criticals,
    aging,
    repeats,
    blocked,
    comment,
  });

  const teamsResponse = await fetch(teamsWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });

  if (!teamsResponse.ok) {
    const bodyText = await teamsResponse.text().catch(() => '');
    console.error('[radara] Teams post failed', teamsResponse.status, bodyText.slice(0, 400));
    return new Response(
      JSON.stringify({ error: 'teams post failed', status: teamsResponse.status }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  // Only update last_run_at for scheduled sweeps. Ad-hoc runs shouldn't
  // move the cursor — we don't want them to eat the next scheduled sweep's
  // "new since" window.
  if (meta.persist) {
    const { error: updateError } = await supabase
      .from('sweep_config')
      .update({ last_run_at: now.toISOString() })
      .eq('sweep_name', meta.name);
    if (updateError) {
      console.warn('[radara] last_run_at update failed', updateError);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      sweep: meta.name,
      totalOpen,
      criticals: criticals.length,
      aging: aging.length,
      repeats: repeats.length,
      blocked: blocked.length,
      newSinceLast: newCount,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
