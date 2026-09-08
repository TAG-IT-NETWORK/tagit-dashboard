"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bot, CheckCircle2, ExternalLink, GitFork, Loader2, Play, Search, Truck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@tagit/ui";
import {
  AGENT_CATALOG,
  FAMILY_LABELS,
  FAMILY_ORDER,
  STATUS_LABELS,
  catalogSummary,
  filterCatalog,
  type AgentFamily,
  type AgentStatus,
  type CatalogAgent,
} from "@/lib/agents/catalog";

const STATUS_CLASSES: Record<AgentStatus, string> = {
  live: "bg-green-500/10 text-green-500 border-green-500/30",
  beta: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  planned: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  proposed: "bg-violet-500/10 text-violet-400 border-violet-500/30",
};

interface RunState {
  busy: boolean;
  result: unknown;
  error: string | null;
}

async function runSkill(skill: string, input: Record<string, unknown>): Promise<{ result: unknown; error: string | null }> {
  const res = await fetch("/api/a2a", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload: { jsonrpc: "2.0", id: `catalog-${Date.now()}`, method: "message/send", params: { skill, input } } }),
  });
  const body = (await res.json().catch(() => null)) as { result?: { status?: string; output?: unknown; error?: string }; error?: { message?: string } | string } | null;
  if (!res.ok || !body) return { result: null, error: typeof body?.error === "string" ? body.error : body?.error?.message ?? `HTTP ${res.status}` };
  if (body.error) return { result: null, error: typeof body.error === "string" ? body.error : (body.error.message ?? "agent error") };
  const task = body.result;
  if (task?.status === "failed") return { result: null, error: task.error ?? "agent reported failure" };
  return { result: task?.output ?? task ?? body, error: null };
}

export function AgentCatalog({ canRun }: { canRun: boolean }) {
  const [family, setFamily] = useState<AgentFamily | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [q, setQ] = useState("");
  const summary = useMemo(() => catalogSummary(AGENT_CATALOG), []);
  const visible = useMemo(() => filterCatalog(AGENT_CATALOG, { family, status, q }), [family, status, q]);
  const grouped = useMemo(() => FAMILY_ORDER.map((f) => ({ family: f, agents: visible.filter((a) => a.family === f) })).filter((g) => g.agents.length > 0), [visible]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bot className="h-6 w-6 text-amber-500" /> Agent Catalog
          </h1>
          <p className="text-muted-foreground">
            Every agent of the TAG IT mesh from the whitepaper, plus what runs today and a few we suggest. Live cards can be exercised right here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className={STATUS_CLASSES.live}>{summary.live} live</Badge>
          <Badge variant="outline" className={STATUS_CLASSES.beta}>{summary.beta} beta</Badge>
          <Badge variant="outline" className={STATUS_CLASSES.planned}>{summary.planned} planned</Badge>
          <Badge variant="outline" className={STATUS_CLASSES.proposed}>{summary.proposed} proposed</Badge>
          <Badge variant="secondary">{summary.total} total</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <div className="relative mr-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents…" className="h-9 w-56 pl-8" />
          </div>
          {FAMILY_ORDER.map((f) => (
            <Chip key={f} active={family === f} onClick={() => setFamily(family === f ? null : f)}>
              {FAMILY_LABELS[f]}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {(Object.keys(STATUS_LABELS) as AgentStatus[]).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>
              {STATUS_LABELS[s]}
            </Chip>
          ))}
        </CardContent>
      </Card>

      {grouped.length === 0 && <p className="text-sm text-muted-foreground">No agents match.</p>}
      {grouped.map((g) => (
        <section key={g.family} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {FAMILY_LABELS[g.family]} <span className="font-normal">· {g.agents.length}</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {g.agents.map((a) => (
              <AgentCard key={a.id} agent={a} canRun={canRun} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function AgentCard({ agent, canRun }: { agent: CatalogAgent; canRun: boolean }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<Record<string, RunState>>({});

  const run = async (skillId: string, input: Record<string, unknown>) => {
    setRuns((r) => ({ ...r, [skillId]: { busy: true, result: null, error: null } }));
    const out = await runSkill(skillId, input);
    setRuns((r) => ({ ...r, [skillId]: { busy: false, ...out } }));
  };

  return (
    <Card className={agent.status === "live" ? "border-green-500/30" : agent.status === "beta" ? "border-amber-500/20" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{agent.name}</CardTitle>
            <CardDescription className="mt-1">{agent.summary}</CardDescription>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className={STATUS_CLASSES[agent.status]}>{STATUS_LABELS[agent.status]}</Badge>
            {agent.perPartner && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title="One deployment per partner — fork the template">
                <GitFork className="h-3 w-3" /> per partner
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {agent.responsibilities.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">
          {agent.source === "whitepaper" ? `Whitepaper ${agent.ref ?? ""}` : agent.source === "code" ? `Code: ${agent.ref ?? ""}` : "Suggested by the team"}
        </p>
        {agent.links && agent.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {agent.links.map((l) => (
              <Button key={l.href} size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
                {l.href.startsWith("http") ? (
                  <a href={l.href} target="_blank" rel="noreferrer">
                    {l.label} <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                ) : (
                  <Link href={l.href}>{l.label}</Link>
                )}
              </Button>
            ))}
          </div>
        )}
        {agent.panel === "logistics" && <LogisticsPanel canRun={canRun} />}
        {agent.skills && agent.skills.length > 0 && (
          <div className="space-y-2">
            <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setOpen((v) => !v)}>
              {open ? "hide" : "show"} {agent.skills.length} skill{agent.skills.length > 1 ? "s" : ""}
            </button>
            {open &&
              agent.skills.map((s) => {
                const st = runs[s.id];
                return (
                  <div key={s.id} className="rounded-md border border-border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium">{s.label}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{s.id}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!canRun || st?.busy} onClick={() => void run(s.id, s.sample)}>
                        {st?.busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />} Run
                      </Button>
                    </div>
                    {st?.error && <p className="mt-1 text-xs text-destructive">{st.error}</p>}
                    {st && !st.busy && st.result !== null && st.result !== undefined && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px]">{JSON.stringify(st.result, null, 2)}</pre>
                    )}
                  </div>
                );
              })}
            {!canRun && <p className="text-[11px] text-muted-foreground">Editor role required to run skills.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TrackingEvent {
  at: string;
  status: string;
  description: string;
  location?: string;
}
interface TrackingResult {
  carrier: string;
  trackingNumber: string;
  status: string;
  statusText: string;
  eta: string | null;
  lastLocation: string | null;
  events: TrackingEvent[];
  source: string;
}

function LogisticsPanel({ canRun }: { canRun: boolean }) {
  const [carrier, setCarrier] = useState<"demo" | "ups">("demo");
  const [tracking, setTracking] = useState("TAGIT-DEMO-0001");
  const [state, setState] = useState<RunState>({ busy: false, result: null, error: null });
  const result = state.result as TrackingResult | null;

  const track = async () => {
    setState({ busy: true, result: null, error: null });
    const out = await runSkill("logistics__track_shipment", { carrier, trackingNumber: tracking.trim() });
    setState({ busy: false, ...out });
  };

  return (
    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="flex items-center gap-2 text-xs font-medium"><Truck className="h-4 w-4 text-amber-500" /> Track a shipment</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Carrier</Label>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value as "demo" | "ups")} className="h-9 rounded-md border border-border bg-background px-2 text-xs">
            <option value="demo">Demo carrier</option>
            <option value="ups">UPS</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Tracking number</Label>
          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} className="h-9 w-48 font-mono text-xs" placeholder="1Z… or TAGIT-DEMO-0001" />
        </div>
        <Button size="sm" onClick={() => void track()} disabled={!canRun || state.busy || tracking.trim().length < 4}>
          {state.busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />} Track
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Demo numbers: end with D = delivered, X = exception, anything else = in transit. UPS needs API keys on the server.</p>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {result && (
        <div className="space-y-1 text-xs">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className={`h-4 w-4 ${result.status === "delivered" ? "text-green-500" : result.status === "exception" ? "text-destructive" : "text-amber-500"}`} />
            {result.statusText}
            {result.eta && <span className="text-muted-foreground">· ETA {result.eta.slice(0, 10)}</span>}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{result.source}</span>
          </p>
          <ol className="space-y-0.5 border-l border-border pl-3">
            {result.events.map((e, i) => (
              <li key={i} className="text-muted-foreground">
                <span className="font-mono text-[10px]">{e.at.slice(0, 16).replace("T", " ")}</span> · {e.description}
                {e.location ? ` — ${e.location}` : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
