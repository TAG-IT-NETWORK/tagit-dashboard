import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  Transfer as TransferEvent,
  StateChanged as StateChangedEvent,
  AssetFlagged as AssetFlaggedEvent,
  AssetResolved as AssetResolvedEvent,
} from "../../generated/TAGITCore/TAGITCore";
import {
  Asset,
  User,
  Transfer,
  StateChange,
  Flag,
  Resolution,
  GlobalStats,
} from "../../generated/schema";

// Asset state constants
const STATE_MINTED = 0;
const STATE_BOUND = 1;
const STATE_ACTIVATED = 2;
const STATE_CLAIMED = 3;
const STATE_FLAGGED = 4;
const STATE_RECYCLED = 5;

// Zero address for mint detection
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

// Helper to get or create Asset entity
function getOrCreateAsset(tokenId: BigInt, timestamp: BigInt): Asset {
  let id = tokenId.toString();
  let asset = Asset.load(id);

  if (!asset) {
    asset = new Asset(id);
    asset.tokenId = tokenId;
    asset.state = STATE_MINTED;
    asset.createdAt = timestamp;
    asset.updatedAt = timestamp;
    // Owner will be set by Transfer event
  }

  return asset;
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

// Update state counts in global stats
function updateStateCounts(oldState: i32, newState: i32): void {
  let stats = getOrCreateGlobalStats();

  // Decrement old state count
  if (oldState == STATE_MINTED) stats.mintedCount -= 1;
  else if (oldState == STATE_BOUND) stats.boundCount -= 1;
  else if (oldState == STATE_ACTIVATED) stats.activatedCount -= 1;
  else if (oldState == STATE_CLAIMED) stats.claimedCount -= 1;
  else if (oldState == STATE_FLAGGED) stats.flaggedCount -= 1;
  else if (oldState == STATE_RECYCLED) stats.recycledCount -= 1;

  // Increment new state count
  if (newState == STATE_MINTED) stats.mintedCount += 1;
  else if (newState == STATE_BOUND) stats.boundCount += 1;
  else if (newState == STATE_ACTIVATED) stats.activatedCount += 1;
  else if (newState == STATE_CLAIMED) stats.claimedCount += 1;
  else if (newState == STATE_FLAGGED) stats.flaggedCount += 1;
  else if (newState == STATE_RECYCLED) stats.recycledCount += 1;

  stats.save();
}

// Handle Transfer events (including mints)
export function handleTransfer(event: TransferEvent): void {
  let timestamp = event.block.timestamp;
  let tokenId = event.params.tokenId;
  let fromAddress = event.params.from;
  let toAddress = event.params.to;

  let isMint = fromAddress.toHexString() == ZERO_ADDRESS;

  // Get or create users
  let toUser = getOrCreateUser(toAddress, timestamp);
  toUser.lastActiveAt = timestamp;
  toUser.totalAssetsOwned += 1;
  toUser.save();

  // Get or create asset
  let asset = getOrCreateAsset(tokenId, timestamp);
  asset.owner = toUser.id;
  asset.updatedAt = timestamp;
  asset.save();

  // Create transfer record
  let transferId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let transfer = new Transfer(transferId);
  transfer.asset = asset.id;
  transfer.to = toUser.id;
  transfer.timestamp = timestamp;
  transfer.blockNumber = event.block.number;
  transfer.txHash = event.transaction.hash;

  if (isMint) {
    // Create a placeholder "from" user for mints
    let zeroUser = getOrCreateUser(fromAddress, timestamp);
    transfer.from = zeroUser.id;

    // Update global stats for mint
    let stats = getOrCreateGlobalStats();
    stats.totalAssets = stats.totalAssets.plus(BigInt.fromI32(1));
    stats.mintedCount += 1;
    stats.dailyMints += 1;
    stats.totalTransfers = stats.totalTransfers.plus(BigInt.fromI32(1));
    stats.lastUpdated = timestamp;
    stats.save();
  } else {
    // Regular transfer - update from user
    let fromUser = getOrCreateUser(fromAddress, timestamp);
    fromUser.lastActiveAt = timestamp;
    fromUser.totalAssetsOwned -= 1;
    fromUser.save();
    transfer.from = fromUser.id;

    // Update global stats for transfer
    let stats = getOrCreateGlobalStats();
    stats.totalTransfers = stats.totalTransfers.plus(BigInt.fromI32(1));
    stats.dailyTransfers += 1;
    stats.lastUpdated = timestamp;
    stats.save();
  }

  transfer.save();
}

// Handle StateChanged events
export function handleStateChanged(event: StateChangedEvent): void {
  let timestamp = event.block.timestamp;
  let tokenId = event.params.assetId;
  let oldState = event.params.oldState;
  let newState = event.params.newState;

  // Update asset
  let asset = Asset.load(tokenId.toString());
  if (asset) {
    asset.state = newState;
    asset.updatedAt = timestamp;
    asset.save();
  }

  // Create state change record
  let stateChangeId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let stateChange = new StateChange(stateChangeId);
  stateChange.asset = tokenId.toString();
  stateChange.oldState = oldState;
  stateChange.newState = newState;
  stateChange.timestamp = timestamp;
  stateChange.blockNumber = event.block.number;
  stateChange.txHash = event.transaction.hash;
  stateChange.save();

  // Update state counts
  updateStateCounts(oldState, newState);
}

// Handle AssetFlagged events
export function handleAssetFlagged(event: AssetFlaggedEvent): void {
  let timestamp = event.block.timestamp;
  let tokenId = event.params.assetId;
  let reporterAddress = event.params.reporter;
  let reason = event.params.reason;

  // Get or create reporter user
  let reporter = getOrCreateUser(reporterAddress, timestamp);
  reporter.lastActiveAt = timestamp;
  reporter.save();

  // Create flag record
  let flagId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let flag = new Flag(flagId);
  flag.asset = tokenId.toString();
  flag.reporter = reporter.id;
  flag.reason = reason;
  flag.timestamp = timestamp;
  flag.blockNumber = event.block.number;
  flag.txHash = event.transaction.hash;
  flag.resolved = false;
  flag.save();

  // Update global stats
  let stats = getOrCreateGlobalStats();
  stats.totalFlags = stats.totalFlags.plus(BigInt.fromI32(1));
  stats.dailyFlags += 1;
  stats.lastUpdated = timestamp;
  stats.save();
}

// Handle AssetResolved events
export function handleAssetResolved(event: AssetResolvedEvent): void {
  let timestamp = event.block.timestamp;
  let tokenId = event.params.assetId;
  let resolverAddress = event.params.resolver;
  let resolutionType = event.params.resolution;

  // Get or create resolver user
  let resolver = getOrCreateUser(resolverAddress, timestamp);
  resolver.lastActiveAt = timestamp;
  resolver.save();

  // Create resolution record
  let resolutionId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let resolution = new Resolution(resolutionId);
  resolution.asset = tokenId.toString();
  resolution.resolver = resolver.id;
  resolution.resolutionType = resolutionType;
  resolution.timestamp = timestamp;
  resolution.blockNumber = event.block.number;
  resolution.txHash = event.transaction.hash;
  resolution.save();

  // Try to find and update the corresponding flag
  // Note: This is a simplified approach; in production you might want
  // to track the most recent unresolved flag for the asset
  // For now, we just update global stats

  // Update global stats
  let stats = getOrCreateGlobalStats();
  stats.totalResolutions = stats.totalResolutions.plus(BigInt.fromI32(1));
  stats.lastUpdated = timestamp;
  stats.save();
}
