"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSubgraphClient, hasSubgraphUrl } from "./client";
import {
  AGENT_STATUS_CHANGES_QUERY,
  AGENT_FEEDBACKS_QUERY,
  AGENT_VALIDATIONS_QUERY,
  REWARD_DISTRIBUTIONS_QUERY,
  WTAG_HOLDERS_QUERY,
  WTAG_TRANSFERS_QUERY,
  PROTOCOL_STATS_QUERY,
} from "./indexer-queries";
import type {
  AgentActivityResponse,
  AgentFeedbackResponse,
  AgentValidationResponse,
  RewardDistributionsResponse,
  WTagHoldersResponse,
  WTagTransfersResponse,
  ProtocolResponse,
  AgentActivityEvent,
  AgentActivityType,
  WTagHolder,
  WTagTransferEvent,
  WTagDistributionSummary,
} from "./indexer-types";

// ─── Helpers ────────────────────────────────────────────────────────────

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Agent Activity Hook ────────────────────────────────────────────────

/**
 * Fetches recent agent activity events from the indexer.
 * Merges status changes, feedbacks, validations, and rewards into
 * a unified timeline sorted by timestamp (newest first).
 */
export function useAgentActivity(
  limit: number = 20,
  pollingInterval: number = 15000,
) {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enabled = hasSubgraphUrl();

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      const client = getSubgraphClient();
      const perType = Math.max(Math.ceil(limit / 4), 5);

      const [statusRes, feedbackRes, validationRes, rewardRes] =
        await Promise.allSettled([
          client.query<AgentActivityResponse>(AGENT_STATUS_CHANGES_QUERY, {
            first: perType,
            skip: 0,
          }),
          client.query<AgentFeedbackResponse>(AGENT_FEEDBACKS_QUERY, {
            first: perType,
            skip: 0,
          }),
          client.query<AgentValidationResponse>(AGENT_VALIDATIONS_QUERY, {
            first: perType,
            skip: 0,
          }),
          client.query<RewardDistributionsResponse>(
            REWARD_DISTRIBUTIONS_QUERY,
            { first: perType, skip: 0 },
          ),
        ]);

      const all: AgentActivityEvent[] = [];

      if (statusRes.status === "fulfilled") {
        for (const sc of statusRes.value.agentStatusChanges) {
          all.push({
            id: sc.id,
            type: "status_change" as AgentActivityType,
            agentAddress: sc.agent.wallet,
            agentId: sc.agent.agentId,
            description: `Agent ${shortenAddr(sc.agent.wallet)} status: ${sc.oldStatusLabel} → ${sc.newStatusLabel}`,
            timestamp: parseInt(sc.timestamp) * 1000,
            txHash: sc.transactionHash,
            blockNumber: sc.blockNumber,
          });
        }
      }

      if (feedbackRes.status === "fulfilled") {
        for (const fb of feedbackRes.value.feedbacks) {
          all.push({
            id: fb.id,
            type: "feedback" as AgentActivityType,
            agentAddress: fb.agent.wallet,
            agentId: fb.agent.agentId,
            description: `Feedback (★${fb.rating}) for agent ${shortenAddr(fb.agent.wallet)}${fb.revoked ? " [revoked]" : ""}`,
            timestamp: parseInt(fb.createdAt) * 1000,
            txHash: fb.id, // feedbacks use composite ID
            blockNumber: fb.createdAtBlock,
          });
        }
      }

      if (validationRes.status === "fulfilled") {
        for (const vr of validationRes.value.validationRequests) {
          const statusText = vr.finalizedAt
            ? vr.passed
              ? "PASSED"
              : "FAILED"
            : "PENDING";
          all.push({
            id: vr.id,
            type: "validation" as AgentActivityType,
            agentAddress: vr.agent.wallet,
            agentId: vr.agent.agentId,
            description: `Validation ${statusText} for agent ${shortenAddr(vr.agent.wallet)} (${vr.responseCount} responses)`,
            timestamp: parseInt(vr.createdAt) * 1000,
            txHash: vr.id,
            blockNumber: vr.createdAtBlock,
          });
        }
      }

      if (rewardRes.status === "fulfilled") {
        for (const rd of rewardRes.value.rewardDistributions) {
          all.push({
            id: rd.id,
            type: "reward" as AgentActivityType,
            agentAddress: rd.recipientAddress,
            agentId: "",
            description: `${rd.triggerTypeLabel} reward to ${shortenAddr(rd.recipientAddress)}`,
            timestamp: parseInt(rd.timestamp) * 1000,
            txHash: rd.transactionHash,
            blockNumber: rd.blockNumber,
          });
        }
      }

      // Sort newest first and trim to limit
      all.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(all.slice(0, limit));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch agent activity"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, limit]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    if (pollingInterval > 0 && enabled) {
      intervalRef.current = setInterval(fetchData, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, pollingInterval, enabled]);

  return { events, isLoading, error, refetch, enabled };
}

// ─── wTAG Distribution Hook ────────────────────────────────────────────

/**
 * Fetches wTAG distribution data:
 *  - Protocol-level supply stats
 *  - Top N holders with balance and share%
 *  - Recent transfers for the sparkline
 */
export function useWTagDistribution(
  topN: number = 10,
  recentTransferCount: number = 20,
  pollingInterval: number = 30000,
) {
  const [data, setData] = useState<WTagDistributionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enabled = hasSubgraphUrl();

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      const client = getSubgraphClient();

      const [protocolRes, holdersRes, transfersRes] = await Promise.allSettled([
        client.query<ProtocolResponse>(PROTOCOL_STATS_QUERY),
        client.query<WTagHoldersResponse>(WTAG_HOLDERS_QUERY, {
          first: topN,
          skip: 0,
          minBalance: "0",
        }),
        client.query<WTagTransfersResponse>(WTAG_TRANSFERS_QUERY, {
          first: recentTransferCount,
          skip: 0,
        }),
      ]);

      const totalSupply =
        protocolRes.status === "fulfilled" && protocolRes.value.protocol
          ? BigInt(protocolRes.value.protocol.wtagTotalSupply)
          : 0n;

      const totalTransfers =
        protocolRes.status === "fulfilled" && protocolRes.value.protocol
          ? protocolRes.value.protocol.wtagTotalTransfers
          : 0;

      const totalBurned =
        protocolRes.status === "fulfilled" && protocolRes.value.protocol
          ? BigInt(protocolRes.value.protocol.wtagTotalBurned)
          : 0n;

      const holders: WTagHolder[] =
        holdersRes.status === "fulfilled"
          ? holdersRes.value.wtagAccounts.map((acc) => {
              const balance = BigInt(acc.balance);
              const sharePercent =
                totalSupply > 0n
                  ? Number((balance * 10000n) / totalSupply) / 100
                  : 0;
              return {
                address: acc.address,
                balance,
                transfersSent: acc.transfersSent,
                transfersReceived: acc.transfersReceived,
                sharePercent,
              };
            })
          : [];

      const recentTransfers: WTagTransferEvent[] =
        transfersRes.status === "fulfilled"
          ? transfersRes.value.wtagTransfers.map((t) => ({
              id: t.id,
              from: t.from.address,
              to: t.to.address,
              value: BigInt(t.value),
              timestamp: parseInt(t.timestamp) * 1000,
              txHash: t.transactionHash,
            }))
          : [];

      setData({
        totalSupply,
        totalTransfers,
        totalBurned,
        holders,
        recentTransfers,
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch wTAG distribution"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, topN, recentTransferCount]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    if (pollingInterval > 0 && enabled) {
      intervalRef.current = setInterval(fetchData, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, pollingInterval, enabled]);

  return { data, isLoading, error, refetch, enabled };
}
