"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import {
  useSuspendAgent,
  useReactivateAgent,
  useDecommissionAgent,
  getAgentContractsForChain,
  getExplorerAddressUrl,
} from "@tagit/contracts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  MetricCard,
  AddressBadge,
  cn,
} from "@tagit/ui";
import { ArrowLeft, ExternalLink, Star, Trophy } from "lucide-react";
import { AGENT_STATUS_LABELS, useAgent, useAgentReputation } from "@/lib/agents";
import { REPUTATION_DIMENSIONS, deriveAgentScore } from "@/lib/mesh";
import { ReputationRadar } from "@/components/reputation-radar";
import { TrustTierLadder } from "@/components/trust-tier-ladder";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const agentId = useMemo(() => {
    try {
      return BigInt(params.id);
    } catch {
      return 0n;
    }
  }, [params.id]);

  const { address } = useAccount();
  const chainId = useChainId();
  const { agent, isLoading, refetch } = useAgent(agentId);
  const { summary } = useAgentReputation(agentId);
  const suspendHook = useSuspendAgent();
  const reactivateHook = useReactivateAgent();
  const decommissionHook = useDecommissionAgent();

  useEffect(() => {
    if (suspendHook.isSuccess || reactivateHook.isSuccess || decommissionHook.isSuccess) {
      refetch();
    }
  }, [suspendHook.isSuccess, reactivateHook.isSuccess, decommissionHook.isSuccess, refetch]);

  const isController =
    !!address && !!agent && agent.registrant.toLowerCase() === address.toLowerCase();
  const identityAddress = getAgentContractsForChain(chainId).TAGITAgentIdentity;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-secondary animate-pulse" />
        <div className="h-40 rounded-xl bg-secondary animate-pulse" />
      </div>
    );
  }

  if (!agent || agent.registrant === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Agent #{params.id} not found on Base Sepolia.</p>
        <Button asChild variant="outline">
          <Link href="/agents">Back to agents</Link>
        </Button>
      </div>
    );
  }

  const statusLabel = AGENT_STATUS_LABELS[agent.status] ?? `Unknown (${agent.status})`;
  const avgRating = summary ? Number(summary.averageRating) / 100 : null;
  const score = deriveAgentScore(agentId, summary);
  const anyBusy =
    suspendHook.isPending ||
    suspendHook.isConfirming ||
    reactivateHook.isPending ||
    reactivateHook.isConfirming ||
    decommissionHook.isPending ||
    decommissionHook.isConfirming;
  const actionError = suspendHook.error || reactivateHook.error || decommissionHook.error;

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Agents
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight font-mono">
            Agent #{agentId.toString()}
          </h1>
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-medium",
              agent.status === 1
                ? "bg-green-500/10 text-green-600"
                : agent.status === 2
                  ? "bg-yellow-500/10 text-yellow-600"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
        </div>
        <a
          href={getExplorerAddressUrl(chainId, identityAddress)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          View on BaseScan
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Average rating"
          value={
            avgRating !== null && summary && summary.totalFeedback > 0n ? avgRating.toFixed(2) : "—"
          }
          icon={<Star className="h-5 w-5" />}
        />
        <MetricCard title="Total feedback" value={summary ? Number(summary.totalFeedback) : "—"} />
        <MetricCard
          title="Active feedback"
          value={summary ? Number(summary.activeFeedback) : "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Trust tier
            </CardTitle>
            <CardDescription>
              Current tier <span className="font-medium text-foreground">{score.tier.name}</span> —
              derived from on-chain reputation ({score.deals} deals · score{" "}
              {score.deals > 0 ? score.score.toLocaleString() : "—"}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrustTierLadder current={score.tier.key} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reputation profile</CardTitle>
            <CardDescription>Six scoring dimensions (§5.3).</CardDescription>
          </CardHeader>
          <CardContent>
            {score.deals === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No feedback yet — agent is at Probation until it completes verified deals.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ReputationRadar values={score.dimensions} />
                <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {REPUTATION_DIMENSIONS.map((dim, i) => (
                    <div key={dim} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{dim}</span>
                      <span className="font-medium">{Math.round(score.dimensions[i] * 100)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Overall is the on-chain composite; the other five are modeled from it until
                  per-dimension scoring ships.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Operator (registrant)</span>
              <AddressBadge address={agent.registrant} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Agent wallet</span>
              <AddressBadge address={agent.wallet} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Registered</span>
              <span>
                {agent.registeredAt > 0n
                  ? new Date(Number(agent.registeredAt) * 1000).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Standard</span>
              <span>ERC-8004 (soulbound)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controls</CardTitle>
            <CardDescription>
              {isController
                ? "You operate this agent."
                : "Only the operator can control this agent."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isController ? (
              <p className="text-sm text-muted-foreground py-4">No controls available.</p>
            ) : agent.status === 3 ? (
              <p className="text-sm text-muted-foreground py-4">
                This agent is decommissioned. Decommissioning is permanent.
              </p>
            ) : (
              <>
                {agent.status === 1 ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={anyBusy}
                    onClick={() => suspendHook.suspend(agentId)}
                  >
                    {suspendHook.isPending
                      ? "Confirm in wallet..."
                      : suspendHook.isConfirming
                        ? "Suspending..."
                        : "Pause agent (suspend)"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={anyBusy}
                    onClick={() => reactivateHook.reactivate(agentId)}
                  >
                    {reactivateHook.isPending
                      ? "Confirm in wallet..."
                      : reactivateHook.isConfirming
                        ? "Reactivating..."
                        : "Resume agent (reactivate)"}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={anyBusy}
                  onClick={() => decommissionHook.decommission(agentId)}
                >
                  {decommissionHook.isPending
                    ? "Confirm in wallet..."
                    : decommissionHook.isConfirming
                      ? "Decommissioning..."
                      : "Decommission permanently"}
                </Button>
                {actionError && (
                  <p className="text-sm text-destructive break-all">
                    {actionError.message.split("\n")[0]}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
