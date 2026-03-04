"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getSubgraphClient } from "./client";
import { hasSubgraphUrl } from "./client";
import {
  fetchRecentEvents,
  fetchAssetStateChanges,
  fetchAssetTransfers,
  createRpcClient,
  resolveEventChainId,
} from "./rpc-fallback";
import { getContractsForChain } from "../addresses";
import {
  GLOBAL_STATS_QUERY,
  STATE_DISTRIBUTION_QUERY,
  RECENT_ACTIVITY_QUERY,
  RECENT_FLAGS_QUERY,
  RECENT_TRANSFERS_QUERY,
  TOP_USERS_BY_ASSETS_QUERY,
  MINTS_TODAY_QUERY,
  ACTIVE_USERS_QUERY,
} from "./queries";
import type {
  GlobalStatsResponse,
  StateDistributionResponse,
  RecentActivityResponse,
  RecentFlagsResponse,
  RecentTransfersResponse,
  TopUsersResponse,
  DashboardStats,
  StateDistribution,
  ActivityItem,
  FlagItem,
  TopUser,
  TransferItem,
  FeedEvent,
  EventSource,
  AssetTimelineEvent,
} from "./types";

// State name mapping
const STATE_NAMES = ["Minted", "Bound", "Activated", "Claimed", "Flagged", "Recycled"];

// Generic hook for subgraph queries with polling support
function useSubgraphQuery<TData, TResult>(
  query: string,
  variables: Record<string, unknown> | undefined,
  transform: (data: TData) => TResult,
  options?: {
    pollingInterval?: number;
    enabled?: boolean;
  }
) {
  const [data, setData] = useState<TResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enabled = options?.enabled ?? true;
  const pollingInterval = options?.pollingInterval;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      const client = getSubgraphClient();
      const result = await client.query<TData>(query, variables);
      setData(transform(result));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [query, variables, transform, enabled]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    // Set up polling if interval is specified
    if (pollingInterval && enabled) {
      intervalRef.current = setInterval(fetchData, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, pollingInterval, enabled]);

  return { data, isLoading, error, refetch };
}

// Hook for global dashboard stats
export function useGlobalStats(options?: { pollingInterval?: number }) {
  return useSubgraphQuery<GlobalStatsResponse, DashboardStats>(
    GLOBAL_STATS_QUERY,
    undefined,
    (data) => {
      const stats = data.globalStats;
      if (!stats) {
        return {
          totalAssets: 0,
          totalUsers: 0,
          totalTransfers: 0,
          dailyMints: 0,
          dailyTransfers: 0,
          flaggedCount: 0,
        };
      }
      return {
        totalAssets: parseInt(stats.totalAssets) || 0,
        totalUsers: parseInt(stats.totalUsers) || 0,
        totalTransfers: parseInt(stats.totalTransfers) || 0,
        dailyMints: stats.dailyMints || 0,
        dailyTransfers: stats.dailyTransfers || 0,
        flaggedCount: stats.flaggedCount || 0,
      };
    },
    options
  );
}

// Hook for asset state distribution (pie chart)
export function useStateDistribution(options?: { pollingInterval?: number }) {
  return useSubgraphQuery<StateDistributionResponse, StateDistribution[]>(
    STATE_DISTRIBUTION_QUERY,
    undefined,
    (data) => {
      const stats = data.globalStats;
      if (!stats) {
        return STATE_NAMES.map((name, state) => ({ name, value: 0, state }));
      }
      return [
        { name: "Minted", value: stats.mintedCount, state: 0 },
        { name: "Bound", value: stats.boundCount, state: 1 },
        { name: "Activated", value: stats.activatedCount, state: 2 },
        { name: "Claimed", value: stats.claimedCount, state: 3 },
        { name: "Flagged", value: stats.flaggedCount, state: 4 },
        { name: "Recycled", value: stats.recycledCount, state: 5 },
      ];
    },
    options
  );
}

// Hook for recent activity feed
export function useRecentActivity(
  limit: number = 10,
  options?: { pollingInterval?: number; enabled?: boolean }
) {
  return useSubgraphQuery<RecentActivityResponse, ActivityItem[]>(
    RECENT_ACTIVITY_QUERY,
    { first: limit, skip: 0 },
    (data) => {
      return data.stateChanges.map((sc) => ({
        tokenId: sc.asset.tokenId,
        oldState: sc.oldState,
        newState: sc.newState,
        timestamp: parseInt(sc.timestamp) * 1000, // Convert to milliseconds
        txHash: sc.txHash,
      }));
    },
    options
  );
}

// Hook for recent transfers (ownership changes)
export function useRecentTransfers(
  limit: number = 10,
  options?: { pollingInterval?: number; enabled?: boolean }
) {
  return useSubgraphQuery<RecentTransfersResponse, TransferItem[]>(
    RECENT_TRANSFERS_QUERY,
    { first: limit, skip: 0 },
    (data) => {
      return data.transfers.map((t) => ({
        tokenId: t.asset.tokenId,
        from: t.from.address,
        to: t.to.address,
        timestamp: parseInt(t.timestamp) * 1000,
        txHash: t.txHash,
      }));
    },
    options
  );
}

// Hook for recent flags
export function useRecentFlags(
  limit: number = 10,
  unresolvedOnly: boolean = false,
  options?: { pollingInterval?: number; enabled?: boolean }
) {
  return useSubgraphQuery<RecentFlagsResponse, FlagItem[]>(
    RECENT_FLAGS_QUERY,
    { first: limit, resolved: unresolvedOnly ? false : undefined },
    (data) => {
      return data.flags.map((flag) => ({
        tokenId: flag.asset.tokenId,
        reporter: flag.reporter.address,
        reason: flag.reason,
        timestamp: parseInt(flag.timestamp) * 1000,
        txHash: flag.txHash,
        resolved: flag.resolved,
      }));
    },
    options
  );
}

// Hook for top users by assets owned
export function useTopUsers(
  limit: number = 10,
  options?: { pollingInterval?: number }
) {
  return useSubgraphQuery<TopUsersResponse, TopUser[]>(
    TOP_USERS_BY_ASSETS_QUERY,
    { first: limit },
    (data) => {
      return data.users.map((user) => ({
        address: user.address,
        assetCount: user.totalAssetsOwned,
      }));
    },
    options
  );
}

// Hook for daily mints count (last 24 hours)
export function useDailyMints(options?: { pollingInterval?: number }) {
  // Calculate timestamp for 24 hours ago
  const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

  return useSubgraphQuery<{ transfers: { id: string }[] }, number>(
    MINTS_TODAY_QUERY,
    { since: since.toString() },
    (data) => data.transfers.length,
    options
  );
}

// Hook for active users in the last 7 days
export function useActiveUsers(options?: { pollingInterval?: number }) {
  // Calculate timestamp for 7 days ago
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  return useSubgraphQuery<{ users: { id: string }[] }, number>(
    ACTIVE_USERS_QUERY,
    { since: since.toString() },
    (data) => data.users.length,
    options
  );
}

// Merge subgraph data into FeedEvent[]
function mergeSubgraphEvents(
  activity: ActivityItem[] | null,
  transfers: TransferItem[] | null,
  flags: FlagItem[] | null,
  limit: number,
): FeedEvent[] {
  const all: FeedEvent[] = [];
  if (activity) {
    for (const a of activity) {
      all.push({ type: "state_change", tokenId: a.tokenId, timestamp: a.timestamp, txHash: a.txHash, data: a });
    }
  }
  if (transfers) {
    for (const t of transfers) {
      all.push({ type: "transfer", tokenId: t.tokenId, timestamp: t.timestamp, txHash: t.txHash, data: t });
    }
  }
  if (flags) {
    for (const f of flags) {
      all.push({ type: "flag", tokenId: f.tokenId, timestamp: f.timestamp, txHash: f.txHash, data: f });
    }
  }
  all.sort((a, b) => b.timestamp - a.timestamp);
  return all.slice(0, limit);
}

/**
 * Unified event feed hook with automatic fallback:
 *  1. If NEXT_PUBLIC_SUBGRAPH_URL is set → subgraph hooks
 *  2. Otherwise → RPC polling via viem getContractEvents
 *  3. If both fail → empty (mock) state
 *
 * Returns `effectiveChainId` so the UI can build correct explorer links
 * (e.g. when connected to Arbitrum but events come from OP Sepolia).
 */
export function useEventFeedWithFallback(
  chainId: number,
  limit: number = 15,
  pollingInterval: number = 5000,
) {
  const subgraphEnabled = hasSubgraphUrl();

  // --- Subgraph path (hooks must be called unconditionally) ---
  const activityHook = useRecentActivity(limit, {
    pollingInterval: 10000,
    enabled: subgraphEnabled,
  });
  const transfersHook = useRecentTransfers(limit, {
    pollingInterval: 10000,
    enabled: subgraphEnabled,
  });
  const flagsHook = useRecentFlags(5, false, {
    pollingInterval: 10000,
    enabled: subgraphEnabled,
  });

  const subgraphLoading = subgraphEnabled && (activityHook.isLoading || transfersHook.isLoading || flagsHook.isLoading);
  const subgraphHasData =
    (activityHook.data?.length ?? 0) > 0 ||
    (transfersHook.data?.length ?? 0) > 0 ||
    (flagsHook.data?.length ?? 0) > 0;

  // --- RPC fallback path ---
  const [rpcEvents, setRpcEvents] = useState<FeedEvent[]>([]);
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcError, setRpcError] = useState<Error | null>(null);
  const [effectiveChainId, setEffectiveChainId] = useState(chainId);
  const rpcEnabled = !subgraphEnabled;

  useEffect(() => {
    if (!rpcEnabled) return;

    let cancelled = false;

    const poll = async () => {
      setRpcLoading(true);
      try {
        const result = await fetchRecentEvents(chainId, limit);
        if (!cancelled) {
          setRpcEvents(result.events);
          setEffectiveChainId(result.effectiveChainId);
          setRpcError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setRpcError(err instanceof Error ? err : new Error("RPC fetch failed"));
        }
      } finally {
        if (!cancelled) setRpcLoading(false);
      }
    };

    poll();
    const id = setInterval(poll, pollingInterval);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [rpcEnabled, chainId, limit, pollingInterval]);

  // --- Pick source ---
  const result = useMemo((): {
    events: FeedEvent[];
    isLoading: boolean;
    error: Error | null;
    source: EventSource;
    effectiveChainId: number;
  } => {
    if (subgraphEnabled && subgraphHasData) {
      return {
        events: mergeSubgraphEvents(activityHook.data, transfersHook.data, flagsHook.data, limit),
        isLoading: false,
        error: null,
        source: "subgraph",
        effectiveChainId: chainId,
      };
    }
    if (subgraphEnabled && subgraphLoading) {
      return { events: [], isLoading: true, error: null, source: "subgraph", effectiveChainId: chainId };
    }
    if (rpcEnabled) {
      return {
        events: rpcEvents,
        isLoading: rpcLoading,
        error: rpcError,
        source: rpcEvents.length > 0 ? "rpc" : "mock",
        effectiveChainId,
      };
    }
    // Subgraph configured but returned no data
    return { events: [], isLoading: false, error: null, source: "mock", effectiveChainId: chainId };
  }, [
    subgraphEnabled, subgraphHasData, subgraphLoading,
    activityHook.data, transfersHook.data, flagsHook.data,
    rpcEnabled, rpcEvents, rpcLoading, rpcError,
    effectiveChainId, chainId, limit,
  ]);

  return result;
}

/**
 * Fetches on-chain state changes and transfers for a single asset.
 * Uses RPC directly (no subgraph required). Sorts oldest-first for timeline display.
 */
export function useAssetHistory(chainId: number, tokenId: bigint) {
  const [stateChanges, setStateChanges] = useState<AssetTimelineEvent[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const effectiveChainId = resolveEventChainId(chainId);
      const client = createRpcClient(effectiveChainId);
      if (!client) {
        setStateChanges([]);
        setTransfers([]);
        return;
      }

      const coreAddr = getContractsForChain(effectiveChainId).TAGITCore;
      const [sc, tx] = await Promise.all([
        fetchAssetStateChanges(client, coreAddr, tokenId),
        fetchAssetTransfers(client, coreAddr, tokenId),
      ]);

      // Sort oldest-first for timeline display
      sc.sort((a, b) => a.timestamp - b.timestamp);
      tx.sort((a, b) => a.timestamp - b.timestamp);

      setStateChanges(sc);
      setTransfers(tx);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch asset history"));
    } finally {
      setIsLoading(false);
    }
  }, [chainId, tokenId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { stateChanges, transfers, isLoading, error, refetch: fetchHistory };
}

// Combined hook for all dashboard data with unified polling
export function useDashboardData(pollingInterval: number = 30000) {
  const globalStats = useGlobalStats({ pollingInterval });
  const stateDistribution = useStateDistribution({ pollingInterval });
  const recentActivity = useRecentActivity(5, { pollingInterval });
  const recentFlags = useRecentFlags(3, true, { pollingInterval });
  const topUsers = useTopUsers(3, { pollingInterval });
  const dailyMints = useDailyMints({ pollingInterval });
  const activeUsers = useActiveUsers({ pollingInterval });

  const isLoading =
    globalStats.isLoading ||
    stateDistribution.isLoading ||
    recentActivity.isLoading;

  const error = globalStats.error || stateDistribution.error || recentActivity.error;

  const refetchAll = useCallback(() => {
    globalStats.refetch();
    stateDistribution.refetch();
    recentActivity.refetch();
    recentFlags.refetch();
    topUsers.refetch();
    dailyMints.refetch();
    activeUsers.refetch();
  }, [
    globalStats,
    stateDistribution,
    recentActivity,
    recentFlags,
    topUsers,
    dailyMints,
    activeUsers,
  ]);

  return {
    globalStats: globalStats.data,
    stateDistribution: stateDistribution.data,
    recentActivity: recentActivity.data,
    recentFlags: recentFlags.data,
    topUsers: topUsers.data,
    dailyMints: dailyMints.data,
    activeUsers: activeUsers.data,
    isLoading,
    error,
    refetch: refetchAll,
  };
}
