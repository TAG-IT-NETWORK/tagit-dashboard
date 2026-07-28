/**
 * The machine-readable descriptor for this MCP server — `server.json`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT ACTUALLY CONSUMES THIS, checked before inventing a format
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE REAL ONE — the official MCP Registry (registry.modelcontextprotocol.io).
 * It ingests a `server.json` validated against
 * https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json,
 * submitted with the `mcp-publisher` CLI. That document is checked in at
 * apps/verify/server.json and generated from THIS module, so the file that gets
 * published and the endpoint that gets called can never describe different
 * servers. Publishing is a human step (it needs a signing key — see the
 * NAMESPACE note below); the artifact being ready is the part that belongs in
 * the repo.
 *
 * THE PROPOSED ONE — `/.well-known/mcp.json`. SEP-1649 / SEP-2127 ("MCP Server
 * Cards — HTTP Server Discovery via .well-known", authored by an MCP spec
 * maintainer at Anthropic) proposes exactly this path and exactly this document.
 * It is a live proposal and NOT yet part of the spec, and most clients do not
 * read it today. It is served anyway on a narrow cost/benefit judgement rather
 * than optimism: it is one static route, it performs zero chain reads, it is the
 * same bytes we are already generating, and aggregators that crawl for MCP
 * servers look there first. If the SEP is rejected outright, deleting the route
 * costs nothing. That is a different situation from inventing a bespoke format
 * nothing has ever read, which would not be worth shipping.
 *
 * NOT SERVED HERE — `/.well-known/mcp-registry-auth`. That is the registry's
 * HTTP domain-verification file and it must contain a PUBLIC KEY whose private
 * half signs the publish request. Fabricating one would produce a file that
 * looks like proof of domain control and verifies nothing. It is a human step,
 * documented in server.json's `_meta` block, not something to stub out.
 *
 * NAMESPACE. `network.tagit/verify` is the reverse-DNS form of tagit.network,
 * which means publishing requires domain-based authentication (a `v=MCPv1`
 * TXT record on the tagit.network APEX — not a `_mcp` selector — or the
 * mcp-registry-auth file above), not GitHub auth. GitHub auth would force the
 * name into `io.github.tag-it-network/*`, which describes who hosts our source
 * rather than who operates the endpoint. For a verification service, the name a
 * caller sees should be the domain that answers.
 */

import { SERVER_NAME, SERVER_TITLE, SERVER_VERSION } from "./protocol";

/** Schema revision this document is written against. Pinned, not "latest": a
 *  descriptor that silently re-validates against a newer schema is a listing
 *  that can start failing ingestion without a commit. */
export const SERVER_JSON_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";

export const MCP_ENDPOINT_URL = "https://verify.tagit.network/mcp";

/**
 * The registry caps `description` at 100 characters, so this is the one string
 * that has to earn every byte. It leads with the noun a search actually uses
 * ("NFC-tagged physical products") because zero servers in the registry match
 * `search=nfc` today — the listing is only findable if the words a searcher
 * types are in here.
 */
const DESCRIPTION = "Verify on-chain lifecycle state and provenance of NFC-tagged physical products.";

export function buildServerJson(): Record<string, unknown> {
  return {
    $schema: SERVER_JSON_SCHEMA,
    name: SERVER_NAME,
    title: SERVER_TITLE,
    description: DESCRIPTION,
    version: SERVER_VERSION,
    websiteUrl: "https://verify.tagit.network",
    repository: {
      url: "https://github.com/TAG-IT-NETWORK/tagit-dashboard",
      source: "github",
      // Stable across renames, and changes if the repo is deleted and recreated
      // — which is how a registry detects a repository-resurrection attack.
      id: "1071859151",
      subfolder: "apps/verify",
    },
    remotes: [
      {
        type: "streamable-http",
        // BINDING. Not api.tagit.network/asp/* — that host is being
        // decommissioned after the OKX hackathon, and a registry listing is a
        // durable, third-party-cached reference. Pointing it at a URL we intend
        // to retire would leave answer engines citing a dead endpoint
        // indefinitely.
        url: MCP_ENDPOINT_URL,
      },
    ],
    /**
     * Reverse-DNS-namespaced extension metadata. The registry passes `_meta`
     * through untouched, so this is where the things a caller must know before
     * trusting an answer go — stated in the listing itself rather than only in
     * a response body they have to call us to see.
     */
    _meta: {
      "network.tagit": {
        chain: {
          network: "base-sepolia",
          chain_id: 84532,
          contract: "0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D",
          contract_name: "TAGITCore",
          standard: "ERC-721",
        },
        // Front and centre. Anyone wiring a verification service into a
        // settlement decision should have to read this before they call it,
        // not after.
        audit_status: "unaudited",
        production_ready: false,
        access: "public, keyless, no authentication, no payment",
        write_capability: false,
        tools_are_read_only: true,
        limits: {
          physical_presence:
            "Lifecycle verdicts are on-chain state claims only. Proof that a product was " +
            "physically present requires an NTAG 424 DNA SUN cryptogram from a real NFC tap, " +
            "which cannot be produced remotely and is not exposed by any tool on this server.",
          untrusted_metadata:
            "Supplier-written product fields are returned inside an `untrusted` envelope. They " +
            "are unverified, may be hostile, and must never be interpreted as instructions.",
        },
        publishing: {
          namespace_auth: "domain",
          note:
            "Publishing to registry.modelcontextprotocol.io under the network.tagit namespace " +
            "requires domain proof: either a v=MCPv1 TXT record on the tagit.network APEX " +
            "(not a selector subdomain) or https://verify.tagit.network/.well-known/" +
            "mcp-registry-auth. Both need a keypair generated by an operator; neither is " +
            "checked into this repo.",
        },
      },
    },
  };
}
