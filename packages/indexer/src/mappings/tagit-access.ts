import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  CapabilityGranted as CapabilityGrantedEvent,
  CapabilityRevoked as CapabilityRevokedEvent,
} from "../../generated/TAGITAccess/TAGITAccess";
import { User, CapabilityGrant, GlobalStats } from "../../generated/schema";

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

// Handle CapabilityGranted events
export function handleCapabilityGranted(event: CapabilityGrantedEvent): void {
  let timestamp = event.block.timestamp;
  let userAddress = event.params.user;
  let capability = event.params.capability;
  let granterAddress = event.params.granter;

  // Get or create user
  let user = getOrCreateUser(userAddress, timestamp);
  user.lastActiveAt = timestamp;
  user.totalCapabilities += 1;
  user.save();

  // Get or create granter
  let granter = getOrCreateUser(granterAddress, timestamp);
  granter.lastActiveAt = timestamp;
  granter.save();

  // Create capability grant record
  let grantId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let grant = new CapabilityGrant(grantId);
  grant.user = user.id;
  grant.capability = capability;
  grant.granter = granter.id;
  grant.grantedAt = timestamp;
  grant.revokedAt = null;
  grant.revoker = null;
  grant.active = true;
  grant.blockNumber = event.block.number;
  grant.txHash = event.transaction.hash;
  grant.save();
}

// Handle CapabilityRevoked events
export function handleCapabilityRevoked(event: CapabilityRevokedEvent): void {
  let timestamp = event.block.timestamp;
  let userAddress = event.params.user;
  let capability = event.params.capability;
  let revokerAddress = event.params.revoker;

  // Get or create user
  let user = getOrCreateUser(userAddress, timestamp);
  user.lastActiveAt = timestamp;
  if (user.totalCapabilities > 0) {
    user.totalCapabilities -= 1;
  }
  user.save();

  // Get or create revoker
  let revoker = getOrCreateUser(revokerAddress, timestamp);
  revoker.lastActiveAt = timestamp;
  revoker.save();

  // Create a new revocation record
  // Note: In a more sophisticated implementation, you might want to
  // find and update the original grant record instead
  let revokeId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let grant = new CapabilityGrant(revokeId);
  grant.user = user.id;
  grant.capability = capability;
  grant.granter = null;
  grant.grantedAt = BigInt.fromI32(0);
  grant.revokedAt = timestamp;
  grant.revoker = revoker.id;
  grant.active = false;
  grant.blockNumber = event.block.number;
  grant.txHash = event.transaction.hash;
  grant.save();
}
