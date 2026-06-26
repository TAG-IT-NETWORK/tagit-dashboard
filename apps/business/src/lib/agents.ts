"use client";

import { useChainId, useReadContract, useReadContracts } from "wagmi";
import {
  TAGITAgentIdentityABI,
  TAGITAgentReputationABI,
  getAgentContractsForChain,
} from "@tagit/contracts";

export const AGENT_STATUS_LABELS: Record<number, string> = {
  0: "Inactive",
  1: "Active",
  2: "Suspended",
  3: "Decommissioned",
};

export interface AgentRecord {
  agentId: bigint;
  registrant: `0x${string}`;
  wallet: `0x${string}`;
  registeredAt: bigint;
  active: boolean;
  status: number;
}

export function useTotalAgents() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  return useReadContract({
    address: contracts.TAGITAgentIdentity,
    abi: TAGITAgentIdentityABI,
    functionName: "totalAgents",
    chainId,
  });
}

export function useRegistrationFee() {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  return useReadContract({
    address: contracts.TAGITAgentIdentity,
    abi: TAGITAgentIdentityABI,
    functionName: "registrationFee",
    chainId,
  });
}

/** Batch-read all registered agents (ids start at 1). */
export function useAgentList(options?: { refetchInterval?: number }) {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);
  const refetchInterval = options?.refetchInterval ?? 0;

  const {
    data: totalAgents,
    isLoading: totalLoading,
    error: totalError,
  } = useReadContract({
    address: contracts.TAGITAgentIdentity,
    abi: TAGITAgentIdentityABI,
    functionName: "totalAgents",
    chainId,
    query: { refetchInterval: refetchInterval > 0 ? refetchInterval : undefined },
  });

  const total = totalAgents ? Number(totalAgents) : 0;

  const calls =
    total > 0
      ? Array.from({ length: total }, (_, i) => i + 1).flatMap((id) => [
          {
            address: contracts.TAGITAgentIdentity,
            abi: TAGITAgentIdentityABI,
            functionName: "getAgent" as const,
            args: [BigInt(id)],
            chainId,
          },
          {
            address: contracts.TAGITAgentIdentity,
            abi: TAGITAgentIdentityABI,
            functionName: "getAgentStatus" as const,
            args: [BigInt(id)],
            chainId,
          },
        ])
      : [];

  const {
    data,
    isLoading: agentsLoading,
    error: agentsError,
    refetch,
  } = useReadContracts({
    contracts: calls,
    query: {
      enabled: total > 0 && !totalLoading,
      refetchInterval: refetchInterval > 0 ? refetchInterval : undefined,
    },
  });

  const agents: AgentRecord[] = [];
  if (data) {
    for (let i = 0; i < total; i++) {
      const agentResult = data[i * 2];
      const statusResult = data[i * 2 + 1];
      if (agentResult?.status !== "success" || !agentResult.result) continue;
      const [registrant, wallet, registeredAt, active] = agentResult.result as readonly [
        `0x${string}`,
        `0x${string}`,
        bigint,
        boolean,
      ];
      agents.push({
        agentId: BigInt(i + 1),
        registrant,
        wallet,
        registeredAt: BigInt(registeredAt),
        active,
        status: statusResult?.status === "success" ? Number(statusResult.result) : active ? 1 : 0,
      });
    }
  }

  return {
    agents,
    totalAgents: total,
    isLoading: totalLoading || agentsLoading,
    error: totalError || agentsError,
    refetch,
  };
}

/** Single agent record + status. */
export function useAgent(agentId: bigint) {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: contracts.TAGITAgentIdentity,
        abi: TAGITAgentIdentityABI,
        functionName: "getAgent" as const,
        args: [agentId],
        chainId,
      },
      {
        address: contracts.TAGITAgentIdentity,
        abi: TAGITAgentIdentityABI,
        functionName: "getAgentStatus" as const,
        args: [agentId],
        chainId,
      },
    ],
    query: { enabled: agentId > 0n },
  });

  let agent: AgentRecord | null = null;
  const agentResult = data?.[0];
  if (agentResult?.status === "success" && agentResult.result) {
    const [registrant, wallet, registeredAt, active] = agentResult.result as readonly [
      `0x${string}`,
      `0x${string}`,
      bigint,
      boolean,
    ];
    agent = {
      agentId,
      registrant,
      wallet,
      registeredAt: BigInt(registeredAt),
      active,
      status: data?.[1]?.status === "success" ? Number(data[1].result) : active ? 1 : 0,
    };
  }

  return { agent, isLoading, error, refetch };
}

export interface ReputationSummary {
  totalFeedback: bigint;
  activeFeedback: bigint;
  averageRating: bigint;
  weightedScore: bigint;
  lastFeedbackAt: bigint;
}

export function useAgentReputation(agentId: bigint) {
  const chainId = useChainId();
  const contracts = getAgentContractsForChain(chainId);

  const { data, isLoading, error } = useReadContract({
    address: contracts.TAGITAgentReputation,
    abi: TAGITAgentReputationABI,
    functionName: "getSummary",
    args: [agentId],
    chainId,
    query: { enabled: agentId > 0n },
  });

  return { summary: data as ReputationSummary | undefined, isLoading, error };
}
