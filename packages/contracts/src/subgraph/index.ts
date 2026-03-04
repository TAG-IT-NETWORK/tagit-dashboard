// Subgraph exports
export { SubgraphClient, getSubgraphClient, isSubgraphAvailable, hasSubgraphUrl } from "./client";
export type { SubgraphClientConfig } from "./client";

export {
  GLOBAL_STATS_QUERY,
  STATE_DISTRIBUTION_QUERY,
  RECENT_ACTIVITY_QUERY,
  RECENT_TRANSFERS_QUERY,
  RECENT_FLAGS_QUERY,
  TOP_USERS_BY_ASSETS_QUERY,
  ACTIVE_USERS_QUERY,
  DAILY_SNAPSHOTS_QUERY,
  MINTS_TODAY_QUERY,
  ASSET_HISTORY_QUERY,
  USER_ACTIVITY_QUERY,
} from "./queries";

export {
  useGlobalStats,
  useStateDistribution,
  useRecentActivity,
  useRecentTransfers,
  useRecentFlags,
  useTopUsers,
  useDailyMints,
  useActiveUsers,
  useDashboardData,
  useEventFeedWithFallback,
  useAssetHistory,
} from "./hooks";

export {
  createRpcClient,
  fetchRecentEvents,
  fetchAssetStateChanges,
  fetchAssetTransfers,
  resolveEventChainId,
} from "./rpc-fallback";

export type {
  SubgraphAsset,
  SubgraphUser,
  SubgraphStateChange,
  SubgraphTransfer,
  SubgraphFlag,
  SubgraphResolution,
  SubgraphGlobalStats,
  SubgraphDailySnapshot,
  GlobalStatsResponse,
  StateDistributionResponse,
  RecentActivityResponse,
  RecentTransfersResponse,
  RecentFlagsResponse,
  TopUsersResponse,
  DailySnapshotsResponse,
  DashboardStats,
  StateDistribution,
  ActivityItem,
  FlagItem,
  TopUser,
  TransferItem,
  FeedEvent,
  AssetTimelineEvent,
  FeedEventType,
  EventSource,
} from "./types";
