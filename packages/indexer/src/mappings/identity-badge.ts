import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  BadgeGranted as BadgeGrantedEvent,
  BadgeRevoked as BadgeRevokedEvent,
} from "../../generated/IdentityBadge/IdentityBadge";
import { User, BadgeGrant, GlobalStats } from "../../generated/schema";

// Helper to get or create User entity
function getOrCreateUser(address: Address, timestamp: BigInt): User {
  let id = address.toHexString().toLowerCase();
  let user = User.load(id);

  if (!user) {
    user = new User(id);
    user.address = address;
    user.totalAssetsOwned = 0;
    user.totalBadges = 0;
    user.totalCapabilities = 0;
    user.firstSeenAt = timestamp;
    user.lastActiveAt = timestamp;
    user.save();

    // Update global stats
    let stats = getOrCreateGlobalStats();
    stats.totalUsers = stats.totalUsers.plus(BigInt.fromI32(1));
    stats.save();
  }

  return user;
}

// Helper to get or create GlobalStats
function getOrCreateGlobalStats(): GlobalStats {
  let stats = GlobalStats.load("global");

  if (!stats) {
    stats = new GlobalStats("global");
    stats.totalAssets = BigInt.fromI32(0);
    stats.totalUsers = BigInt.fromI32(0);
    stats.totalTransfers = BigInt.fromI32(0);
    stats.totalFlags = BigInt.fromI32(0);
    stats.totalResolutions = BigInt.fromI32(0);
    stats.mintedCount = 0;
    stats.boundCount = 0;
    stats.activatedCount = 0;
    stats.claimedCount = 0;
    stats.flaggedCount = 0;
    stats.recycledCount = 0;
    stats.dailyMints = 0;
    stats.dailyTransfers = 0;
    stats.dailyFlags = 0;
    stats.lastUpdated = BigInt.fromI32(0);
    stats.save();
  }

  return stats;
}

// Handle BadgeGranted events
export function handleBadgeGranted(event: BadgeGrantedEvent): void {
  let timestamp = event.block.timestamp;
  let toAddress = event.params.to;
  let badgeId = event.params.badgeId;
  let granterAddress = event.params.granter;

  // Get or create user
  let user = getOrCreateUser(toAddress, timestamp);
  user.lastActiveAt = timestamp;
  user.totalBadges += 1;
  user.save();

  // Get or create granter
  let granter = getOrCreateUser(granterAddress, timestamp);
  granter.lastActiveAt = timestamp;
  granter.save();

  // Create badge grant record
  let grantId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let grant = new BadgeGrant(grantId);
  grant.user = user.id;
  grant.badgeId = badgeId;
  grant.granter = granter.id;
  grant.grantedAt = timestamp;
  grant.revokedAt = null;
  grant.revoker = null;
  grant.active = true;
  grant.blockNumber = event.block.number;
  grant.txHash = event.transaction.hash;
  grant.save();
}

// Handle BadgeRevoked events
export function handleBadgeRevoked(event: BadgeRevokedEvent): void {
  let timestamp = event.block.timestamp;
  let fromAddress = event.params.from;
  let badgeId = event.params.badgeId;
  let revokerAddress = event.params.revoker;

  // Get or create user
  let user = getOrCreateUser(fromAddress, timestamp);
  user.lastActiveAt = timestamp;
  if (user.totalBadges > 0) {
    user.totalBadges -= 1;
  }
  user.save();

  // Get or create revoker
  let revoker = getOrCreateUser(revokerAddress, timestamp);
  revoker.lastActiveAt = timestamp;
  revoker.save();

  // Create a new revocation record
  let revokeId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let grant = new BadgeGrant(revokeId);
  grant.user = user.id;
  grant.badgeId = badgeId;
  grant.granter = null;
  grant.grantedAt = BigInt.fromI32(0);
  grant.revokedAt = timestamp;
  grant.revoker = revoker.id;
  grant.active = false;
  grant.blockNumber = event.block.number;
  grant.txHash = event.transaction.hash;
  grant.save();
}
