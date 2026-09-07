/**
 * Wire shape for GET /api/asset/[tokenId]/provenance (DASH-T37-SUSPENSE-ISR).
 *
 * This module is deliberately environment-agnostic: the route handler imports
 * the projection function, the client-side timeline imports ONLY the types
 * (type-only imports are erased at build, so the `server-only` guard inside
 * @/lib/lifecycle is never tripped by the browser bundle).
 *
 * THE PROJECTION IS THE PRIVACY BOUNDARY. The timeline renders exactly: the
 * event label (type + from/to state names), block number, log index and tx
 * hash, plus the scanned range. This wire shape carries exactly those fields
 * and NOTHING else — no commitments, no tag hashes, no metadata words. The
 * route must never widen this to "just return the LifecycleResult": agents
 * that want the full structured history already have the MCP
 * `get_lifecycle_history` tool, and this endpoint exists only to feed the
 * page's own timeline.
 *
 * `available: false` carries no detail on purpose. The timeline renders one
 * honest sentence for every could-not-look case, and the lifecycle module's
 * rule is inherited unchanged: "we could not look" is never collapsed into
 * "there is no history", and a partial scan never reaches this shape at all.
 */
import type { LifecycleEvent, LifecycleResult } from "./lifecycle";

export interface ProvenanceWireEvent {
  type: LifecycleEvent["type"];
  block_number: number;
  log_index: number;
  transaction_hash: string;
  /** StateChanged only — the labels the timeline row interpolates. */
  from_state?: string;
  to_state?: string;
}

export type ProvenanceWireSource = "eth_getLogs" | "tagit-services";

export type ProvenanceWire =
  | {
      available: true;
      events: ProvenanceWireEvent[];
      scan: { from_block: number; to_block: number; source?: ProvenanceWireSource };
    }
  | { available: false };

const WIRE_TYPES = new Set(["AssetMinted", "TagBound", "StateChanged", "AssetResold"]);

/**
 * Fallback source: the provenance list tagit-services keeps for each token
 * (its relayer transaction receipts + reconciler chain reads). Used when this
 * host cannot scan the chain itself — every RPC available to it caps
 * eth_getLogs at 10k–50k blocks and TAGITCore's history spans millions. The
 * footer names the source so the reader knows which records they are seeing.
 * Returns `available: false` when the list is missing or empty.
 */
export function servicesProvenanceToWire(
  entries: ReadonlyArray<{ type: string; blockNumber: number; txHash: string; data?: Record<string, unknown> }> | undefined,
  stateLabel: (code: number) => string,
): ProvenanceWire {
  if (!entries || entries.length === 0) return { available: false };
  const events: ProvenanceWireEvent[] = [];
  entries.forEach((e, i) => {
    if (!WIRE_TYPES.has(e.type) || !Number.isFinite(e.blockNumber) || typeof e.txHash !== "string") return;
    const from = typeof e.data?.from === "number" ? (e.data.from as number) : undefined;
    const to = typeof e.data?.to === "number" ? (e.data.to as number) : undefined;
    events.push({
      type: e.type as ProvenanceWireEvent["type"],
      block_number: e.blockNumber,
      log_index: i,
      transaction_hash: e.txHash as ProvenanceWireEvent["transaction_hash"],
      ...(e.type === "StateChanged" && from !== undefined ? { from_state: stateLabel(from) } : {}),
      ...(e.type === "StateChanged" && to !== undefined ? { to_state: stateLabel(to) } : {}),
    });
  });
  if (events.length === 0) return { available: false };
  events.sort((a, b) => a.block_number - b.block_number || a.log_index - b.log_index);
  return {
    available: true,
    events,
    scan: { from_block: events[0]!.block_number, to_block: events[events.length - 1]!.block_number, source: "tagit-services" },
  };
}

/** Project a LifecycleResult down to exactly what the timeline renders. */
export function toProvenanceWire(result: LifecycleResult): ProvenanceWire {
  if (!result.available) return { available: false };
  return {
    available: true,
    events: result.events.map((event) => ({
      type: event.type,
      block_number: event.block_number,
      log_index: event.log_index,
      transaction_hash: event.transaction_hash,
      ...(event.from_state !== undefined ? { from_state: event.from_state } : {}),
      ...(event.to_state !== undefined ? { to_state: event.to_state } : {}),
    })),
    scan: { from_block: result.scan.from_block, to_block: result.scan.to_block, source: "eth_getLogs" },
  };
}
