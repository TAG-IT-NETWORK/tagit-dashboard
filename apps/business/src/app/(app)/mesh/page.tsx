"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReadContracts, useChainId } from "wagmi";
import { TAGITAgentReputationABI, getAgentContractsForChain } from "@tagit/contracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  MetricCard,
  cn,
} from "@tagit/ui";
import { Bot, Network, ShieldCheck, Trophy } from "lucide-react";
import { useAgentList, type ReputationSummary } from "@/lib/agents";
import { MESH_CATEGORIES, TRUST_TIERS, deriveAgentScore, type LiveAgentRef } from "@/lib/mesh";
import { AgentMesh } from "@/components/agent-mesh";

export default function MeshPage() {
  const chainId = useChainId();
  const { agents, totalAgents, isLoading } = useAgentList({ refetchInterval: 20_000 });
  const agentContracts = getAgentContractsForChain(chainId);

  // Batch-read reputation summaries for every registered agent.
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

  const scored = useMemo(
    () =>
      agents.map((a, i) => {
        const summary =
          repData?.[i]?.status === "success" ? (repData[i].result as ReputationSummary) : undefined;
        return { agent: a, score: deriveAgentScore(a.agentId, summary) };
      }),
    [agents, repData],
  );

  const liveAgents: LiveAgentRef[] = useMemo(
    () =>
      scored.map(({ agent, score }) => ({
        agentId: agent.agentId,
        active: agent.active,
        tierDot: score.tier.dot,
      })),
    [scored],
  );

  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of TRUST_TIERS) counts.set(t.key, 0);
    for (const s of scored) counts.set(s.score.tier.key, (counts.get(s.score.tier.key) ?? 0) + 1);
    return counts;
  }, [scored]);

  const topAgents = useMemo(
    () => [...scored].sort((a, b) => b.score.score - a.score.score).slice(0, 5),
    [scored],
  );

  const activeCount = agents.filter((a) => a.active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Network className="h-6 w-6" />
          Agent Mesh
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The hub-and-spoke mesh of autonomous agents around the Orchestrator, with the on-chain
          trust economy that governs what every agent can do.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="Registered agents"
          value={totalAgents}
          loading={isLoading}
          icon={<Bot className="h-5 w-5" />}
        />
        <MetricCard
          title="Active"
          value={activeCount}
          loading={isLoading}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <MetricCard
          title="Agent roles"
          value={MESH_CATEGORIES.reduce((n, c) => n + c.agents.length, 0) + 1}
          icon={<Network className="h-5 w-5" />}
        />
        <MetricCard
          title="Trust tiers"
          value={TRUST_TIERS.length}
          icon={<Trophy className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mesh topology</CardTitle>
          <CardDescription>
            Every agent is sovereign in its domain; only the Orchestrator writes final lifecycle
            state. Your registered agents sit on the inner ring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentMesh liveAgents={liveAgents} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trust economy: tier distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trust economy</CardTitle>
            <CardDescription>
              Where your agents sit on the trust ladder. Tier is derived from on-chain reputation.
            </CardDescription>
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
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top agents by reputation</CardTitle>
            <CardDescription>Composite trust score across the registry.</CardDescription>
          </CardHeader>
          <CardContent>
            {topAgents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No registered agents yet.
              </p>
            ) : (
              <div className="divide-y">
                {topAgents.map(({ agent, score }, i) => (
                  <Link
                    key={agent.agentId.toString()}
                    href={`/agents/${agent.agentId.toString()}`}
                    className="flex items-center justify-between py-2.5 text-sm hover:bg-secondary/40 -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-4 text-center font-mono text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-medium">#{agent.agentId.toString()}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          score.tier.color,
                        )}
                      >
                        {score.tier.name}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {score.deals > 0 ? score.score.toLocaleString() : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Identity, status, and reputation summaries are read live from Base. Trust tiers and the six
        scoring dimensions are derived from the on-chain composite; per-dimension scoring and
        on-chain tier gating ship in the reputation phase of the roadmap.
      </p>
    </div>
  );
}
