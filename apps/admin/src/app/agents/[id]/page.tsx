"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { usePublicClient, useChainId, useAccount } from "wagmi";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
  Button,
  AddressBadge,
} from "@tagit/ui";
import { AgentReputationTab } from "@/components/agents/agent-reputation-tab";
import { AgentValidationTab } from "@/components/agents/agent-validation-tab";
import { AgentAdminTab } from "@/components/agents/agent-admin-tab";
import { AgentA2ATab } from "@/components/agents/agent-a2a-tab";
import {
  getAgentContractsForChain,
  TAGITAgentIdentityABI,
  TAGITAgentReputationABI,
  TAGITAgentValidationABI,
  AgentStatus,
  AgentStatusNames,
} from "@tagit/contracts";
import {
  Bot,
  Star,
  ShieldCheck,
  Settings,
  MessageSquare,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Calendar,
  Wallet,
  Link as LinkIcon,
  User,
} from "lucide-react";

// ── Types ──

interface AgentIdentityData {
  registrant: `0x${string}`;
  wallet: `0x${string}`;
  registeredAt: number;
  active: boolean;
}

interface AgentReputationData {
  totalFeedback: number;
  activeFeedback: number;
  averageRating: number;
  weightedScore: number;
  lastFeedbackAt: number;
}

interface AgentValidationData {
  isValidated: boolean;
  latestScore: number;
  lastValidatedAt: number;
}

interface AgentDetailData {
  id: number;
  identity: AgentIdentityData;
  status: number;
  uri: string;
  reputation: AgentReputationData;
  validation: AgentValidationData;
}

// ── Helpers ──

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400" },
  1: { label: "Active", color: "bg-green-500/20 text-green-400" },
  2: { label: "Suspended", color: "bg-red-500/20 text-red-400" },
  3: { label: "Decommissioned", color: "bg-gray-500/20 text-gray-400" },
};

function agentNameFromURI(uri: string, id: number): string {
  if (uri.includes("sage")) return "SAGE";
  if (uri.includes("verification")) return "Verification";
  if (uri.includes("anomaly")) return "Anomaly";
  if (uri.includes("recovery")) return "Recovery";
  if (uri.includes("external")) return "External Test";
  return `Agent #${id}`;
}

function agentRoleFromURI(uri: string): string {
  if (uri.includes("sage")) return "Notion Architect";
  if (uri.includes("verification")) return "Physical Commerce";
  if (uri.includes("anomaly")) return "Fraud Detection";
  if (uri.includes("recovery")) return "Asset Recovery";
  if (uri.includes("external")) return "Third-Party";
  return "Unspecified";
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Tab definitions ──

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const BASE_TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: <Bot className="h-4 w-4" /> },
  { id: "reputation", label: "Reputation", icon: <Star className="h-4 w-4" /> },
  { id: "validation", label: "Validation", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "a2a", label: "A2A Test", icon: <MessageSquare className="h-4 w-4" /> },
];

const ADMIN_TAB: Tab = {
  id: "admin",
  label: "Admin",
  icon: <Settings className="h-4 w-4" />,
};

// ── Overview Tab ──

interface OverviewTabProps {
  agent: AgentDetailData;
  chainId: number;
}

function OverviewTab({ agent, chainId }: OverviewTabProps) {
  const { identity, reputation, validation, uri } = agent;
  const rating = reputation.averageRating / 100;

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <User className="h-3 w-3" /> Registrant
              </p>
              <AddressBadge address={identity.registrant} chainId={chainId} truncate />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Agent Wallet
              </p>
              <AddressBadge address={identity.wallet} chainId={chainId} truncate />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Registered
              </p>
              <p className="text-sm">{formatDate(identity.registeredAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> Agent URI
              </p>
              {uri ? (
                <a
                  href={uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline break-all"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {uri}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reputation summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Reputation Summary
          </CardTitle>
          <CardDescription>Aggregated feedback from on-chain interactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{rating > 0 ? rating.toFixed(1) : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Rating</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{reputation.totalFeedback}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Feedback</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">
                {reputation.weightedScore > 0 ? (reputation.weightedScore / 100).toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Weighted Score</p>
            </div>
          </div>
          {reputation.lastFeedbackAt > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Last feedback: {formatDate(reputation.lastFeedbackAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Validation summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Validation Summary
          </CardTitle>
          <CardDescription>Oracle-based capability and behavior validation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Validation Status</p>
              {validation.lastValidatedAt > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last validated: {formatDate(validation.lastValidatedAt)}
                </p>
              )}
            </div>
            {validation.isValidated ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div className="text-right">
                  <p className="text-sm font-medium text-green-500">Validated</p>
                  <p className="text-xs text-muted-foreground">Score: {validation.latestScore}%</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Not validated</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Back link */}
      <div className="pt-2">
        <Link
          href="/agents"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all agents
        </Link>
      </div>
    </div>
  );
}

// ── Placeholder Tab ──

function _PlaceholderTab({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground text-sm">{label} — Coming soon</p>
      </CardContent>
    </Card>
  );
}

// ── Page ──

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = Number(params.id);

  const chainId = useChainId();
  const client = usePublicClient();
  const { address: connectedWallet } = useAccount();

  const [agent, setAgent] = useState<AgentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  const fetchAgent = useCallback(async () => {
    if (!client || isNaN(agentId) || agentId < 1) {
      setError("Invalid agent ID or no provider available");
      setLoading(false);
      return;
    }

    let contracts;
    try {
      contracts = getAgentContractsForChain(chainId);
    } catch {
      setError(`No agent contracts configured for chain ${chainId}`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const id = BigInt(agentId);

      const [identity, status, uri, repSummary, valStatus] = await Promise.all([
        client.readContract({
          address: contracts.TAGITAgentIdentity,
          abi: TAGITAgentIdentityABI,
          functionName: "getAgent",
          args: [id],
        }),
        client.readContract({
          address: contracts.TAGITAgentIdentity,
          abi: TAGITAgentIdentityABI,
          functionName: "getAgentStatus",
          args: [id],
        }),
        client
          .readContract({
            address: contracts.TAGITAgentIdentity,
            abi: TAGITAgentIdentityABI,
            functionName: "tokenURI",
            args: [id],
          })
          .catch(() => ""),
        client
          .readContract({
            address: contracts.TAGITAgentReputation,
            abi: TAGITAgentReputationABI,
            functionName: "getSummary",
            args: [id],
          })
          .catch(() => ({
            totalFeedback: 0n,
            activeFeedback: 0n,
            averageRating: 0n,
            weightedScore: 0n,
            lastFeedbackAt: 0n,
          })),
        client
          .readContract({
            address: contracts.TAGITAgentValidation,
            abi: TAGITAgentValidationABI,
            functionName: "getValidationStatus",
            args: [id],
          })
          .catch(() => [false, 0n, 0n] as const),
      ]);

      const identityTuple = identity as readonly [`0x${string}`, `0x${string}`, bigint, boolean];

      setAgent({
        id: agentId,
        identity: {
          registrant: identityTuple[0],
          wallet: identityTuple[1],
          registeredAt: Number(identityTuple[2]),
          active: identityTuple[3],
        },
        status: Number(status),
        uri: uri as string,
        reputation: {
          totalFeedback: Number((repSummary as any).totalFeedback ?? 0n),
          activeFeedback: Number((repSummary as any).activeFeedback ?? 0n),
          averageRating: Number((repSummary as any).averageRating ?? 0n),
          weightedScore: Number((repSummary as any).weightedScore ?? 0n),
          lastFeedbackAt: Number((repSummary as any).lastFeedbackAt ?? 0n),
        },
        validation: {
          isValidated: (valStatus as any)[0] ?? false,
          latestScore: Number((valStatus as any)[1] ?? 0n),
          lastValidatedAt: Number((valStatus as any)[2] ?? 0n),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agent data");
    } finally {
      setLoading(false);
    }
  }, [client, chainId, agentId]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  // Determine if the connected wallet is registrant or agent wallet (show admin tab)
  const isAdminEligible =
    agent &&
    connectedWallet &&
    (connectedWallet.toLowerCase() === agent.identity.registrant.toLowerCase() ||
      connectedWallet.toLowerCase() === agent.identity.wallet.toLowerCase());

  const tabs: Tab[] = isAdminEligible ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──
  if (error || !agent) {
    return (
      <div className="space-y-4">
        <Link
          href="/agents"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all agents
        </Link>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error ?? "Agent not found"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = agentNameFromURI(agent.uri, agent.id);
  const role = agentRoleFromURI(agent.uri);
  const statusInfo = STATUS_LABELS[agent.status] ?? STATUS_LABELS[0];

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href="/agents"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All agents
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{name}</h1>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
              <span className="text-xs text-muted-foreground font-mono">#{agent.id}</span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{role}</p>
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1">
          <div>
            <p className="text-xs text-muted-foreground">Registrant</p>
            <AddressBadge address={agent.identity.registrant} chainId={chainId} truncate />
          </div>
          <p className="text-xs text-muted-foreground">
            Registered {formatDate(agent.identity.registeredAt)}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary font-medium px-4 py-2 text-sm flex items-center gap-1.5"
                : "text-muted-foreground px-4 py-2 text-sm hover:text-foreground flex items-center gap-1.5"
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && <OverviewTab agent={agent} chainId={chainId} />}
        {activeTab === "reputation" && agent && (
          <AgentReputationTab agentId={agent.id} registrant={agent.identity.registrant} />
        )}
        {activeTab === "validation" && agent && <AgentValidationTab agentId={agent.id} />}
        {activeTab === "a2a" && agent && <AgentA2ATab agentId={agent.id} agentUri={agent.uri} />}
        {activeTab === "admin" && agent && (
          <AgentAdminTab
            agentId={agent.id}
            registrant={agent.identity.registrant}
            currentStatus={agent.status}
          />
        )}
      </div>
    </div>
  );
}
