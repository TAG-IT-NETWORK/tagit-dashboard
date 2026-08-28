/**
 * GET /api/asset/{tokenId}/provenance — the provenance timeline's own read
 * path (DASH-T37-SUSPENSE-ISR).
 *
 * WHY THIS ROUTE EXISTS. /asset/[tokenId] is SSG/ISR (Full Route Cache +
 * `revalidate`), and Next 14 does not stream static renders: a <Suspense>
 * boundary inside a static page is resolved to completion before the HTML is
 * stored, so on a cache MISS the whole first paint used to block on the
 * eth_getLogs history scan — precisely the cold-page case the "first-paint
 * fast" intent cares about. The timeline is therefore loaded CLIENT-SIDE
 * after mount (src/components/provenance-timeline.tsx) from this handler,
 * and the static page carries only the skeleton.
 *
 * WHAT THIS SERVES. Public on-chain lifecycle history, projected down to
 * exactly the fields the timeline renders — see @/lib/provenance-wire for the
 * shape and the rule against widening it. The scan itself is the existing
 * @/lib/lifecycle module, pinned to a freshly-read head with the same
 * pin-then-read ordering the verdict builder uses; nothing about the scan's
 * honesty rules (no partial timelines, "could not look" ≠ "no history")
 * changes by moving the call behind HTTP. Agents wanting the full structured
 * history use the MCP `get_lifecycle_history` tool; this endpoint feeds the
 * page's own island.
 *
 * CACHING — same scheme as GET /api/asset/{tokenId} (the verdict route):
 * rendered per request with an explicit per-status `cache-control`, because
 * the two outcomes need DIFFERENT freshness. A successful timeline gets the
 * shared 60s TTL (history below the head is immutable; a burst on one token
 * collapses to one scan per TTL). An unavailable/error answer is `no-store` —
 * handing a shared cache a storable "could not read" would turn a momentary
 * RPC blip into minutes of missing provenance for every caller, the same
 * status-blind-header failure documented in src/middleware.ts.
 *
 * RATE LIMITING: matched by isRateLimitedPath (src/lib/cache.ts), so the
 * middleware applies the same per-IP "asset" budget as the page and verdict
 * reads. The origin cost here is the highest on the host (up to
 * MAX_LOG_REQUESTS eth_getLogs on a cold scan), which is why this route must
 * never fall out of that predicate.
 */
import { CHAIN_READ_TTL_SECONDS, neverCacheControl } from "@/lib/cache";
import { getPublicClient } from "@/lib/contract.server";
import { getLifecycleHistory } from "@/lib/lifecycle";
import { toProvenanceWire } from "@/lib/provenance-wire";
import { parseTokenId } from "@/lib/verdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same formula as the verdict route: 60s shared TTL + 5× stale-while-revalidate. */
const TIMELINE_CACHE_CONTROL = `public, s-maxage=${CHAIN_READ_TTL_SECONDS}, stale-while-revalidate=${CHAIN_READ_TTL_SECONDS * 5}`;

function jsonResponse(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { tokenId: string } },
): Promise<Response> {
  const tokenId = parseTokenId(params.tokenId);
  if (tokenId === null) {
    return jsonResponse(
      { error: { code: "INVALID_TOKEN_ID", message: "token id must be a uint256 decimal" } },
      400,
      neverCacheControl(),
    );
  }

  try {
    // Pin the head first so the scan range is a single node's view — the same
    // pin-then-read ordering the verdict builder uses (@/lib/verdict readAt).
    const head = await getPublicClient().getBlock({ blockTag: "latest" });
    if (head.number === null) throw new Error("unpinnable head");
    const wire = toProvenanceWire(await getLifecycleHistory(tokenId, head.number));

    // `available: false` is a real answer, not an error (see @/lib/lifecycle),
    // but it must not be pinned at the edge: the next call may find a warmer
    // cache or a recovered provider. Only a real timeline is storable.
    return jsonResponse(wire, 200, wire.available ? TIMELINE_CACHE_CONTROL : neverCacheControl());
  } catch {
    // No provider text on the wire — same rule and same reason as
    // @/lib/lifecycle's providerDetail note: this is attacker-reachable output
    // on a keyless endpoint and viem errors can embed the transport URL.
    return jsonResponse(
      { error: { code: "CHAIN_UNAVAILABLE", message: "could not read the chain right now" } },
      502,
      neverCacheControl(),
    );
  }
}
