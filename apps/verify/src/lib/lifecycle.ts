import "server-only";

/**
 * Lifecycle history for one token: the ordered on-chain event timeline behind a
 * verdict.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * READ THIS BEFORE CHANGING ANY CONSTANT IN THIS FILE.
 *
 * A full-history `eth_getLogs` over this contract is NOT cheap, and on every
 * keyless Base Sepolia RPC available today it is not even possible. The numbers
 * below are measured, not assumed, and they are the reason this module is shaped
 * the way it is.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE RANGE
 * ─────────
 * TAGITCore's proxy was created in block 39,611,546 (see the constant below), so
 * the smallest range that can contain the complete history of any token is
 * [39,611,546, head]. At the time of writing head was ~44.30M, i.e. ~4.69M
 * blocks, and Base Sepolia produces a block every 2s — so this range grows by
 * ~43,200 blocks a day whatever we do.
 *
 * MEASURED PROVIDER LIMITS — twelve keyless Base Sepolia endpoints, July 2026
 * ──────────────────────────────────────────────────────────────────────────
 * A single eth_getLogs for [deployment, latest] with a topic filter on token 5
 * was rejected by every one of them. NOT ONE keyless provider serves this range:
 *
 *   https://sepolia.base.org           "query exceeds max block range 2000"
 *                                      -> 2k window     -> ~2,549 requests
 *   https://base-sepolia.gateway.tenderly.co
 *                                      "query exceeds max block range 100000"
 *                                      -> 100k window   -> 51 requests
 *   https://base-sepolia.drpc.org      "ranges over 10000 blocks are not
 *                                       supported on free plan"
 *                                      -> 10k window    -> ~510 requests
 *   https://84532.rpc.thirdweb.com     "eth_getLogs is limited to a 10,000 range"
 *                                      -> 10k window    -> ~510 requests
 *   https://base-sepolia.g.alchemy.com (free tier)
 *                                      "up to a 10 block range"
 *                                      -> 10 window     -> ~510,000 requests
 *   publicnode / blast / zan / blockpi / omniatech / onfinality / tatum
 *                                      -> archive access refused outright
 *
 * AND CHUNKING DOES NOT RESCUE THE BEST OF THEM. Running the 51-chunk scan
 * against Tenderly, measured:
 *
 *   sequential      51 chunks, 10 logs, 8,142ms, 0 errors
 *   concurrency 3   51 chunks, 10 logs, 5,698ms, 1x "rate limit exceeded"
 *   concurrency 6   51 chunks,  6 logs, 5,255ms, 2x "rate limit exceeded"
 *
 * Read the concurrency-6 row carefully: SIX logs, not ten. A rate-limited chunk
 * that is swallowed rather than raised produces a history that is silently
 * missing events — the worst possible failure for a provenance record, because
 * it looks exactly like a complete answer. That is why a failed chunk aborts the
 * whole scan below instead of contributing what it managed to fetch, and it is
 * the direct reason the budget is small: a scan large enough to need dozens of
 * chunks is a scan whose result cannot be trusted even when it "succeeds".
 *
 * A provider on a paid/archive plan answers the whole range in ONE request with
 * none of this, and that is the path this module is built around. The chunking
 * below exists only for a provider whose window is wide enough to need a handful
 * of requests; it is a narrow fallback, not the design.
 *
 * WHAT THIS MODULE REFUSES TO DO — and why each was considered and rejected
 * ────────────────────────────────────────────────────────────────────────
 *   1. CHUNK WITHOUT A CEILING. 2,345 sequential RPC reads on a keyless POST
 *      endpoint with no edge cache is precisely the request shape behind this
 *      project's Vercel overbilling incident, amplified ~1,000x per call. The
 *      budget below is a hard stop, and exceeding it returns a typed
 *      "not available" rather than a slow answer.
 *
 *   2. ANSWER FROM A THIRD-PARTY INDEX. Blockscout's public API serves this
 *      exact query, keyless, over the full range, in ~440ms — it was measured
 *      and it works. It is still not used, because a verification host that
 *      launders an index's claim as chain state has quietly changed what its
 *      answers mean, and no caller could tell. verify_asset reads the chain;
 *      so does this. If TAG IT wants an index in the trust path that must be a
 *      deliberate, disclosed decision (tagit-indexer), not a fallback nobody
 *      noticed. See "IF YOU NEED THIS TO ALWAYS WORK" below.
 *
 *   3. SCAN ONLY A RECENT WINDOW. Cheap, and it silently omits the mint — the
 *      one event a provenance timeline exists to show. A history missing its
 *      first entry is not a shorter history, it is a wrong one.
 *
 *   4. RETURN AN EMPTY LIST WHEN WE COULD NOT LOOK. `available: false` and
 *      `events: []` are completely different claims. Collapsing them lets a
 *      caller conclude "this asset has no history" from "we could not afford to
 *      check", which for a fraud filter is the difference between a pass and a
 *      block.
 *
 * IF YOU NEED THIS TO ALWAYS WORK, the fix is not a bigger budget — that number
 * gets worse every single day as the chain grows. It is either an RPC plan with
 * archive-range eth_getLogs (one request, permanently), or the tagit-indexer
 * subgraph. Raising MAX_LOG_REQUESTS to chase chain height is the wrong move and
 * will keep being the wrong move.
 */
import { decodeEventLog, type Hex } from "viem";
import { TAGITCoreEventsABI } from "./abi";
import { CONTRACT_ADDRESS } from "./contract";
import { getPublicClient } from "./contract.server";
import { CHAIN_ID } from "./dpp";
import { STATES } from "./states";
import { addressCommitment } from "./verdict";

/**
 * Block in which the TAGITCore proxy at 0x3aDc…1d1D was created.
 *
 * DETERMINED EMPIRICALLY, NOT GUESSED. Creation transaction
 * 0x6cea25acc1789b5dc416d5409853c591c3d4bc92feffda97c3c846f92da79f66, and
 * confirmed by bisecting `eth_getCode` across the boundary:
 *
 *   cast code 0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D --block 39611545 \
 *        --rpc-url https://sepolia.base.org        -> 0x        (no contract)
 *   cast code 0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D --block 39611546 \
 *        --rpc-url https://sepolia.base.org        -> 0x6080…   (deployed)
 *
 * Starting from 0 instead would add 39.6M pointless blocks to every scan — 8.4x
 * the real range — for zero additional events, since the contract could not emit
 * one before it existed.
 *
 * THIS IS THE PROXY, WHICH IS THE RIGHT ADDRESS. TAGITCore is an EIP-1967 proxy
 * (implementation 0x2377…A14C at the time of writing). Events are emitted in the
 * proxy's context and therefore carry the proxy's address, so both the `address`
 * filter and this floor track the proxy. An implementation upgrade does not move
 * either one.
 */
export const TAGITCORE_DEPLOYMENT_BLOCK = 39_611_546n;

/**
 * Hard ceiling on eth_getLogs calls for a single history scan.
 *
 * EIGHT, AND THE NUMBER IS DERIVED FROM THE MEASUREMENTS IN THE HEADER, not
 * chosen to make anything fit. A scan needing <=8 chunks completes in well under
 * a second and stays far below the burst rate at which providers started
 * refusing requests. A scan needing 51 took 5-8s and dropped chunks to rate
 * limiting on the only keyless provider wide enough to attempt it. The honest
 * cut-off is therefore "a handful", not "as many as we can survive".
 *
 * Consequences, stated plainly so nobody is surprised:
 *   • archive-range provider  -> 1 request, full history. THE PRODUCTION PATH.
 *   • window >= ~640k blocks  -> a few chunks, works.
 *   • Tenderly (100k window)  -> 51 needed, over budget -> typed not-available.
 *   • sepolia.base.org (2k)   -> 2,549 needed          -> typed not-available.
 *
 * So on today's keyless endpoints this tool reports `available: false`, and that
 * is the correct, intended, documented behaviour rather than a bug. The fix is
 * an RPC plan whose eth_getLogs accepts the range.
 *
 * DO NOT RAISE THIS as the chain grows. See the header: past this point the
 * answer is an archive RPC plan or an index, and a bigger number here just buys
 * a slower, less reliable way to be barely inside the limit for another month.
 */
export const MAX_LOG_REQUESTS = 8;

/**
 * How many chunk requests may be in flight at once.
 *
 * THREE, measured. Concurrency 6 against Tenderly lost 2 of 51 chunks to "rate
 * limit exceeded"; concurrency 3 lost 1 of 51 and was no slower overall. Since a
 * lost chunk now aborts the entire scan (a partial timeline is never returned),
 * higher concurrency does not buy speed — it buys a higher chance of throwing
 * away the work already done. At the 8-request budget above, 3 in flight means a
 * worst-case cold scan is three round trips deep.
 */
const SCAN_CONCURRENCY = 3;

/**
 * How far back to re-scan on an incremental top-up (see the cache note).
 *
 * Base is an OP-Stack chain, so unsafe-head reorgs are shallow and short-lived,
 * but they are not impossible. Re-reading the last 128 blocks on every warm call
 * costs one request we were making anyway and means a log that moved between
 * calls gets corrected rather than cached forever at a stale height.
 */
const REORG_MARGIN = 128n;

/** Bound the memo so a token-id enumeration cannot grow it without limit. */
const MAX_CACHED_TOKENS = 512;

export type LifecycleUnavailableCode = "PROVIDER_RANGE_LIMIT" | "CHAIN_UNAVAILABLE";

/**
 * One decoded event.
 *
 * NO RAW ADDRESSES — see the note on addressCommitment() in @/lib/verdict.
 * `AssetMinted.to`, `AssetResold.from`/`to` and `StateChanged.actor` are all
 * addresses, and returning them here would reopen per-token, with history, the
 * exact bulk goods->wallet scrape that owner_commitment closes on the verdict.
 * They are committed with the same domain-separated hash, so one candidate
 * address can be checked against the verdict AND against every event in the
 * timeline with a single hash function.
 *
 * `transaction_hash` + `block_number` are returned deliberately alongside them.
 * The commitment was never secrecy (it cannot be — the chain is public), so
 * withholding the tx hash would buy nothing and cost the caller the ability to
 * re-derive. With it, anyone can pull the raw log themselves:
 *
 *   cast logs --from-block <block_number> --to-block <block_number> \
 *        --address 0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D \
 *        --rpc-url https://sepolia.base.org
 */
export interface LifecycleEvent {
  type: "AssetMinted" | "TagBound" | "StateChanged" | "AssetResold";
  block_number: number;
  log_index: number;
  transaction_hash: Hex;
  /** StateChanged only. Lifecycle code + label of the state being left. */
  from_state_code?: number;
  from_state?: string;
  /** StateChanged only. Lifecycle code + label of the state being entered. */
  to_state_code?: number;
  to_state?: string;
  /** StateChanged.actor / AssetResold.from, committed. */
  actor_commitment?: Hex | null;
  /** AssetMinted.to / AssetResold.to, committed. */
  to_commitment?: Hex | null;
  from_commitment?: Hex | null;
  /** AssetMinted.metadata — an on-chain bytes32, safe to return raw. */
  metadata?: Hex;
  /** TagBound.tagHash — keccak256 of the NFC chip UID, safe to return raw. */
  tag_hash?: Hex;
}

export type LifecycleResult =
  | {
      available: true;
      events: LifecycleEvent[];
      scan: { from_block: number; to_block: number; requests: number; source: "eth_getLogs" };
    }
  | {
      available: false;
      reason: LifecycleUnavailableCode;
      message: string;
      detail: {
        from_block: number;
        to_block: number;
        provider_max_block_range: number | null;
        requests_required: number | null;
        request_budget: number;
      };
      /** A command the caller can run to get the answer we could not afford. */
      re_derive: string;
    };

const TOPIC0: Record<Hex, LifecycleEvent["type"]> = {
  "0x5c6b40cc9c243e5932bb50b35997a88a50ea5263e1db10c10f168de3c1ba0f71": "StateChanged",
  "0xb49a1942181676c53a45adef7c0e3378f270b5f4bed5c43d6cefb7886f82a0a9": "AssetMinted",
  "0xc2d03547b772fd22e620aac789d884d7b502e1e0499abaa02dce3bd86022f3fe": "TagBound",
  "0x71bd2049f64d1fd0969ab18322a80a3c0214dc909dcbe27e5da596bc5958c1bc": "AssetResold",
};

const TOPIC0_LIST = Object.keys(TOPIC0) as Hex[];

interface RawLog {
  blockNumber: Hex;
  logIndex: Hex;
  transactionHash: Hex;
  topics: Hex[];
  data: Hex;
}

/**
 * Pull the PROVIDER's own error text out of a viem error — and only that.
 *
 * ⚠ NEVER USE `error.message` HERE, AND NEVER PUT IT IN A RESPONSE. viem's
 * BaseError.message is a formatted dump that embeds the full request context,
 * including the line `URL: <transport url>`. On this host that URL is
 * BASE_SEPOLIA_RPC_URL — a spend-capped RPC key whose entire purpose is to not
 * be public (see @/lib/contract.server). Surfacing it from a keyless endpoint
 * that anyone can POST to would hand out the key by serving an error, which is
 * precisely the failure mode the capped-key design exists to prevent. This was
 * caught during development because a range-limit response echoed the transport
 * URL to an unauthenticated caller.
 *
 * `error.details` is viem's copy of the JSON-RPC error object's own `message`
 * field, with no request context attached — measured against Tenderly, dRPC,
 * Alchemy and the Base public endpoint. That is the only field read here.
 */
function providerDetail(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const e = error as { details?: unknown; cause?: { details?: unknown } };
  if (typeof e.details === "string") return e.details;
  if (typeof e.cause?.details === "string") return e.cause.details;
  return "";
}

/**
 * Read the provider's own advertised maximum block range out of its error.
 *
 * Every provider that imposes a cap says so, and says the number — but each in
 * its own wording, so the alternative to matching on it is blind halving, which
 * wastes a request per halving and converges on the same answer more slowly.
 * The four patterns below are transcribed from the live responses quoted in the
 * header. An unrecognised message returns null, and the caller then declines to
 * chunk at all rather than guessing a window: a wrong guess produces a scan that
 * silently skips blocks, and a history with a hole in it is worse than no
 * history.
 */
function parseMaxBlockRange(message: string): number | null {
  const patterns = [
    /max block range (\d+)/i, // Base public RPC, Tenderly
    /ranges over (\d+) blocks are not supported/i, // dRPC
    /up to an? (\d+) block range/i, // Alchemy
    /block range (?:limit|too large).{0,20}?(\d+)/i, // generic
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isSafeInteger(value) && value > 0) return value;
    }
  }
  return null;
}

/** Block numbers are JSON-RPC QUANTITIES: minimal hex, no leading zeros. */
function toQuantity(value: bigint): Hex {
  return `0x${value.toString(16)}`;
}

/**
 * Topics are 32-byte DATA, not quantities, and must be zero-padded to exactly 64
 * hex digits.
 *
 * This distinction is the difference between a working filter and a silent one.
 * `0x5` is a perfectly good *quantity* for a block number and a malformed
 * *topic*; a node handed it answers "invalid params" with no indication of which
 * parameter, which surfaces here as a generic RPC failure and — before the fix —
 * as a permanently unavailable history for every token. Caught by driving the
 * server from a real MCP client rather than by reading the code.
 */
function toTopic(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

/** One eth_getLogs, with the four-way topic0 OR and the tokenId topic1 filter. */
async function getLogsRange(tokenId: bigint, fromBlock: bigint, toBlock: bigint): Promise<RawLog[]> {
  // Issued as a raw request rather than through viem's `getLogs({ events })`
  // helper so the wire parameters are exactly what the docstring tells callers
  // to reproduce, and so the topic0 OR + topic1 filter cannot be reshaped by a
  // future change in viem's argument-encoding behaviour.
  return (await getPublicClient().request({
    method: "eth_getLogs",
    params: [
      {
        address: CONTRACT_ADDRESS,
        fromBlock: toQuantity(fromBlock),
        toBlock: toQuantity(toBlock),
        // topics[0] = any of the four lifecycle events; topics[1] = this token.
        // tokenId is indexed on all four, which is what makes this a
        // server-side filter instead of a full-contract log download.
        // NOTE the asymmetry: blocks are quantities, topics are padded data.
        topics: [TOPIC0_LIST, toTopic(tokenId)],
      },
    ],
  } as never)) as unknown as RawLog[];
}

/** Decode one raw log, or null if it is not one of ours (defensive). */
function decode(tokenId: bigint, log: RawLog): LifecycleEvent | null {
  const type = TOPIC0[log.topics[0]];
  if (!type) return null;

  const base = {
    type,
    block_number: Number(BigInt(log.blockNumber)),
    log_index: Number(BigInt(log.logIndex)),
    transaction_hash: log.transactionHash,
  };

  let decoded: { eventName: string; args: Record<string, unknown> };
  try {
    decoded = decodeEventLog({
      abi: TAGITCoreEventsABI,
      topics: log.topics as [Hex, ...Hex[]],
      data: log.data,
    }) as { eventName: string; args: Record<string, unknown> };
  } catch {
    // A log whose topics match one of our signatures but whose payload will not
    // decode is not something to paper over with partial data — drop it. The
    // scan's request count still reports that we looked.
    return null;
  }

  const args = decoded.args;
  const commit = (value: unknown) =>
    typeof value === "string" ? addressCommitment(tokenId, value) : null;

  switch (type) {
    case "StateChanged": {
      const from = Number(args.from);
      const to = Number(args.to);
      return {
        ...base,
        from_state_code: from,
        from_state: STATES[from]?.label ?? "UNKNOWN",
        to_state_code: to,
        to_state: STATES[to]?.label ?? "UNKNOWN",
        actor_commitment: commit(args.actor),
      };
    }
    case "AssetMinted":
      return { ...base, to_commitment: commit(args.to), metadata: args.metadata as Hex };
    case "TagBound":
      return { ...base, tag_hash: args.tagHash as Hex };
    case "AssetResold":
      return { ...base, from_commitment: commit(args.from), to_commitment: commit(args.to) };
  }
}

/** Oldest-first, and stable: (block, logIndex) is the chain's own total order. */
function chronological(events: LifecycleEvent[]): LifecycleEvent[] {
  return [...events].sort(
    (a, b) => a.block_number - b.block_number || a.log_index - b.log_index,
  );
}

/** Drop duplicates by the chain's own event identity. Needed because a warm
 *  top-up deliberately re-reads REORG_MARGIN blocks it has already seen. */
function dedupe(events: LifecycleEvent[]): LifecycleEvent[] {
  const seen = new Set<string>();
  const out: LifecycleEvent[] = [];
  for (const event of events) {
    const key = `${event.block_number}:${event.log_index}:${event.transaction_hash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

/**
 * Per-instance memo of already-scanned history.
 *
 * WHY THIS IS SAFE, and it is the only reason it exists: below the head, event
 * history is IMMUTABLE. A log at block N cannot change; only a reorg can remove
 * it, and REORG_MARGIN above re-reads far enough back to catch that. So a warm
 * call scans (scannedTo - margin, head] — one request — instead of repeating the
 * cold scan. That turns a 47-request cold cost into a once-per-token,
 * once-per-instance cost rather than a per-call one, which is what makes the
 * budget above defensible at all.
 *
 * It is per-instance and therefore bounds nothing globally on serverless, in
 * exactly the way documented for the rate limiter in @/lib/rate-limit — this is
 * a latency and cost optimisation, not a guarantee, and nothing in this module's
 * correctness depends on a hit.
 */
interface CacheEntry {
  events: LifecycleEvent[];
  scannedTo: bigint;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(tokenId: bigint): string {
  return tokenId.toString();
}

function remember(tokenId: bigint, entry: CacheEntry): void {
  const key = cacheKey(tokenId);
  // Insertion-ordered eviction: drop the oldest key once full. Crude, and
  // correct — a miss costs a rescan, never a wrong answer.
  if (!cache.has(key) && cache.size >= MAX_CACHED_TOKENS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
}

/** Split [from, to] into windows of at most `window` blocks. */
function windows(from: bigint, to: bigint, window: bigint): Array<[bigint, bigint]> {
  const out: Array<[bigint, bigint]> = [];
  let cursor = from;
  while (cursor <= to) {
    const end = cursor + window - 1n;
    out.push([cursor, end > to ? to : end]);
    cursor = end + 1n;
  }
  return out;
}

/** Run `tasks` with bounded concurrency, preserving result order. */
async function pooled<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

function reDeriveCommand(tokenId: bigint, fromBlock: bigint, toBlock: bigint): string {
  return (
    `cast logs --from-block ${fromBlock} --to-block ${toBlock} ` +
    `--address ${CONTRACT_ADDRESS} ` +
    `'StateChanged(uint256,uint8,uint8,address)' ${tokenId} ` +
    `--rpc-url <an RPC whose eth_getLogs accepts a ${toBlock - fromBlock + 1n}-block range>`
  );
}

/**
 * THE history scan.
 *
 * `toBlock` is passed in rather than read here so that a caller producing both a
 * verdict and a timeline pins BOTH to the same height — a timeline one block
 * ahead of the verdict it accompanies is a small, permanent inconsistency in
 * exactly the kind of record this host exists to make trustworthy.
 */
export async function getLifecycleHistory(
  tokenId: bigint,
  toBlock: bigint,
): Promise<LifecycleResult> {
  const cached = cache.get(cacheKey(tokenId));
  const from =
    cached && cached.scannedTo > TAGITCORE_DEPLOYMENT_BLOCK + REORG_MARGIN
      ? cached.scannedTo - REORG_MARGIN
      : TAGITCORE_DEPLOYMENT_BLOCK;

  if (from > toBlock) {
    // Cache is ahead of the pinned head (a lagging node behind a load balancer).
    // Answer from what we already hold rather than issuing a backwards range.
    return {
      available: true,
      events: chronological(cached!.events),
      scan: {
        from_block: Number(TAGITCORE_DEPLOYMENT_BLOCK),
        to_block: Number(cached!.scannedTo),
        requests: 0,
        source: "eth_getLogs",
      },
    };
  }

  let requests = 0;
  let fresh: LifecycleEvent[];

  // ATTEMPT 1 — the whole range in one call. On an archive-range provider this
  // is the entire implementation and everything below never runs.
  try {
    requests = 1;
    const logs = await getLogsRange(tokenId, from, toBlock);
    fresh = logs.map((log) => decode(tokenId, log)).filter((e): e is LifecycleEvent => e !== null);
  } catch (error) {
    const window = parseMaxBlockRange(providerDetail(error));

    if (window === null) {
      // Either a genuine RPC outage or a cap we cannot read the size of. Both
      // are "we could not look", and neither is "there is no history".
      //
      // The provider's text is deliberately NOT included. It is attacker-
      // reachable output on a keyless endpoint, and the only thing a caller can
      // do with it is the same thing they can do without it: retry, or scan the
      // range themselves with the command below.
      return {
        available: false,
        reason: "CHAIN_UNAVAILABLE",
        message:
          "the configured RPC rejected the eth_getLogs history scan and did not state a " +
          "usable block-range limit, so the timeline could not be read. This is NOT a " +
          "statement that the token has no history — do not read it as an empty timeline.",
        detail: {
          from_block: Number(from),
          to_block: Number(toBlock),
          provider_max_block_range: null,
          requests_required: null,
          request_budget: MAX_LOG_REQUESTS,
        },
        re_derive: reDeriveCommand(tokenId, TAGITCORE_DEPLOYMENT_BLOCK, toBlock),
      };
    }

    const chunks = windows(from, toBlock, BigInt(window));
    // +1 for the probe request already spent discovering the window.
    if (chunks.length + 1 > MAX_LOG_REQUESTS) {
      return {
        available: false,
        reason: "PROVIDER_RANGE_LIMIT",
        message:
          `This RPC caps eth_getLogs at ${window} blocks, so covering ` +
          `[${from}, ${toBlock}] would take ${chunks.length} requests; the budget is ` +
          `${MAX_LOG_REQUESTS}. Refusing to spend that on one call. This is a provider ` +
          `capability limit, NOT a statement that the token has no history — do not ` +
          `read it as an empty timeline.`,
        detail: {
          from_block: Number(from),
          to_block: Number(toBlock),
          provider_max_block_range: window,
          requests_required: chunks.length,
          request_budget: MAX_LOG_REQUESTS,
        },
        re_derive: reDeriveCommand(tokenId, TAGITCORE_DEPLOYMENT_BLOCK, toBlock),
      };
    }

    try {
      const batches = await pooled(
        chunks.map(([start, end]) => () => getLogsRange(tokenId, start, end)),
        SCAN_CONCURRENCY,
      );
      requests += chunks.length;
      fresh = batches
        .flat()
        .map((log) => decode(tokenId, log))
        .filter((e): e is LifecycleEvent => e !== null);
    } catch {
      // Same rule as above: no provider text on the wire, for the same reason.
      return {
        available: false,
        reason: "CHAIN_UNAVAILABLE",
        message:
          "the chunked eth_getLogs history scan failed partway through, so the timeline is " +
          "incomplete and is not returned. Partial history is withheld deliberately: a " +
          "timeline missing an unknown subset of its events is worse than none.",
        detail: {
          from_block: Number(from),
          to_block: Number(toBlock),
          provider_max_block_range: window,
          requests_required: chunks.length,
          request_budget: MAX_LOG_REQUESTS,
        },
        re_derive: reDeriveCommand(tokenId, TAGITCORE_DEPLOYMENT_BLOCK, toBlock),
      };
    }
  }

  const merged = chronological(dedupe([...(cached?.events ?? []), ...fresh]));
  remember(tokenId, { events: merged, scannedTo: toBlock });

  return {
    available: true,
    events: merged,
    scan: {
      // Always the deployment block: the events returned span the FULL history,
      // even when this particular call only had to top up the tail.
      from_block: Number(TAGITCORE_DEPLOYMENT_BLOCK),
      to_block: Number(toBlock),
      requests,
      source: "eth_getLogs",
    },
  };
}

/** Test seam: history is memoised per instance, and a test that asserts request
 *  counts must be able to start cold. Not reachable over HTTP. */
export function __resetLifecycleCache(): void {
  cache.clear();
}

export { CHAIN_ID };
