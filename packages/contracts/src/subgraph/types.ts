// Subgraph response types for TAGIT

export interface SubgraphAsset {
  id: string;
  tokenId: string;
  owner: {
    id: string;
    address: string;
  };
  state: number;
  tagId: string | null;
  metadataURI: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubgraphUser {
  id: string;
  address: string;
  totalAssetsOwned: number;
  totalBadges: number;
  totalCapabilities: number;
  firstSeenAt: string;
  lastActiveAt: string;
}

export interface SubgraphStateChange {
  id: string;
  asset: {
    id: string;
    tokenId: string;
  };
  oldState: number;
  newState: number;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface SubgraphTransfer {
  id: string;
  asset: {
    id: string;
    tokenId: string;
  };
  from: {
    id: string;
    address: string;
  };
  to: {
    id: string;
    address: string;
  };
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface SubgraphFlag {
  id: string;
  asset: {
    id: string;
    tokenId: string;
  };
  reporter: {
    id: string;
    address: string;
  };
  reason: string;
  timestamp: string;
  blockNumber: string;
  txHash: string;
  resolved: boolean;
}

export interface SubgraphResolution {
  id: string;
  asset: {
    id: string;
    tokenId: string;
  };
  resolver: {
    id: string;
    address: string;
  };
  resolutionType: number;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface SubgraphGlobalStats {
  id: string;
  totalAssets: string;
  totalUsers: string;
  totalTransfers: string;
  totalFlags: string;
  totalResolutions: string;
  mintedCount: number;
  boundCount: number;
  activatedCount: number;
  claimedCount: number;
  flaggedCount: number;
  recycledCount: number;
  dailyMints: number;
  dailyTransfers: number;
  dailyFlags: number;
  lastUpdated: string;
}

export interface SubgraphDailySnapshot {
  id: string;
  date: string;
  timestamp: string;
  mints: number;
  transfers: number;
  flags: number;
  resolutions: number;
  activeUsers: number;
  totalAssets: string;
  totalUsers: string;
}

// Query response types
export interface GlobalStatsResponse {
  globalStats: SubgraphGlobalStats | null;
}

export interface StateDistributionResponse {
  globalStats: Pick<
    SubgraphGlobalStats,
    | "mintedCount"
    | "boundCount"
    | "activatedCount"
    | "claimedCount"
    | "flaggedCount"
    | "recycledCount"
  > | null;
}

export interface RecentActivityResponse {
  stateChanges: SubgraphStateChange[];
}

export interface RecentTransfersResponse {
  transfers: SubgraphTransfer[];
}

export interface RecentFlagsResponse {
  flags: SubgraphFlag[];
}

export interface TopUsersResponse {
  users: SubgraphUser[];
}

export interface DailySnapshotsResponse {
  dailySnapshots: SubgraphDailySnapshot[];
}

// Parsed/transformed types for UI consumption
export interface DashboardStats {
  totalAssets: number;
  totalUsers: number;
  totalTransfers: number;
  dailyMints: number;
  dailyTransfers: number;
  flaggedCount: number;
}

export interface StateDistribution {
  name: string;
  value: number;
  state: number;
  [key: string]: string | number; // Index signature for recharts compatibility
}

export interface ActivityItem {
  tokenId: string;
  oldState: number;
  newState: number;
  timestamp: number;
  txHash: string;
}

export interface FlagItem {
  tokenId: string;
  reporter: string;
  reason: string;
  timestamp: number;
  txHash: string;
  resolved: boolean;
}

export interface TopUser {
  address: string;
  assetCount: number;
}
