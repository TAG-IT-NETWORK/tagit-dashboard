/**
 * tagit-agent dashboard — data layer (feature D2)
 *
 * Reads the agent's run history + daemon status from Supabase via raw
 * PostgREST (no @supabase/supabase-js dependency — keeps the bundle lean and
 * matches the agent's own approach). Read-only: uses the anon key under RLS
 * policies that only permit SELECT on these tables.
 *
 * The Mac mini daemon writes these tables via service_role; this dashboard is
 * a pure viewer. Records carry timestamps so we can show staleness — the
 * dashboard never claims the daemon is "live" without evidence (a fresh
 * agent_status.updated_at), unlike the legacy SUDO AI dashboard.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export interface AgentRun {
  id: number;
  ts: string;
  task_id: string;
  task_title: string;
  repo: string | null;
  model: string;
  cost_usd: number;
  duration_ms: number;
  success: boolean;
  steps_completed: number | null;
  subagent_calls: number | null;
  pr_url: string | null;
  error: string | null;
}

export interface AgentStatus {
  id: number;
  updated_at: string;
  daemon_note: string | null;
  queue_depth: number | null;
  cycle_num: number | null;
  today_spend: number | null;
  daily_budget: number | null;
  paused: boolean | null;
}

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${SUPABASE_ANON}`,
  };
}

export function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}

async function rest<T>(pathAndQuery: string): Promise<T> {
  if (!isConfigured()) {
    throw new Error(
      "Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathAndQuery}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Most recent runs, newest first. */
export function fetchRuns(limit = 25): Promise<AgentRun[]> {
  return rest<AgentRun[]>(`tagitagent_runs?select=*&order=ts.desc&limit=${limit}`);
}

/** Singleton daemon status row (id=1). Returns null if not yet written. */
export async function fetchStatus(): Promise<AgentStatus | null> {
  const rows = await rest<AgentStatus[]>(`tagitagent_status?id=eq.1&select=*`);
  return rows[0] ?? null;
}

/** Sum cost over runs whose ts is on the given UTC date (YYYY-MM-DD). */
export function spendForUtcDate(runs: AgentRun[], utcDate: string): number {
  return runs
    .filter((r) => r.ts.startsWith(utcDate))
    .reduce((sum, r) => sum + Number(r.cost_usd || 0), 0);
}

/**
 * Send a control command to the daemon (feature D3). The daemon polls for
 * pending commands at the start of each cycle, so there's up to one
 * cycle-interval of latency before it takes effect.
 *
 * RLS allows anon INSERT on tagitagent_commands (read+create), but not UPDATE —
 * only the daemon (service_role) marks them processed. So a malicious anon
 * could only enqueue commands, not forge results; acceptable for an internal
 * console.
 */
export interface QueueItem {
  task_id: string;
  title: string;
  repo: string | null;
  priority: string | null;
  status: string;
  notes_excerpt: string | null;
}

export interface OpenPr {
  number: number;
  title: string;
  repo: string;
  url: string;
  head_branch: string | null;
  created_at: string | null;
}

export interface AgentConfig {
  daily_budget: number | null;
  cycle_interval_min: number | null;
  active_hours_enabled: boolean;
  active_hours_start: number | null;
  active_hours_end: number | null;
  active_timezone: string | null;
  weekdays_only: boolean;
  updated_at: string;
}

export function fetchQueue(): Promise<QueueItem[]> {
  return rest<QueueItem[]>(`tagitagent_queue?select=*&order=priority.asc`);
}

export function fetchPrs(): Promise<OpenPr[]> {
  return rest<OpenPr[]>(`tagitagent_prs?select=*&order=created_at.desc`);
}

export async function fetchConfig(): Promise<AgentConfig | null> {
  const rows = await rest<AgentConfig[]>(`tagitagent_config?id=eq.1&select=*`);
  return rows[0] ?? null;
}

export async function sendCommand(
  action: "pause" | "resume" | "run-now" | "set-config",
  payload?: Record<string, unknown>,
): Promise<void> {
  if (!isConfigured()) throw new Error("Supabase env not set");
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/tagitagent_commands`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload: payload ?? null, status: "pending" }),
  });
  if (!res.ok) {
    throw new Error(`sendCommand ${res.status}: ${await res.text()}`);
  }
}
