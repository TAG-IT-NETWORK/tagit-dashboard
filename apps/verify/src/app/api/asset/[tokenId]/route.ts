/**
 * GET /api/asset/{tokenId} — the free, keyless ASSERTION read.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Until this route, the only JSON on this host was /api/verify, which requires a
 * `picc`+`cmac` SUN cryptogram produced by physically tapping an NTAG 424 DNA
 * chip. No software can manufacture one. That is correct for what /api/verify
 * does, and it also meant the host was structurally uncallable by any agent: an
 * AI shopping agent, a marketplace fraud filter and a customs system all had
 * exactly zero ways to ask "what is the on-chain state of token 50?".
 *
 * THE TWO HALVES HAVE OPPOSITE ACCESS RULES — this is the whole design:
 *
 *   ATTESTATION — "was this chip physically present?" Requires a tap. Cannot be
 *     produced remotely, must NOT be agent-reachable, must never be cached
 *     (the monotonic tap counter is the anti-replay mechanism). That is
 *     /api/verify and it is the moat. Nothing here weakens it.
 *
 *   ASSERTION — "what does the chain say about this token id?" Public data,
 *     already readable by anyone with an RPC URL. Gatekeeping it buys us no
 *     security and costs us every automated consumer. So: no key, no wallet, no
 *     signup, no payment, CORS-open, cacheable. That is THIS route.
 *
 * An `authentic: true` here is a claim about lifecycle state ONLY. It is not
 * evidence that anyone held the product. A caller that needs physical presence
 * must go through a tap; there is no remote substitute, by construction.
 *
 * WHERE THE BODY COMES FROM — AND WHY NOT FROM HERE
 * ────────────────────────────────────────────────
 * Every field below is built by `buildVerdict()` in @/lib/verdict. This file
 * contributes HTTP framing only: status codes, cache-control, CORS. It does not
 * know the shape of a verdict and must not learn it.
 *
 * That split exists because this is no longer the only public door. The MCP
 * server at /mcp (@/lib/mcp) answers the same question for agent callers, and it
 * calls the same builder. A verification host that answers differently on two
 * doors is worse than one that answers on neither — so there is exactly one
 * place a verdict can be constructed, and this is not it.
 *
 * DO NOT TRUST THIS API — RE-DERIVE IT. Every response pins the block it was
 * read at and returns that block's hash, so the verdict is independently
 * reproducible:
 *
 *   cast call 0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D \
 *        "getAsset(uint256)(address,uint64,uint8,uint8,uint16)" <token_id> \
 *        --block <chainRef.block_number> --rpc-url https://sepolia.base.org
 *
 * If that disagrees with what we returned, we are wrong and the chain is right.
 *
 * RESPONSE SHAPE IS A CONTRACT. An OpenAPI document, the MCP `verify_asset` tool
 * and a registry listing are generated from these exact field names. `version`
 * is the field to bump when that stops being true.
 *
 * NOT MODIFIED: /api/verify. Its docstring calls its shape a stable contract,
 * the ORACULAR mobile app consumes it, it deliberately answers 200 for a
 * counterfeit, and it has a TestFlight build imminent. The typed-error scheme
 * below applies to this route only.
 */
import { CHAIN_READ_TTL_SECONDS, neverCacheControl } from "@/lib/cache";
import { API_VERSION, buildVerdict, type VerdictErrorCode } from "@/lib/verdict";

/**
 * Rendered per request. The shared-cache TTL is asserted by the explicit
 * `cache-control` on each response below rather than by the Full Route Cache,
 * because this handler must emit DIFFERENT freshness per status: 60s for a
 * verdict, `no-store` for a 4xx/5xx. Handing a shared cache a storable 502 would
 * turn a momentary RPC blip into minutes of "chain unavailable" for every
 * caller — the same status-blind-header failure documented in src/middleware.ts.
 */
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  // Keyless and public by design: an agent, a browser page and a curl pipe all
  // reach this the same way. There is nothing here that a caller could not read
  // directly from a Base Sepolia RPC node.
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

/** 60s of staleness on a human-paced lifecycle transition is invisible, and it
 *  collapses a crawl/agent burst on one token into a single RPC read per TTL.
 *  See src/lib/cache.ts for why this is safe here and forbidden on tap routes. */
const VERDICT_CACHE_CONTROL = `public, s-maxage=${CHAIN_READ_TTL_SECONDS}, stale-while-revalidate=${CHAIN_READ_TTL_SECONDS * 5}`;

function jsonResponse(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      ...CORS_HEADERS,
    },
  });
}

/**
 * Errors are JSON with a stable `code`, never an HTML error page. A machine
 * consumer must be able to branch on the failure without scraping prose, and
 * `message` is free to be reworded while `code` is not.
 *
 * Never cached: a 404 for a token that gets minted a second later, or a 502 from
 * one bad RPC response, must not be pinned at the edge for a minute.
 */
function errorResponse(status: number, code: VerdictErrorCode, message: string): Response {
  return jsonResponse(
    { version: API_VERSION, error: { code, message } },
    status,
    neverCacheControl(),
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { tokenId: string } },
): Promise<Response> {
  const verdict = await buildVerdict(params.tokenId);
  if (!verdict.ok) return errorResponse(verdict.status, verdict.code, verdict.message);
  return jsonResponse(verdict.body, 200, VERDICT_CACHE_CONTROL);
}

/** Preflight for browser callers. Same open policy as the GET. */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": neverCacheControl(), ...CORS_HEADERS },
  });
}
