"use client";

import { useMemo } from "react";
import { useChainId, useReadContracts } from "wagmi";
import {
  useAllAssets,
  AssetState,
  TAGITAgentReputationABI,
  getAgentContractsForChain,
} from "@tagit/contracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  getStateLabel,
  cn,
} from "@tagit/ui";
import { Activity, Boxes, Bot, Radio, ShieldCheck, TrendingUp } from "lucide-react";
import { PRIMARY_STATES, useLiveStateChanges } from "@/lib/lifecycle";
import { useAgentList, type ReputationSummary } from "@/lib/agents";
import { TRUST_TIERS, deriveAgentScore } from "@/lib/mesh";
import {
  FRAUD_DOMAINS,
  FRAUD_MAX,
  INITIAL_TAM,
  MARKET_DOMAINS,
  NOTIONAL_VALUE_USD,
  countFlagged,
  countTransitions,
  formatUsd,
} from "@/lib/metrics";

function HeroStat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  live: "bg-green-500/10 text-green-600",
  ready: "bg-blue-500/10 text-blue-600",
  roadmap: "bg-secondary text-muted-foreground",
};

export default function MetricsPage() {
  const chainId = useChainId();
  const { assets, totalSupply } = useAllAssets({ pageSize: 100, refetchInterval: 15_000 });
  const { agents, totalAgents } = useAgentList({ refetchInterval: 20_000 });
  const liveEvents = useLiveStateChanges(12);
  const agentContracts = getAgentContractsForChain(chainId);

  const { data: repData } = useReadContracts({
    contracts: agents.map((a) => ({
      address: agentContracts.TAGITAgentReputation,
      abi: TAGITAgentReputationABI,
      functionName: "getSummary" as const,
      args: [a.agentId],
      chainId,
    })),
    query: { enabled: agents.length > 0 },
  });

  const transitions = useMemo(() => countTransitions(assets), [assets]);
  const flagged = useMemo(() => countFlagged(assets), [assets]);
  const valueSecured = totalSupply * NOTIONAL_VALUE_USD;
  const activated = useMemo(
    () => assets.filter((a) => a.state >= AssetState.ACTIVATED).length,
    [assets],
  );

  const stateCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of PRIMARY_STATES) map.set(s.id, 0);
    for (const a of assets) map.set(a.state, (map.get(a.state) ?? 0) + 1);
    return map;
  }, [assets]);

  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of TRUST_TIERS) counts.set(t.key, 0);
    agents.forEach((a, i) => {
      const summary =
        repData?.[i]?.status === "success" ? (repData[i].result as ReputationSummary) : undefined;
      const { tier } = deriveAgentScore(a.agentId, summary);
      counts.set(tier.key, (counts.get(tier.key) ?? 0) + 1);
    });
    return counts;
  }, [agents, repData]);

  const recent = useMemo(
    () => [...assets].sort((a, b) => Number(b.timestamp - a.timestamp)).slice(0, 10),
    [assets],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <TrendingUp className="h-6 w-6" />
          Network Metrics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The trust economy at a glance — what the network has verified, against the $4.5T problem
          it closes.
        </p>
      </div>

      {/* Hero band */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HeroStat
          label="Products registered"
          value={totalSupply.toLocaleString()}
          sub={`on Base · ${activated.toLocaleString()} activated+`}
          icon={<Boxes className="h-5 w-5" />}
        />
        <HeroStat
          label="On-chain transitions"
          value={transitions.toLocaleString()}
          sub="estimated from current states"
          icon={<Activity className="h-5 w-5" />}
        />
        <HeroStat
          label="Registered agents"
          value={totalAgents.toLocaleString()}
          sub="ERC-8004 identities"
          icon={<Bot className="h-5 w-5" />}
        />
        <HeroStat
          label="Value secured"
          value={formatUsd(valueSecured)}
          sub={`modeled @ $${NOTIONAL_VALUE_USD}/asset`}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </div>

      {/* The problem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The problem we close</CardTitle>
          <CardDescription>
            Every loss below has the same root cause: physical objects cannot prove what they are or
            where they have been (§1.1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {FRAUD_DOMAINS.map((f) => (
              <div
                key={f.domain}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{f.domain}</span>
                  <span className="text-xs text-muted-foreground">{f.rootCause}</span>
                </div>
                <span className="w-16 text-right text-sm font-semibold tabular-nums">{f.loss}</span>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${f.lossValue > 0 ? Math.max(3, (f.lossValue / FRAUD_MAX) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Lifecycle distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifecycle distribution</CardTitle>
            <CardDescription>Where every verified asset sits in the state machine.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {PRIMARY_STATES.filter((s) => s.id > 0).map((s) => {
                const count = stateCounts.get(s.id) ?? 0;
                const pct = totalSupply > 0 ? (count / totalSupply) * 100 : 0;
                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
                        {s.name}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full", s.dot)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {flagged > 0 && (
                <p className="pt-1 text-xs text-red-600">
                  {flagged} asset{flagged > 1 ? "s" : ""} caught & FLAGGED by the network.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trust economy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trust economy</CardTitle>
            <CardDescription>Registered agents across the trust ladder.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {TRUST_TIERS.map((tier) => {
                const count = tierCounts.get(tier.key) ?? 0;
                const pct = totalAgents > 0 ? (count / totalAgents) * 100 : 0;
                return (
                  <div key={tier.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", tier.dot)} />
                        {tier.name}
                        <span className="text-xs text-muted-foreground">· max {tier.maxDeal}</span>
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full", tier.dot)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Tiers are derived from the on-chain reputation composite; per-dimension scoring and
              on-chain tier gating ship in the reputation phase.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Addressable domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Addressable domains</CardTitle>
          <CardDescription>
            Initial TAM {INITIAL_TAM} — and everything physical as AI manufacturing scales (§1.4).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {MARKET_DOMAINS.map((d) => (
              <div key={d.key} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{d.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                      STATUS_STYLE[d.status],
                    )}
                  >
                    {d.status}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold">{d.tam}</div>
                <p className="mt-1 text-xs text-muted-foreground">{d.blurb}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live throughput */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-green-500" />
            Live verification throughput
          </CardTitle>
          <CardDescription>
            Verification happens at machine speed — no human in the loop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {liveEvents.length === 0 && recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No on-chain activity yet.
            </p>
          ) : (
            <div className="divide-y">
              {liveEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                      LIVE
                    </span>
                    <span className="font-mono font-medium">#{e.tokenId.toString()}</span>
                    <span className="text-muted-foreground">
                      {getStateLabel(e.from)} → {getStateLabel(e.to)}
                    </span>
                  </div>
                </div>
              ))}
              {recent.map((a) => (
                <div
                  key={a.tokenId.toString()}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono font-medium">#{a.tokenId.toString()}</span>
                    <span className="text-muted-foreground">
                      verified · {getStateLabel(a.state)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {a.timestamp > 0n
                      ? new Date(Number(a.timestamp) * 1000).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Asset counts, lifecycle states, transitions, and agent reputation are read live from Base.
        Fraud and TAM figures are macro context from the whitepaper; &quot;value secured&quot; is a
        notional model at the per-asset assumption shown above.
      </p>
    </div>
  );
}
