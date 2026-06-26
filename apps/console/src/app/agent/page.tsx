"use client";

/**
 * tagit-agent dev-ops dashboard (feature D2)
 *
 * Internal observability for the autonomous build agent running on the Mac
 * mini. Reads run history + daemon status from Supabase (the agent pushes
 * there; Vercel can't reach the Mac mini directly).
 *
 * Anti-"lying" design: the daemon's liveness is derived from
 * agent_status.updated_at staleness — we show "live", "idle", or "stale (Xm
 * ago)" based on real timestamps, never a hardcoded "running".
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  MetricCard,
  Button,
  Input,
  Label,
} from "@tagit/ui";
import {
  fetchRuns,
  fetchStatus,
  fetchQueue,
  fetchPrs,
  fetchConfig,
  sendCommand,
  spendForUtcDate,
  isConfigured,
  type AgentRun,
  type AgentConfig,
} from "@/lib/agent-api";

function relTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Liveness from status freshness. The daemon refreshes status each cycle. */
function liveness(
  updatedAt: string | undefined,
  cycleMin = 20,
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (!updatedAt) return { label: "unknown", variant: "outline" };
  const ageMin = (Date.now() - new Date(updatedAt).getTime()) / 60000;
  // A healthy daemon writes at least once per cycle. Allow 2.5× slack.
  if (ageMin <= cycleMin * 2.5)
    return { label: `live · ${relTime(updatedAt)}`, variant: "default" };
  return { label: `stale · ${relTime(updatedAt)}`, variant: "destructive" };
}

export default function AgentDashboardPage() {
  const configured = isConfigured();
  const queryClient = useQueryClient();

  const runsQ = useQuery({
    queryKey: ["agent-runs"],
    queryFn: () => fetchRuns(25),
    refetchInterval: 30_000,
    enabled: configured,
  });
  const statusQ = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 30_000,
    enabled: configured,
  });

  const queueQ = useQuery({
    queryKey: ["agent-queue"],
    queryFn: () => fetchQueue(),
    refetchInterval: 30_000,
    enabled: configured,
  });
  const prsQ = useQuery({
    queryKey: ["agent-prs"],
    queryFn: () => fetchPrs(),
    refetchInterval: 60_000,
    enabled: configured,
  });
  const configQ = useQuery({
    queryKey: ["agent-config"],
    queryFn: () => fetchConfig(),
    refetchInterval: 60_000,
    enabled: configured,
  });

  const pauseMutation = useMutation({
    mutationFn: (action: "pause" | "resume") => sendCommand(action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    },
  });
  const runNowMutation = useMutation({
    mutationFn: (taskId: string) => sendCommand("run-now", { taskId }),
  });
  const configMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => sendCommand("set-config", patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-config"] });
    },
  });

  if (!configured) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-2xl font-bold mb-4">tagit-agent</h1>
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Supabase env not configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in this app&apos;s env.
          </CardContent>
        </Card>
      </main>
    );
  }

  const runs = runsQ.data ?? [];
  const status = statusQ.data ?? null;
  const live = liveness(status?.updated_at, undefined);
  const paused = Boolean(status?.paused);

  const spendToday = spendForUtcDate(runs, todayUtc());
  const budget = Number(status?.daily_budget ?? 20);
  const okCount = runs.filter((r) => r.success).length;

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tagit-logo.png" alt="TAG IT" className="h-9 w-9 rounded" />
          <h1 className="text-2xl font-bold">tagit-agent — dev-ops</h1>
        </div>
        <div className="flex items-center gap-3">
          {paused && <Badge variant="destructive">paused</Badge>}
          <Badge variant={live.variant}>{live.label}</Badge>
          <Button
            variant={paused ? "default" : "outline"}
            size="sm"
            disabled={pauseMutation.isPending}
            onClick={() => pauseMutation.mutate(paused ? "resume" : "pause")}
          >
            {pauseMutation.isPending ? "Sending…" : paused ? "Resume agent" : "Pause agent"}
          </Button>
        </div>
      </div>
      {pauseMutation.isSuccess && (
        <p className="text-xs text-muted-foreground">
          Command queued — takes effect on the daemon&apos;s next cycle (up to ~20 min).
          &quot;Pause&quot; stops it picking up new tasks; it won&apos;t interrupt a task already
          running.
        </p>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Spend today (UTC)"
          value={`$${spendToday.toFixed(2)}`}
          loading={runsQ.isLoading}
        />
        <MetricCard title="Daily budget" value={`$${budget.toFixed(0)}`} />
        <MetricCard
          title="Queue depth"
          value={status?.queue_depth ?? "—"}
          loading={statusQ.isLoading}
        />
        <MetricCard
          title="Recent success"
          value={runs.length ? `${okCount}/${runs.length}` : "—"}
          loading={runsQ.isLoading}
        />
      </div>

      {/* Daemon note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daemon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>State: {status?.daemon_note ?? "—"}</div>
          <div>Cycle: {status?.cycle_num ?? "—"}</div>
          <div>Last status update: {status?.updated_at ? relTime(status.updated_at) : "never"}</div>
        </CardContent>
      </Card>

      {/* Task queue + Run now */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue ({queueQ.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {queueQ.isLoading && <div className="text-muted-foreground">Loading…</div>}
          {!queueQ.isLoading && (queueQ.data?.length ?? 0) === 0 && (
            <div className="text-muted-foreground">Queue is empty.</div>
          )}
          {(queueQ.data ?? []).map((t) => (
            <div
              key={t.task_id}
              className="flex items-center justify-between border-b border-border/40 py-2 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {t.repo ?? "no-repo"} · {t.priority ?? "—"} · {t.status}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={runNowMutation.isPending}
                onClick={() => runNowMutation.mutate(t.task_id)}
              >
                Run now
              </Button>
            </div>
          ))}
          {runNowMutation.isSuccess && (
            <p className="text-xs text-muted-foreground">
              Run-now queued — the daemon picks it next cycle (overrides priority + working hours).
            </p>
          )}
        </CardContent>
      </Card>

      {/* PR review queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            PRs awaiting review ({prsQ.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {prsQ.isLoading && <div className="text-muted-foreground">Loading…</div>}
          {!prsQ.isLoading && (prsQ.data?.length ?? 0) === 0 && (
            <div className="text-muted-foreground">No open agent PRs.</div>
          )}
          {(prsQ.data ?? []).map((pr) => (
            <div
              key={`${pr.repo}#${pr.number}`}
              className="flex items-center justify-between border-b border-border/40 py-2 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{pr.title}</div>
                <div className="text-xs text-muted-foreground">
                  {pr.repo} · {pr.head_branch}
                  {pr.created_at ? ` · ${relTime(pr.created_at)}` : ""}
                </div>
              </div>
              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                className="pl-3 text-xs text-blue-400 hover:underline whitespace-nowrap"
              >
                #{pr.number} →
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Run feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {runsQ.isLoading && <div className="text-muted-foreground">Loading…</div>}
          {!runsQ.isLoading && runs.length === 0 && (
            <div className="text-muted-foreground">No runs recorded yet.</div>
          )}
          {runs.map((r: AgentRun) => (
            <div
              key={r.id}
              className="flex items-center justify-between border-b border-border/40 py-2 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span>{r.success ? "✅" : "❌"}</span>
                  <span className="truncate font-medium">{r.task_title}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {relTime(r.ts)} · {r.repo ?? "no-repo"} · {r.model.replace("claude-", "")}
                  {r.subagent_calls != null ? ` · ${r.subagent_calls} subagents` : ""}
                  {r.error ? ` · ${r.error}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3 pl-3">
                {r.pr_url && (
                  <a
                    href={r.pr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    PR #{r.pr_url.split("/").pop()}
                  </a>
                )}
                <span className="text-xs tabular-nums text-muted-foreground">
                  ${Number(r.cost_usd).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Settings */}
      <SettingsCard
        config={configQ.data ?? null}
        saving={configMutation.isPending}
        saved={configMutation.isSuccess}
        onSave={(patch) => configMutation.mutate(patch)}
      />

      <p className="text-xs text-muted-foreground">
        Source: Supabase <code>tagitagent_*</code> tables, written by the Mac mini daemon.
        Auto-refreshes every 30s. Liveness is derived from status freshness, not asserted. Settings
        changes take effect on the next cycle.
      </p>
    </main>
  );
}

/** Settings form — edits daemon config via the set-config command. */
function SettingsCard({
  config,
  saving,
  saved,
  onSave,
}: {
  config: AgentConfig | null;
  saving: boolean;
  saved: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [budget, setBudget] = useState("");
  const [interval, setInterval] = useState("");
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Seed local state from server config once it loads (and we're not editing).
  if (config && !dirty && budget === "") {
    setBudget(String(config.daily_budget ?? ""));
    setInterval(String(config.cycle_interval_min ?? ""));
    setHoursEnabled(Boolean(config.active_hours_enabled));
    setStart(String(config.active_hours_start ?? ""));
    setEnd(String(config.active_hours_end ?? ""));
    setWeekdaysOnly(Boolean(config.weekdays_only));
  }

  const mark = () => setDirty(true);

  const save = () => {
    const patch: Record<string, unknown> = {};
    if (budget !== "") patch.daily_budget = Number(budget);
    if (interval !== "") patch.cycle_interval_min = Number(interval);
    patch.active_hours_enabled = hoursEnabled;
    if (start !== "") patch.active_hours_start = Number(start);
    if (end !== "") patch.active_hours_end = Number(end);
    patch.weekdays_only = weekdaysOnly;
    onSave(patch);
    setDirty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="budget">Daily budget ($)</Label>
            <Input
              id="budget"
              type="number"
              value={budget}
              onChange={(e) => {
                setBudget(e.target.value);
                mark();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="interval">Cycle interval (min)</Label>
            <Input
              id="interval"
              type="number"
              value={interval}
              onChange={(e) => {
                setInterval(e.target.value);
                mark();
              }}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border/40 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hoursEnabled}
              onChange={(e) => {
                setHoursEnabled(e.target.checked);
                mark();
              }}
            />
            Working hours (idle outside the window — saves Max quota, no 3am commits)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="start">Active from (hour, 0–23)</Label>
              <Input
                id="start"
                type="number"
                min={0}
                max={23}
                value={start}
                disabled={!hoursEnabled}
                onChange={(e) => {
                  setStart(e.target.value);
                  mark();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end">Active until (hour, 0–23)</Label>
              <Input
                id="end"
                type="number"
                min={0}
                max={23}
                value={end}
                disabled={!hoursEnabled}
                onChange={(e) => {
                  setEnd(e.target.value);
                  mark();
                }}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={weekdaysOnly}
              disabled={!hoursEnabled}
              onChange={(e) => {
                setWeekdaysOnly(e.target.checked);
                mark();
              }}
            />
            Weekdays only
          </label>
          <p className="text-xs text-muted-foreground">
            Timezone: {config?.active_timezone ?? "America/New_York"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          {saved && !dirty && (
            <span className="text-xs text-muted-foreground">Saved — applies next cycle.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
