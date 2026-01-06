// Subgraph exports
export { SubgraphClient, getSubgraphClient, isSubgraphAvailable } from "./client";
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
  useRecentFlags,
  useTopUsers,
  useDailyMints,
  useActiveUsers,
  useDashboardData,
} from "./hooks";

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
} from "./types";
