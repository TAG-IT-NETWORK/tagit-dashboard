/**
 * POST /mcp — the TAG IT verification MCP server.
 *
 * THE ADDRESS IS PART OF THE CONTRACT
 * ───────────────────────────────────
 * This server lives at https://verify.tagit.network/mcp and nowhere else. It is
 * NOT api.tagit.network/asp/* — that endpoint is being decommissioned after the
 * OKX hackathon, and a registry listing pointing at it would become a
 * permanently broken URL that answer engines keep citing long after it 404s.
 * A registry entry is a durable, crawled, third-party-cached reference; the host
 * it names has to be the one we intend to keep.
 *
 * ONE MCP SERVER, AND THIS IS IT. tagit-services/src/mcp/ exists (295 lines) but
 * derives its tools from AgentRegistry skills — a different domain — and is not
 * wired into that repo's deployed api/index.ts (which serves /health, POST
 * /verify and /demo only). It was evaluated and deliberately not ported: doing
 * so would drag AgentRegistry into a verification host for no benefit and leave
 * two deployed MCP servers disagreeing about what TAG IT means. Do not deploy a
 * second one.
 *
 * WHAT IT SERVES. Three read-only tools over the same verdict the public JSON
 * route serves — see @/lib/mcp/tools for why the set is closed, and
 * @/lib/mcp/protocol for why the transport is hand-rolled rather than SDK-based.
 *
 * COST. This is a POST, so the 60s edge cache that protects /api/asset does not
 * apply and cannot be made to: shared caches do not cache POST. That leaves the
 * per-IP limiter in src/middleware.ts as the only request-side control on this
 * path, which is why the middleware matcher was extended to cover /mcp with its
 * own tighter budget (see MCP_RATE_LIMIT in @/lib/rate-limit) rather than
 * letting an uncapped RPC amplifier sit next to a carefully capped read path.
 * The honest ceiling remains the spend-capped RPC key, exactly as documented in
 * @/lib/contract.server.
 */
import { neverCacheControl } from "@/lib/cache";
import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  INVALID_REQUEST_CODE,
  PARSE_ERROR_CODE,
  SUPPORTED_PROTOCOL_VERSIONS,
  handleMessage,
  protocolError,
} from "@/lib/mcp/protocol";

/** Per request, always. Nothing on this path is cacheable — see the header. */
export const dynamic = "force-dynamic";

/**
 * CORS is open for the same reason it is open on /api/asset: everything here is
 * public chain data with no credentials attached, so there is no ambient
 * authority for a cross-origin caller to abuse. `mcp-session-id` and
 * `mcp-protocol-version` are listed because the official SDK client sends them
 * and a browser-hosted client would otherwise fail preflight.
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, accept",
  "access-control-expose-headers": "mcp-protocol-version",
  "access-control-max-age": "86400",
} as const;

function jsonResponse(body: unknown, status: number, protocolVersion: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": neverCacheControl(),
      "mcp-protocol-version": protocolVersion,
      ...CORS_HEADERS,
    },
  });
}

/** Refuse a body large enough to be an attack rather than a tool call. A
 *  three-parameter JSON-RPC message is a few hundred bytes; 64 KiB is generous
 *  by three orders of magnitude and still bounds the parse. */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  /**
   * Protocol-version header handling. Absent means 2025-03-26 per the spec's
   * backward-compatibility rule — it must NOT be treated as an error, because
   * every client written before the header existed omits it, and the very first
   * request of any session (`initialize`) legitimately has nothing to declare
   * yet.
   */
  const requested = request.headers.get("mcp-protocol-version");
  const negotiated = requested ?? DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
  if (requested !== null && !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return jsonResponse(
      protocolError(
        INVALID_REQUEST_CODE,
        `unsupported MCP-Protocol-Version: ${requested}. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
      ),
      400,
      DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse(
      protocolError(INVALID_REQUEST_CODE, `request body exceeds ${MAX_BODY_BYTES} bytes`),
      413,
      negotiated,
    );
  }

  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return jsonResponse(protocolError(PARSE_ERROR_CODE, "invalid JSON"), 400, negotiated);
  }

  if (Array.isArray(message)) {
    // JSON-RPC batching was removed from MCP in the 2025-06-18 revision. Saying
    // so beats silently processing only the first element.
    return jsonResponse(
      protocolError(
        INVALID_REQUEST_CODE,
        "JSON-RPC batching is not supported (removed from MCP in revision 2025-06-18); send one message per request",
      ),
      400,
      negotiated,
    );
  }

  const outcome = await handleMessage(message);
  if (outcome.kind === "accepted") {
    // A notification or a response: acknowledged, no body. The official SDK
    // client checks for exactly this status and skips body parsing.
    return new Response(null, {
      status: 202,
      headers: {
        "cache-control": neverCacheControl(),
        "mcp-protocol-version": negotiated,
        ...CORS_HEADERS,
      },
    });
  }

  // 200 even when the body carries a JSON-RPC error: the HTTP transport
  // succeeded, and the error belongs to the JSON-RPC layer. Mapping JSON-RPC
  // errors onto HTTP status codes is a classic way to make clients retry a
  // permanent failure.
  return jsonResponse(outcome.body, 200, negotiated);
}

/**
 * The spec requires 405 from a server that does not offer a server-initiated SSE
 * stream on GET. Answering with anything else — an HTML page, a 404 — makes a
 * conformant client believe a stream is available and then fail parsing it.
 *
 * The message is written for the human who pasted the URL into a browser,
 * because that is who actually issues this request.
 */
export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      error: "method_not_allowed",
      message:
        "This is an MCP Streamable HTTP endpoint. It speaks JSON-RPC 2.0 over POST and does " +
        "not offer a server-initiated SSE stream, so GET is not available. Add it to an MCP " +
        "client as the URL https://verify.tagit.network/mcp, or read the human-facing JSON at " +
        "https://verify.tagit.network/api/asset/5",
      tools: ["verify_asset", "get_lifecycle_history", "check_flagged"],
      descriptor: "https://verify.tagit.network/.well-known/mcp.json",
    }),
    {
      status: 405,
      headers: {
        "content-type": "application/json",
        allow: "POST, OPTIONS",
        "cache-control": neverCacheControl(),
        ...CORS_HEADERS,
      },
    },
  );
}

/** Sessions are not issued, so there is nothing for a client to terminate. */
export async function DELETE(): Promise<Response> {
  return new Response(null, {
    status: 405,
    headers: { allow: "POST, OPTIONS", "cache-control": neverCacheControl(), ...CORS_HEADERS },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": neverCacheControl(), ...CORS_HEADERS },
  });
}
