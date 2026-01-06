"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSubgraphClient } from "./client";
import {
  GLOBAL_STATS_QUERY,
  STATE_DISTRIBUTION_QUERY,
  RECENT_ACTIVITY_QUERY,
  RECENT_FLAGS_QUERY,
  TOP_USERS_BY_ASSETS_QUERY,
  MINTS_TODAY_QUERY,
  ACTIVE_USERS_QUERY,
} from "./queries";
import type {
  GlobalStatsResponse,
  StateDistributionResponse,
  RecentActivityResponse,
  RecentFlagsResponse,
  TopUsersResponse,
  DashboardStats,
  StateDistribution,
  ActivityItem,
  FlagItem,
  TopUser,
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
  options?: { pollingInterval?: number }
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

// Hook for recent flags
export function useRecentFlags(
  limit: number = 10,
  unresolvedOnly: boolean = false,
  options?: { pollingInterval?: number }
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
