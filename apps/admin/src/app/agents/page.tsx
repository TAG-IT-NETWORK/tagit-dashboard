"use client";

import { useState, useEffect, useCallback } from "react";
import { usePublicClient, useChainId } from "wagmi";
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
import { getContractsForChain } from "@tagit/contracts";
import {
  Bot,
  Star,
  ShieldCheck,
  Activity,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

// ── ABIs (minimal view functions only) ──

const IDENTITY_ABI = [
  {
    name: "totalAgents",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "registrant", type: "address" },
      { name: "wallet", type: "address" },
      { name: "registeredAt", type: "uint64" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "getAgentStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const REPUTATION_ABI = [
  {
    name: "getSummary",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "summary",
        type: "tuple",
        components: [
          { name: "totalFeedback", type: "uint256" },
          { name: "activeFeedback", type: "uint256" },
          { name: "averageRating", type: "uint256" },
          { name: "weightedScore", type: "uint256" },
          { name: "lastFeedbackAt", type: "uint64" },
        ],
      },
    ],
  },
] as const;

const VALIDATION_ABI = [
  {
    name: "getValidationStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "isValidated", type: "bool" },
      { name: "latestScore", type: "uint256" },
      { name: "lastValidatedAt", type: "uint64" },
    ],
  },
] as const;

// ── Agent contract addresses by chain ──

const AGENT_CONTRACTS: Record<
  number,
  { identity: `0x${string}`; reputation: `0x${string}`; validation: `0x${string}` }
> = {
  84532: {
    identity: "0x0611FE60f6E37230bDaf04c5F2Ac2dc9012130a9",
    reputation: "0x32be6C82A57d5bCe897538d7dA4109eA0eeB0aA1",
    validation: "0x34766dBa7040C2c8817f1Ee1e448209826DD607e",
  },
  11155420: {
    identity: "0xA7f34FD595eBc397Fe04DcE012dbcf0fbbD2A78D",
    reputation: "0x57CCa1974DFE29593FBD24fdAEE1cD614Bfd6E4a",
    validation: "0x9806919185F98Bd07a64F7BC7F264e91939e86b7",
  },
  421614: {
    identity: "0x5F5F71653d4929c6cD06EF8B16828b084BDf737c",
    reputation: "0x6792EC172F57e124923FC10486cA47341F351D3c",
    validation: "0xbD7ac881567993DFBC56Bf7a7D76db083f04425c",
  },
};

// ── Status labels ──

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400" },
  1: { label: "Active", color: "bg-green-500/20 text-green-400" },
  2: { label: "Suspended", color: "bg-red-500/20 text-red-400" },
  3: { label: "Decommissioned", color: "bg-gray-500/20 text-gray-400" },
};

// ── Types ──

interface AgentData {
  id: number;
  registrant: string;
  wallet: string;
  registeredAt: number;
  active: boolean;
  status: number;
  uri: string;
  reputation: {
    totalFeedback: number;
    activeFeedback: number;
    averageRating: number;
    weightedScore: number;
    lastFeedbackAt: number;
  };
  validation: {
    isValidated: boolean;
    latestScore: number;
    lastValidatedAt: number;
  };
}

// ── Derive name from URI ──

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

// ── Page ──

export default function AgentsPage() {
  const chainId = useChainId();
  const client = usePublicClient();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contracts = AGENT_CONTRACTS[chainId];

  const fetchAgents = useCallback(async () => {
    if (!client || !contracts) {
      setError(`No agent contracts configured for chain ${chainId}`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const total = await client.readContract({
        address: contracts.identity,
        abi: IDENTITY_ABI,
        functionName: "totalAgents",
      });

      const count = Number(total);
      const agentList: AgentData[] = [];

      for (let i = 1; i <= count; i++) {
        const [identity, status, uri, repSummary, valStatus] = await Promise.all([
          client.readContract({
            address: contracts.identity,
            abi: IDENTITY_ABI,
            functionName: "getAgent",
            args: [BigInt(i)],
          }),
          client.readContract({
            address: contracts.identity,
            abi: IDENTITY_ABI,
            functionName: "getAgentStatus",
            args: [BigInt(i)],
          }),
          client
            .readContract({
              address: contracts.identity,
              abi: IDENTITY_ABI,
              functionName: "tokenURI",
              args: [BigInt(i)],
            })
            .catch(() => ""),
          client
            .readContract({
              address: contracts.reputation,
              abi: REPUTATION_ABI,
              functionName: "getSummary",
              args: [BigInt(i)],
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
              address: contracts.validation,
              abi: VALIDATION_ABI,
              functionName: "getValidationStatus",
              args: [BigInt(i)],
            })
            .catch(() => [false, 0n, 0n] as const),
        ]);

        agentList.push({
          id: i,
          registrant: identity[0],
          wallet: identity[1],
          registeredAt: Number(identity[2]),
          active: identity[3],
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
      }

      setAgents(agentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [client, contracts, chainId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agents</h1>
          <p className="text-muted-foreground">
            On-chain registered agents with identity, reputation, and validation
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-mono">
            {agents.length} agents
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchAgents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Agent Grid */}
      {!loading && agents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const name = agentNameFromURI(agent.uri, agent.id);
            const role = agentRoleFromURI(agent.uri);
            const statusInfo = STATUS_LABELS[agent.status] ?? STATUS_LABELS[0];
            const rating = agent.reputation.averageRating / 100;
            const registered = new Date(agent.registeredAt * 1000);

            return (
              <Card key={agent.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{name}</CardTitle>
                        <CardDescription>{role}</CardDescription>
                      </div>
                    </div>
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Identity */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Agent ID</p>
                      <p className="font-mono font-bold">#{agent.id}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Registered</p>
                      <p className="text-xs">{registered.toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Wallet */}
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Wallet</p>
                    <AddressBadge address={agent.wallet} chainId={chainId} truncate />
                  </div>

                  {/* Reputation */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Star className="h-3 w-3" />
                      Reputation
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{rating > 0 ? rating.toFixed(1) : "--"}</p>
                        <p className="text-xs text-muted-foreground">Rating</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{agent.reputation.totalFeedback}</p>
                        <p className="text-xs text-muted-foreground">Reviews</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">
                          {agent.reputation.weightedScore > 0
                            ? (agent.reputation.weightedScore / 100).toFixed(1)
                            : "--"}
                        </p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>
                  </div>

                  {/* Validation */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />
                      Validation
                    </div>
                    {agent.validation.isValidated ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-500 font-medium">
                          Validated ({agent.validation.latestScore}%)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Not validated</span>
                      </div>
                    )}
                  </div>

                  {/* A2A Link */}
                  {agent.uri && (
                    <a
                      href={agent.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {agent.uri}
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* A2A Gateway Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            A2A Gateway
          </CardTitle>
          <CardDescription>
            External agents can discover and communicate with TAG IT agents via the A2A protocol
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Agent Card (Public)</p>
              <code className="text-xs break-all">
                https://api.tagit.network/.well-known/agent.json
              </code>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">A2A Endpoint (Auth Required)</p>
              <code className="text-xs break-all">POST https://api.tagit.network/a2a</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
