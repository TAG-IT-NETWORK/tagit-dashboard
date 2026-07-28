/**
 * GET /.well-known/mcp.json — machine-readable discovery for this MCP server.
 *
 * See @/lib/mcp/descriptor for what actually consumes this document and why it
 * is served at this path despite the path being a live proposal (SEP-1649 /
 * SEP-2127) rather than ratified spec. Short version: it is the same bytes as
 * the checked-in server.json, it costs one static route and zero chain reads,
 * and aggregators that crawl for MCP servers look here first.
 *
 * The tools are NOT enumerated in this document. The schema has no field for
 * them, and a hand-maintained copy of the tool list would be a second source of
 * truth that drifts from tools/list the first time anyone edits one and not the
 * other. A client that wants the tools calls the server.
 *
 * Cached hard, unlike everything else on this host: this file is a compile-time
 * constant with no chain read behind it, so a stale copy cannot be wrong in a
 * way that matters, and a crawler re-fetching it should never reach the origin.
 */
import { buildServerJson } from "@/lib/mcp/descriptor";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify(buildServerJson(), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      // Discovery is useless if a browser-based client cannot read it.
      "access-control-allow-origin": "*",
    },
  });
}
