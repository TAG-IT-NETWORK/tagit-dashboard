// RPC event poller — fetches TAGITCore events directly from chain
// Used as fallback when subgraph URL is not configured

import { createPublicClient, http } from "viem";
import type { PublicClient, Chain, HttpTransport } from "viem";
import { optimismSepolia, arbitrumSepolia } from "viem/chains";
import { TAGITCoreABI } from "../abis/TAGITCore";
import {
  getContractsForChain,
  OP_SEPOLIA_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
} from "../addresses";
import { START_BLOCKS } from "../addresses";
import type { ActivityItem, TransferItem, FeedEvent, AssetTimelineEvent } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// Access env vars safely without @types/node
type EnvLike = { process?: { env?: Record<string, string | undefined> } };
const _env = (globalThis as unknown as EnvLike).process?.env;

const chainById: Record<number, Chain> = {
  [OP_SEPOLIA_CHAIN_ID]: optimismSepolia,
  [ARBITRUM_SEPOLIA_CHAIN_ID]: arbitrumSepolia,
};

// Cache clients by chainId to avoid re-creating on every poll
const clientCache = new Map<number, PublicClient<HttpTransport, Chain>>();

function getRpcUrl(chainId: number): string | undefined {
  if (chainId === OP_SEPOLIA_CHAIN_ID) {
    return _env?.NEXT_PUBLIC_OP_SEPOLIA_RPC;
  }
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) {
    return _env?.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC;
  }
  return undefined;
}

export function createRpcClient(chainId: number): PublicClient<HttpTransport, Chain> | null {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const rpcUrl = getRpcUrl(chainId);
  const chain = chainById[chainId];
  if (!rpcUrl || !chain) return null;

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  }) as PublicClient<HttpTransport, Chain>;
  clientCache.set(chainId, client);
  return client;
}

/** Resolve which chainId to use for TAGITCore events (skips zero-address chains) */
export function resolveEventChainId(preferredChainId: number): number {
  const contracts = getContractsForChain(preferredChainId);
  if (contracts.TAGITCore !== ZERO_ADDRESS) return preferredChainId;
  // Fallback to OP Sepolia where TAGITCore is deployed
  return OP_SEPOLIA_CHAIN_ID;
}

export async function fetchRecentStateChanges(
  client: PublicClient<HttpTransport, Chain>,
  coreAddr: `0x${string}`,
  blockRange: bigint = 2000n,
): Promise<ActivityItem[]> {
  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock > blockRange ? currentBlock - blockRange : 0n;

  const logs = await client.getContractEvents({
    address: coreAddr,
    abi: TAGITCoreABI,
    eventName: "StateChanged",
    fromBlock,
    toBlock: currentBlock,
  });

  if (logs.length === 0) return [];

  // Batch-fetch unique block timestamps
  const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))];
  const blockMap = new Map<bigint, number>();
  await Promise.all(
    uniqueBlocks.map(async (bn) => {
      const block = await client.getBlock({ blockNumber: bn });
      blockMap.set(bn, Number(block.timestamp) * 1000);
    }),
  );

  return logs.map((log) => ({
    tokenId: log.args.tokenId!.toString(),
    oldState: Number(log.args.from!),
    newState: Number(log.args.to!),
    timestamp: blockMap.get(log.blockNumber) ?? Date.now(),
    txHash: log.transactionHash,
  }));
}

export async function fetchRecentTransfers(
  client: PublicClient<HttpTransport, Chain>,
  coreAddr: `0x${string}`,
  blockRange: bigint = 2000n,
): Promise<TransferItem[]> {
  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock > blockRange ? currentBlock - blockRange : 0n;

  const logs = await client.getContractEvents({
    address: coreAddr,
    abi: TAGITCoreABI,
    eventName: "Transfer",
    fromBlock,
    toBlock: currentBlock,
  });

  if (logs.length === 0) return [];

  const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))];
  const blockMap = new Map<bigint, number>();
  await Promise.all(
    uniqueBlocks.map(async (bn) => {
      const block = await client.getBlock({ blockNumber: bn });
      blockMap.set(bn, Number(block.timestamp) * 1000);
    }),
  );

  return logs.map((log) => ({
    tokenId: log.args.tokenId!.toString(),
    from: log.args.from!,
    to: log.args.to!,
    timestamp: blockMap.get(log.blockNumber) ?? Date.now(),
    txHash: log.transactionHash,
  }));
}

/** Fetch all StateChanged events for a single asset (from deployment block) */
export async function fetchAssetStateChanges(
  client: PublicClient<HttpTransport, Chain>,
  coreAddr: `0x${string}`,
  tokenId: bigint,
): Promise<AssetTimelineEvent[]> {
  const logs = await client.getContractEvents({
    address: coreAddr,
    abi: TAGITCoreABI,
    eventName: "StateChanged",
    args: { tokenId },
    fromBlock: BigInt(START_BLOCKS.TAGITCore),
  });

  if (logs.length === 0) return [];

  const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))];
  const blockMap = new Map<bigint, number>();
  await Promise.all(
    uniqueBlocks.map(async (bn) => {
      const block = await client.getBlock({ blockNumber: bn });
      blockMap.set(bn, Number(block.timestamp) * 1000);
    }),
  );

  return logs.map((log) => ({
    tokenId: log.args.tokenId!.toString(),
    oldState: Number(log.args.from!),
    newState: Number(log.args.to!),
    timestamp: blockMap.get(log.blockNumber) ?? Date.now(),
    txHash: log.transactionHash,
    actor: (log.args as { actor?: string }).actor ?? "",
  }));
}

/** Fetch all Transfer events for a single asset (from deployment block) */
export async function fetchAssetTransfers(
  client: PublicClient<HttpTransport, Chain>,
  coreAddr: `0x${string}`,
  tokenId: bigint,
): Promise<TransferItem[]> {
  const logs = await client.getContractEvents({
    address: coreAddr,
    abi: TAGITCoreABI,
    eventName: "Transfer",
    args: { tokenId },
    fromBlock: BigInt(START_BLOCKS.TAGITCore),
  });

  if (logs.length === 0) return [];

  const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))];
  const blockMap = new Map<bigint, number>();
  await Promise.all(
    uniqueBlocks.map(async (bn) => {
      const block = await client.getBlock({ blockNumber: bn });
      blockMap.set(bn, Number(block.timestamp) * 1000);
    }),
  );

  return logs.map((log) => ({
    tokenId: log.args.tokenId!.toString(),
    from: log.args.from!,
    to: log.args.to!,
    timestamp: blockMap.get(log.blockNumber) ?? Date.now(),
    txHash: log.transactionHash,
  }));
}

/**
 * Fetch all recent TAGITCore events and merge into a sorted FeedEvent array.
 * Returns events newest-first, capped at `limit`.
 */
export async function fetchRecentEvents(
  chainId: number,
  limit: number = 15,
  blockRange: bigint = 2000n,
): Promise<{ events: FeedEvent[]; effectiveChainId: number }> {
  const effectiveChainId = resolveEventChainId(chainId);
  const client = createRpcClient(effectiveChainId);
  if (!client) return { events: [], effectiveChainId };

  const coreAddr = getContractsForChain(effectiveChainId).TAGITCore;
  if (coreAddr === ZERO_ADDRESS) return { events: [], effectiveChainId };

  const [stateChanges, transfers] = await Promise.all([
    fetchRecentStateChanges(client, coreAddr, blockRange),
    fetchRecentTransfers(client, coreAddr, blockRange),
  ]);

  const events: FeedEvent[] = [];

  for (const sc of stateChanges) {
    events.push({
      type: "state_change",
      tokenId: sc.tokenId,
      timestamp: sc.timestamp,
      txHash: sc.txHash,
      data: sc,
    });
  }

  for (const t of transfers) {
    events.push({
      type: "transfer",
      tokenId: t.tokenId,
      timestamp: t.timestamp,
      txHash: t.txHash,
      data: t,
    });
  }

  // Sort newest-first, cap at limit
  events.sort((a, b) => b.timestamp - a.timestamp);
  return { events: events.slice(0, limit), effectiveChainId };
}
