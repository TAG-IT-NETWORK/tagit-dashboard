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

export type ProvenanceWire =
  | {
      available: true;
      events: ProvenanceWireEvent[];
      scan: { from_block: number; to_block: number };
    }
  | { available: false };

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
    scan: { from_block: result.scan.from_block, to_block: result.scan.to_block },
  };
}
