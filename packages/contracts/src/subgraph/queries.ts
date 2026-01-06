// GraphQL queries for TAGIT subgraph

export const GLOBAL_STATS_QUERY = `
  query GlobalStats {
    globalStats(id: "global") {
      id
      totalAssets
      totalUsers
      totalTransfers
      totalFlags
      totalResolutions
      mintedCount
      boundCount
      activatedCount
      claimedCount
      flaggedCount
      recycledCount
      dailyMints
      dailyTransfers
      dailyFlags
      lastUpdated
    }
  }
`;

export const STATE_DISTRIBUTION_QUERY = `
  query StateDistribution {
    globalStats(id: "global") {
      mintedCount
      boundCount
      activatedCount
      claimedCount
      flaggedCount
      recycledCount
    }
  }
`;

export const RECENT_ACTIVITY_QUERY = `
  query RecentActivity($first: Int!, $skip: Int!) {
    stateChanges(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      asset {
        id
        tokenId
      }
      oldState
      newState
      timestamp
      blockNumber
      txHash
    }
  }
`;

export const RECENT_TRANSFERS_QUERY = `
  query RecentTransfers($first: Int!, $skip: Int!) {
    transfers(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      asset {
        id
        tokenId
      }
      from {
        id
        address
      }
      to {
        id
        address
      }
      timestamp
      blockNumber
      txHash
    }
  }
`;

export const RECENT_FLAGS_QUERY = `
  query RecentFlags($first: Int!, $resolved: Boolean) {
    flags(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { resolved: $resolved }
    ) {
      id
      asset {
        id
        tokenId
      }
      reporter {
        id
        address
      }
      reason
      timestamp
      blockNumber
      txHash
      resolved
    }
  }
`;

export const TOP_USERS_BY_ASSETS_QUERY = `
  query TopUsersByAssets($first: Int!) {
    users(
      first: $first
      orderBy: totalAssetsOwned
      orderDirection: desc
      where: { totalAssetsOwned_gt: 0 }
    ) {
      id
      address
      totalAssetsOwned
      totalBadges
      totalCapabilities
      firstSeenAt
      lastActiveAt
    }
  }
`;

export const ACTIVE_USERS_QUERY = `
  query ActiveUsers($since: BigInt!) {
    users(
      first: 1000
      where: { lastActiveAt_gte: $since }
    ) {
      id
    }
  }
`;

export const DAILY_SNAPSHOTS_QUERY = `
  query DailySnapshots($first: Int!) {
    dailySnapshots(
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      date
      timestamp
      mints
      transfers
      flags
      resolutions
      activeUsers
      totalAssets
      totalUsers
    }
  }
`;

export const MINTS_TODAY_QUERY = `
  query MintsToday($since: BigInt!) {
    transfers(
      first: 1000
      where: {
        from: "0x0000000000000000000000000000000000000000"
        timestamp_gte: $since
      }
    ) {
      id
    }
  }
`;

export const ASSET_HISTORY_QUERY = `
  query AssetHistory($assetId: String!) {
    stateChanges(
      where: { asset: $assetId }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      oldState
      newState
      timestamp
      blockNumber
      txHash
    }
    transfers(
      where: { asset: $assetId }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      from {
        id
        address
      }
      to {
        id
        address
      }
      timestamp
      blockNumber
      txHash
    }
    flags(
      where: { asset: $assetId }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      reporter {
        id
        address
      }
      reason
      timestamp
      resolved
      txHash
    }
  }
`;

export const USER_ACTIVITY_QUERY = `
  query UserActivity($userId: String!) {
    user(id: $userId) {
      id
      address
      totalAssetsOwned
      totalBadges
      totalCapabilities
      firstSeenAt
      lastActiveAt
      ownedAssets {
        id
        tokenId
        state
      }
      flagsReported {
        id
        asset {
          tokenId
        }
        reason
        timestamp
        resolved
      }
      resolutionsMade {
        id
        asset {
          tokenId
        }
        resolutionType
        timestamp
      }
    }
  }
`;
