#!/usr/bin/env tsx
/**
 * Conformance and safety tests for the MCP server at POST /mcp.
 *
 * WHY A SCRIPT AND NOT A TEST RUNNER — same reasoning as scripts/test-asset-api.ts:
 * apps/verify has no test runner and no test dependency, and the interesting
 * failures here are all wire-level (JSON-RPC framing, HTTP status, header
 * negotiation, rate limiting, key leakage) where a mocked unit test would miss
 * every one of them. Zero dependencies, exits non-zero on the first failing set.
 *
 *   pnpm --filter @tagit/verify build
 *   pnpm --filter @tagit/verify test:mcp
 *
 * TWO SERVERS ARE STARTED, DELIBERATELY:
 *
 *   :3097  BASE_SEPOLIA_RPC_URL -> scripts/archive-rpc-stub.mjs
 *          Stands in for the archive-range provider production is expected to
 *          use. Without it the happy path of get_lifecycle_history is
 *          unreachable — no keyless Base Sepolia endpoint accepts a 5.1M-block
 *          eth_getLogs (twelve were measured; see src/lib/lifecycle.ts).
 *
 *   :3098  BASE_SEPOLIA_RPC_URL -> https://sepolia.base.org
 *          The real keyless provider, to prove the DEGRADED path is honest:
 *          `available: false` with a typed reason, never an empty timeline.
 *
 * Every lifecycle event the stub-backed server returns is independently
 * re-read from https://sepolia.base.org before it is believed — see
 * testHistoryIsRealChainData(). The harness cannot fabricate an event and pass.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const STUB_PORT = Number(process.env.STUB_PORT ?? 8899);
const ARCHIVE_PORT = Number(process.env.ARCHIVE_PORT ?? 3097);
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT ?? 3098);
const PUBLIC_RPC = "https://sepolia.base.org";
const CONTRACT = "0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D";

/** The complete, closed tool set. See the header of src/lib/mcp/tools.ts. */
const EXPECTED_TOOLS = ["verify_asset", "get_lifecycle_history", "check_flagged"].sort();

/** Live-chain expectations (Base Sepolia, TAGITCore 0x3aDc…1d1D). */
const TOKEN_CLAIMED = 5;
const TOKEN_FLAGGED = 35;
const TOKEN_UNMINTED = 999999999;

let failures = 0;
let checks = 0;

function ok(condition: boolean, label: string, detail?: unknown): void {
  checks++;
  if (condition) {
    console.log(`  PASS  ${label}`);
    return;
  }
  failures++;
  console.log(`  FAIL  ${label}${detail === undefined ? "" : `\n        got: ${JSON.stringify(detail)}`}`);
}

function eq(actual: unknown, expected: unknown, label: string): void {
  ok(Object.is(actual, expected), `${label} === ${JSON.stringify(expected)}`, actual);
}

function section(name: string): void {
  console.log(`\n${name}`);
}

// ── JSON-RPC helpers ────────────────────────────────────────────────────────
interface Wire {
  status: number;
  headers: Headers;
  text: string;
  json: any;
}

/**
 * A FRESH client identity per request.
 *
 * /mcp is limited to MCP_RATE_LIMIT (20) calls per IP per minute, and this suite
 * makes far more than that. Without rotation the limiter throttles the tests
 * themselves — which it did on the first run, turning a dozen unrelated
 * assertions into confusing failures partway down the file. Rotating here keeps
 * the limiter's real behaviour under test in exactly one place
 * (testRateLimit), where it is asserted deliberately with a FIXED identity.
 *
 * 198.18.0.0/15 is the RFC 2544 benchmarking range: reserved, never routed, and
 * unambiguous in a log as "a test made this up".
 */
let clientCounter = 0;
function freshClientIp(): string {
  clientCounter++;
  return `198.18.${Math.floor(clientCounter / 250) % 250}.${clientCounter % 250}`;
}

async function rpc(port: number, body: unknown, init: RequestInit = {}): Promise<Wire> {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-forwarded-for": freshClientIp(),
      ...(init.headers as Record<string, string> | undefined),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* left null so a caller can assert "this was not JSON" */
  }
  return { status: res.status, headers: res.headers, text, json };
}

let nextId = 1;
async function call(port: number, name: string, args: Record<string, unknown>): Promise<Wire> {
  return rpc(port, {
    jsonrpc: "2.0",
    id: nextId++,
    method: "tools/call",
    params: { name, arguments: args },
  });
}

function structured(wire: Wire): any {
  return wire.json?.result?.structuredContent;
}

// ── the closed tool set ─────────────────────────────────────────────────────
/**
 * THE GUARD. If someone adds a fourth tool, this fails.
 *
 * That is the entire point and it is not an inconvenience to route around. This
 * server is keyless and unauthenticated; the claim "it cannot mutate anything"
 * is only true while the tool list stays exactly these three reads. Editing
 * EXPECTED_TOOLS to make a new tool pass is editing the security boundary, and
 * it should feel like it.
 */
async function testToolAllowlist(port: number): Promise<void> {
  section("tools/list — the tool set is closed and read-only");
  const r = await rpc(port, { jsonrpc: "2.0", id: nextId++, method: "tools/list" });
  eq(r.status, 200, "status");

  const tools = r.json?.result?.tools ?? [];
  const names = tools.map((t: any) => t.name).sort();
  eq(names.length, 3, "exactly three tools are registered");
  eq(
    JSON.stringify(names),
    JSON.stringify(EXPECTED_TOOLS),
    "tool set is EXACTLY {verify_asset, get_lifecycle_history, check_flagged}",
  );

  /**
   * An independent tripwire on the LEADING VERB of every tool name.
   *
   * MCP tool names are verb-first (`verify_asset`, `get_lifecycle_history`), so
   * a custody mutation would arrive as `flag_asset`, `transfer_asset`,
   * `mint_token`. Matching the leading verb catches those while leaving
   * `check_flagged` alone — a bare substring test flags that name for containing
   * "flag", which is a false positive on a read tool whose whole job is to
   * report the flag. (It fired on the first run of this suite, which is why the
   * check is written this way.)
   */
  const MUTATING_VERBS = [
    "transfer", "flag", "unflag", "mint", "burn", "claim", "bind", "unbind",
    "activate", "deactivate", "recycle", "resolve", "write", "send", "sign",
    "approve", "revoke", "set", "update", "create", "delete", "execute", "submit",
  ];
  for (const name of names) {
    const verb = name.split("_")[0];
    ok(
      !MUTATING_VERBS.includes(verb),
      `tool "${name}" does not lead with a mutating verb`,
      verb,
    );
  }

  for (const tool of tools) {
    ok(tool.annotations?.readOnlyHint === true, `${tool.name}: annotations.readOnlyHint is true`);
    ok(
      tool.annotations?.destructiveHint === false,
      `${tool.name}: annotations.destructiveHint is false`,
    );
    ok(typeof tool.description === "string" && tool.description.length > 80, `${tool.name}: has a substantive description`);
    eq(tool.inputSchema?.type, "object", `${tool.name}: inputSchema is an object schema`);
    ok(
      Array.isArray(tool.inputSchema?.required) && tool.inputSchema.required.includes("token_id"),
      `${tool.name}: requires token_id`,
    );
  }

  ok(
    /not proof of physical presence|not evidence/i.test(
      tools.find((t: any) => t.name === "verify_asset")?.description ?? "",
    ),
    "verify_asset description states the physical-presence limit",
  );
}

// ── handshake ───────────────────────────────────────────────────────────────
async function testHandshake(port: number): Promise<void> {
  section("initialize — handshake and negotiation");

  const r = await rpc(port, {
    jsonrpc: "2.0",
    id: nextId++,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "0" } },
  });
  eq(r.status, 200, "status");
  eq(r.json?.result?.protocolVersion, "2025-11-25", "echoes a supported protocol version");
  eq(r.json?.result?.serverInfo?.name, "network.tagit/verify", "serverInfo.name is the reverse-DNS id");
  ok(r.json?.result?.capabilities?.tools !== undefined, "advertises the tools capability");
  ok(
    !("resources" in (r.json?.result?.capabilities ?? {})),
    "does NOT advertise capabilities it has no handler for",
  );

  const instructions: string = r.json?.result?.instructions ?? "";
  ok(instructions.length > 400, "instructions are served on initialize", instructions.length);
  ok(/READ-ONLY/.test(instructions), "instructions state the server is read-only");
  ok(/NOT evidence that anyone\s+physically held/i.test(instructions.replace(/\n/g, " ")) || /physically held/i.test(instructions), "instructions state the physical-presence limit");
  ok(/TESTNET/.test(instructions), "instructions state this is testnet data");
  ok(/NOT been externally audited|not been externally audited/i.test(instructions), "instructions state the contract is unaudited");
  ok(/never instructions/i.test(instructions), "instructions state the prompt-injection rule for metadata");

  const older = await rpc(port, {
    jsonrpc: "2.0",
    id: nextId++,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
  });
  eq(older.json?.result?.protocolVersion, "2025-06-18", "negotiates down to an older supported version");

  const unknown = await rpc(port, {
    jsonrpc: "2.0",
    id: nextId++,
    method: "initialize",
    params: { protocolVersion: "1999-01-01", capabilities: {}, clientInfo: { name: "t", version: "0" } },
  });
  eq(
    unknown.json?.result?.protocolVersion,
    "2025-11-25",
    "an unknown requested version falls back to ours rather than failing the handshake",
  );
}

// ── JSON-RPC framing ────────────────────────────────────────────────────────
async function testFraming(port: number): Promise<void> {
  section("JSON-RPC 2.0 framing");

  const ping = await rpc(port, { jsonrpc: "2.0", id: nextId++, method: "ping" });
  eq(ping.status, 200, "ping status");
  ok(ping.json?.result !== undefined && Object.keys(ping.json.result).length === 0, "ping returns an empty result");

  const notification = await rpc(port, { jsonrpc: "2.0", method: "notifications/initialized" });
  eq(notification.status, 202, "a notification gets 202 Accepted");
  eq(notification.text, "", "a notification gets NO body (a result here hangs some clients)");

  const badJson = await rpc(port, "{not json");
  eq(badJson.status, 400, "malformed JSON status");
  eq(badJson.json?.error?.code, -32700, "malformed JSON is a JSON-RPC parse error");

  const batch = await rpc(port, [{ jsonrpc: "2.0", id: 1, method: "ping" }]);
  eq(batch.status, 400, "a JSON-RPC batch is rejected (removed from MCP in 2025-06-18)");
  eq(batch.json?.error?.code, -32600, "batch rejection is an invalid-request error");

  const badVersion = await rpc(port, { jsonrpc: "1.0", id: nextId++, method: "ping" });
  eq(badVersion.json?.error?.code, -32600, "jsonrpc != 2.0 is an invalid request");

  const unknownMethod = await rpc(port, { jsonrpc: "2.0", id: nextId++, method: "no/such/method" });
  eq(unknownMethod.status, 200, "an unknown method is HTTP 200 (the transport succeeded)");
  eq(unknownMethod.json?.error?.code, -32601, "an unknown method is method-not-found");

  const unknownTool = await call(port, "transfer_asset", { token_id: 5 });
  eq(unknownTool.json?.error?.code, -32602, "an unknown tool is a protocol error, not a tool result");
  ok(
    Array.isArray(unknownTool.json?.error?.data?.available_tools),
    "the unknown-tool error lists what IS available",
  );

  section("protocol-version header");
  const withHeader = await rpc(port, { jsonrpc: "2.0", id: nextId++, method: "ping" }, {
    headers: { "mcp-protocol-version": "2025-06-18" },
  });
  eq(withHeader.status, 200, "a supported MCP-Protocol-Version header is accepted");
  eq(withHeader.headers.get("mcp-protocol-version"), "2025-06-18", "the negotiated version is echoed");

  const badHeader = await rpc(port, { jsonrpc: "2.0", id: nextId++, method: "ping" }, {
    headers: { "mcp-protocol-version": "1999-01-01" },
  });
  eq(badHeader.status, 400, "an unsupported MCP-Protocol-Version header is 400");

  const noHeader = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": freshClientIp() },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "ping" }),
  });
  eq(noHeader.status, 200, "a MISSING protocol-version header is fine (pre-header clients)");

  section("HTTP surface");
  const get = await fetch(`http://127.0.0.1:${port}/mcp`);
  eq(get.status, 405, "GET /mcp is 405 (no server-initiated SSE stream offered)");
  eq(get.headers.get("allow"), "POST, OPTIONS", "405 names the allowed methods");

  const preflight = await fetch(`http://127.0.0.1:${port}/mcp`, { method: "OPTIONS" });
  eq(preflight.status, 204, "OPTIONS preflight status");
  eq(preflight.headers.get("access-control-allow-origin"), "*", "CORS is open");

  const oversize = await rpc(port, { jsonrpc: "2.0", id: 1, method: "ping", params: { pad: "x".repeat(70_000) } });
  eq(oversize.status, 413, "an oversized body is refused before parsing");
}

// ── the verdict, and its parity with the HTTP door ──────────────────────────
/**
 * THE PARITY ASSERTION — the reason @/lib/verdict exists.
 *
 * A verification host that answers differently on two doors is worse than one
 * that answers on neither, because the disagreement is invisible to both callers
 * and whichever is wrong still carries our name. This compares the live JSON
 * route against the live MCP tool, key for key.
 *
 * chainRef.block_number / block_hash are excluded because the two reads pin to
 * the chain head at slightly different moments; every other field must match
 * exactly, INCLUDING the untrusted envelope and the owner commitment.
 */
async function testVerdictParity(port: number): Promise<void> {
  section("verify_asset — byte-identical to GET /api/asset/{tokenId}");

  const httpDoor = await fetch(`http://127.0.0.1:${port}/api/asset/${TOKEN_CLAIMED}`);
  const httpBody = await httpDoor.json();
  const mcp = await call(port, "verify_asset", { token_id: TOKEN_CLAIMED });
  const mcpBody = structured(mcp);

  eq(httpDoor.status, 200, "HTTP door status");
  eq(mcp.json?.result?.isError, false, "MCP door is not an error");

  eq(
    JSON.stringify(Object.keys(httpBody).sort()),
    JSON.stringify(Object.keys(mcpBody ?? {}).sort()),
    "both doors return the SAME key set",
  );

  const volatile = new Set(["block_number", "block_hash"]);
  const strip = (o: any) => ({
    ...o,
    chainRef: Object.fromEntries(Object.entries(o.chainRef).filter(([k]) => !volatile.has(k))),
  });
  eq(
    JSON.stringify(strip(mcpBody)),
    JSON.stringify(strip(httpBody)),
    "both doors return IDENTICAL values (excluding the block they pinned to)",
  );

  ok(
    /^0x[0-9a-f]{64}$/.test(mcpBody.chainRef.block_hash) && mcpBody.chainRef.block_number > 0,
    "the MCP verdict carries a re-derivable chainRef",
  );

  section("verify_asset — content and structuredContent agree");
  const content = mcp.json?.result?.content ?? [];
  ok(content.length >= 2, "both a summary and the full JSON are returned as content");
  eq(content[0]?.type, "text", "content[0] is text");
  const parsed = JSON.parse(content[1].text);
  eq(JSON.stringify(parsed), JSON.stringify(mcpBody), "content JSON === structuredContent");
  ok(/not proof of physical presence|Lifecycle state only/i.test(content[0].text), "the summary restates the physical-presence limit");
  ok(/[Uu]naudited/.test(content[0].text), "the summary restates the audit status");
}

async function testProvenanceFields(port: number): Promise<void> {
  section("every payload states network / audit_status / production_ready");
  for (const tool of EXPECTED_TOOLS) {
    const r = await call(port, tool, { token_id: TOKEN_CLAIMED });
    const s = structured(r);
    eq(s?.network, "base-sepolia", `${tool}: network`);
    eq(s?.audit_status, "unaudited", `${tool}: audit_status`);
    eq(s?.production_ready, false, `${tool}: production_ready`);
  }

  section("typed errors carry provenance too");
  const missing = await call(port, "verify_asset", { token_id: TOKEN_UNMINTED });
  eq(missing.json?.result?.isError, true, "an unminted token is a tool-level error");
  eq(structured(missing)?.error?.code, "ASSET_NOT_FOUND", "unminted token code");
  eq(structured(missing)?.audit_status, "unaudited", "the error payload still states audit_status");

  for (const bad of ["notanumber", "-1", "1.5", "0x1f", 1.5, true, null, {}]) {
    const r = await call(port, "verify_asset", { token_id: bad as never });
    eq(structured(r)?.error?.code, "INVALID_TOKEN_ID", `malformed token_id ${JSON.stringify(bad)}`);
  }
  const huge = await call(port, "verify_asset", { token_id: (2n ** 256n).toString() });
  eq(structured(huge)?.error?.code, "INVALID_TOKEN_ID", "2^256 is rejected");
}

// ── check_flagged ───────────────────────────────────────────────────────────
async function testCheckFlagged(port: number): Promise<void> {
  section(`check_flagged — token ${TOKEN_FLAGGED} (FLAGGED) and token ${TOKEN_CLAIMED} (not flagged)`);

  const flagged = structured(await call(port, "check_flagged", { token_id: TOKEN_FLAGGED }));
  eq(flagged.flagged, true, `token ${TOKEN_FLAGGED} flagged`);
  eq(flagged.state, "FLAGGED", `token ${TOKEN_FLAGGED} state`);
  eq(flagged.state_code, 5, `token ${TOKEN_FLAGGED} state_code`);
  ok(typeof flagged.reason === "string" && flagged.reason.length > 60, "a flagged asset carries a reason");
  ok(
    /not exposed by a public getter/i.test(flagged.reason),
    "the reason is honest that the on-chain bytes32 cause is unreadable, rather than inventing one",
  );

  const clean = structured(await call(port, "check_flagged", { token_id: TOKEN_CLAIMED }));
  eq(clean.flagged, false, `token ${TOKEN_CLAIMED} not flagged`);
  eq(clean.reason, null, "a non-flagged asset has a null reason (no invented narrative)");
  eq(clean.state, "CLAIMED", `token ${TOKEN_CLAIMED} state`);

  // The dangerous-reassurance guard: `flagged:false` must never travel alone.
  for (const s of [flagged, clean]) {
    ok("state" in s && "state_code" in s && "authentic" in s, "flagged is returned WITH state and authentic");
  }
}

// ── lifecycle history ───────────────────────────────────────────────────────
/**
 * Re-read every returned event straight from the Base public node.
 *
 * The archive stub that makes the happy path reachable is backed by a
 * third-party index. That is acceptable in a harness ONLY because of this
 * function: each event is re-fetched with a one-block eth_getLogs against
 * https://sepolia.base.org and compared on transaction hash, log index and
 * topics. A fabricated or dropped event cannot survive it.
 */
async function testHistoryIsRealChainData(events: any[]): Promise<void> {
  section("get_lifecycle_history — every event re-verified against sepolia.base.org");
  ok(events.length > 0, "there are events to verify");

  const tokenTopic = `0x${TOKEN_CLAIMED.toString(16).padStart(64, "0")}`;
  let verified = 0;

  for (const event of events) {
    const res = await fetch(PUBLIC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [
          {
            address: CONTRACT,
            fromBlock: `0x${event.block_number.toString(16)}`,
            toBlock: `0x${event.block_number.toString(16)}`,
            topics: [null, tokenTopic],
          },
        ],
      }),
    });
    const body = await res.json();
    const match = (body.result ?? []).find(
      (log: any) =>
        log.transactionHash === event.transaction_hash &&
        Number(BigInt(log.logIndex)) === event.log_index,
    );
    if (match && match.topics?.[1] === tokenTopic) verified++;
  }

  eq(verified, events.length, "every returned event exists on-chain at the block/logIndex reported");
}

async function testLifecycleHistory(port: number): Promise<any[]> {
  section(`get_lifecycle_history — token ${TOKEN_CLAIMED} against an archive-range provider`);

  const r = await call(port, "get_lifecycle_history", { token_id: TOKEN_CLAIMED });
  const s = structured(r);
  eq(r.json?.result?.isError, false, "not an error");
  eq(s.available, true, "history is available");
  eq(s.scan.requests, 1, "an archive-range provider needs exactly ONE eth_getLogs");
  eq(s.scan.from_block, 39611546, "the scan starts at the empirically-determined deployment block");
  eq(s.event_count, s.events.length, "event_count matches the array");

  const blocks = s.events.map((e: any) => e.block_number);
  ok(
    blocks.every((b: number, i: number) => i === 0 || b >= blocks[i - 1]),
    "events are ordered OLDEST FIRST",
    blocks,
  );

  eq(s.events[0].type, "AssetMinted", "the first event is the mint (the history is not truncated)");

  const types = new Set(s.events.map((e: any) => e.type));
  ok(types.has("StateChanged"), "StateChanged events are decoded");
  ok(types.has("TagBound"), "TagBound events are decoded");

  // A coherent chain: each StateChanged must leave the state the previous one entered.
  const transitions = s.events.filter((e: any) => e.type === "StateChanged");
  let coherent = true;
  for (let i = 1; i < transitions.length; i++) {
    if (transitions[i].from_state_code !== transitions[i - 1].to_state_code) coherent = false;
  }
  ok(coherent, "the state transitions form an unbroken chain", transitions.map((t: any) => `${t.from_state}->${t.to_state}`));
  eq(transitions[0].from_state_code, 0, "the first transition leaves NONE");

  for (const e of s.events) {
    ok(Number.isInteger(e.block_number) && e.block_number > 0, "event has a block number");
    ok(/^0x[0-9a-f]{64}$/.test(e.transaction_hash), "event has a transaction hash (re-derivable)");
  }

  section("get_lifecycle_history — the per-instance memo tops up instead of rescanning");
  const warm = structured(await call(port, "get_lifecycle_history", { token_id: TOKEN_CLAIMED }));
  eq(warm.event_count, s.event_count, "a warm call returns the same events");
  eq(warm.scan.from_block, 39611546, "a warm call still reports the FULL scanned span, not the top-up window");

  return s.events;
}

/**
 * The behaviour that actually ships on a keyless provider. This is the section
 * that would catch the worst possible regression in this tool: reporting "no
 * history" when the truth is "could not look".
 */
async function testLifecycleDegradesHonestly(port: number): Promise<void> {
  section("get_lifecycle_history — degrades HONESTLY on a range-capped provider");

  const s = structured(await call(port, "get_lifecycle_history", { token_id: TOKEN_CLAIMED }));
  eq(s.available, false, "a 2000-block-capped provider cannot serve the scan");
  eq(s.events, null, "events is NULL, never [] — 'could not look' is not 'there is nothing'");
  eq(s.unavailable.code, "PROVIDER_RANGE_LIMIT", "the reason is typed");
  eq(s.unavailable.provider_max_block_range, 2000, "the provider's own advertised cap is reported");
  ok(s.unavailable.requests_required > 2000, "the number of requests the scan would need is reported", s.unavailable.requests_required);
  eq(s.unavailable.request_budget, 8, "the budget is reported");
  ok(/NOT a statement that the token has no history/i.test(s.unavailable.message), "the message forbids reading it as an empty timeline");
  ok(typeof s.unavailable.re_derive === "string" && s.unavailable.re_derive.includes("cast logs"), "a re-derivation command is supplied");

  // The verdict tools must be completely unaffected by the history limitation.
  const verdict = structured(await call(port, "verify_asset", { token_id: TOKEN_CLAIMED }));
  eq(verdict.state, "CLAIMED", "verify_asset still works on the same provider");
  eq(structured(await call(port, "check_flagged", { token_id: TOKEN_FLAGGED })).flagged, true, "check_flagged still works");
}

// ── privacy and secret hygiene ──────────────────────────────────────────────
function walkStrings(value: unknown, visit: (s: string, path: string) => void, path = "$"): void {
  if (typeof value === "string") return visit(value, path);
  if (Array.isArray(value)) return value.forEach((v, i) => walkStrings(v, visit, `${path}[${i}]`));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkStrings(v, visit, `${path}.${k}`);
  }
}

/**
 * Two leaks, both of which have actually happened on this project.
 *
 * 1. RAW OWNER ADDRESSES. The bulk goods->wallet scrape that owner_commitment
 *    exists to close would reopen the moment a lifecycle event returned
 *    AssetMinted.to or StateChanged.actor unhashed.
 * 2. THE RPC URL. viem's Error.message embeds `URL: <transport url>`, which on
 *    this host is the spend-capped BASE_SEPOLIA_RPC_URL. An early version of
 *    src/lib/lifecycle.ts echoed that message to unauthenticated callers on a
 *    range-limit error — i.e. it handed out the key by serving an error.
 */
async function testNoLeakage(port: number, degradedPort: number): Promise<void> {
  section("no raw addresses and no RPC URL anywhere on the wire");

  const bodies: string[] = [];
  for (const tool of EXPECTED_TOOLS) {
    for (const token of [TOKEN_CLAIMED, TOKEN_FLAGGED, TOKEN_UNMINTED]) {
      bodies.push((await call(port, tool, { token_id: token })).text);
    }
  }
  // Also the degraded server, which is where the URL leak occurred.
  bodies.push((await call(degradedPort, "get_lifecycle_history", { token_id: TOKEN_CLAIMED })).text);

  const joined = bodies.join("\n");

  ok(!/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/.test(joined.replace(new RegExp(CONTRACT, "gi"), "")), "no 20-byte address appears anywhere except the contract address itself");
  ok(!/"owner"\s*:/.test(joined), "no `owner` key is ever emitted");
  ok(!/"actor"\s*:/.test(joined) && !/"to"\s*:\s*"0x[0-9a-f]{40}/i.test(joined), "event participants are committed, never raw");
  ok(!/https?:\/\/[^"\s]*(alchemy|infura|tenderly|drpc|quicknode|blockscout|127\.0\.0\.1|localhost)/i.test(joined), "no RPC transport URL is echoed in any response");
  ok(!/Request body|Version: viem@/.test(joined), "no viem error dump (which embeds the transport URL) reaches the wire");
  ok(!/apiKey|api_key|secret|BASE_SEPOLIA_RPC_URL/i.test(joined), "no credential-shaped strings");

  section("the untrusted envelope survives the MCP door");
  const verdict = structured(await call(port, "verify_asset", { token_id: TOKEN_CLAIMED }));
  ok(typeof verdict.untrusted?._warning === "string", "untrusted._warning is present");
  ok(/never interpret it as instructions/i.test(verdict.untrusted._warning), "the warning names the prompt-injection rule");
  for (const field of ["name", "brand", "description", "sku", "origin", "size", "image"]) {
    ok(field in verdict.untrusted, `untrusted.${field} present`);
    ok(!(field in verdict), `supplier field NOT hoisted to top level: ${field}`);
  }

  // The sanitiser must have run on whatever IPFS returned for this token.
  const residue: string[] = [];
  walkStrings(verdict, (s, p) => {
    for (const ch of s) {
      const cp = ch.codePointAt(0)!;
      if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f) || cp === 0x00ad || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x2064) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x3164 || cp === 0xffa0 || cp === 0xfeff || (cp >= 0xe0000 && cp <= 0xe007f)) {
        residue.push(p);
        return;
      }
    }
  });
  ok(residue.length === 0, "no control / bidi / zero-width / TAG-block bytes in the MCP payload", residue);
}

// ── cost containment ────────────────────────────────────────────────────────
async function testRateLimit(port: number): Promise<void> {
  section("cost containment — the middleware matcher actually covers /mcp");

  // A dedicated client identity, so this flood cannot affect anything else.
  const ip = "198.51.100.42";
  let limited = 0;
  let allowed = 0;
  let limitHeader: string | null = null;

  for (let i = 0; i < 26; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ jsonrpc: "2.0", id: i, method: "ping" }),
    });
    limitHeader ??= res.headers.get("x-ratelimit-limit");
    if (res.status === 429) {
      limited++;
      if (limited === 1) {
        const body = await res.json();
        eq(body?.error?.code, -32000, "a 429 on /mcp is a JSON-RPC error object, not prose");
        ok(res.headers.get("retry-after") !== null, "the 429 carries retry-after");
        ok(/no-store/.test(res.headers.get("cache-control") ?? ""), "the 429 is not cacheable");
      } else {
        await res.text();
      }
    } else {
      allowed++;
      await res.text();
    }
  }

  ok(limited > 0, "/mcp IS rate limited — the middleware matcher covers it", { allowed, limited });
  eq(limitHeader, "20", "/mcp advertises its own tighter budget (MCP_RATE_LIMIT), not the 60 used for reads");

  // And the asset path must still work: separate counter bucket.
  const asset = await fetch(`http://127.0.0.1:${port}/api/asset/${TOKEN_CLAIMED}`, {
    headers: { "x-forwarded-for": ip },
  });
  eq(asset.status, 200, "flooding /mcp does NOT lock the same IP out of /api/asset (separate buckets)");
}

// ── discovery ───────────────────────────────────────────────────────────────
async function testDiscovery(port: number): Promise<void> {
  section("discovery — /.well-known/mcp.json and robots.txt");

  const res = await fetch(`http://127.0.0.1:${port}/.well-known/mcp.json`);
  eq(res.status, 200, "descriptor is served");
  const doc = await res.json();
  eq(doc.name, "network.tagit/verify", "descriptor name matches serverInfo.name");
  eq(doc.remotes?.[0]?.type, "streamable-http", "declares the streamable-http transport");
  eq(
    doc.remotes?.[0]?.url,
    "https://verify.tagit.network/mcp",
    "THE BINDING ADDRESS — never api.tagit.network/asp/*, which is being decommissioned",
  );
  ok(!/api\.tagit\.network/.test(JSON.stringify(doc)), "the decommissioned host appears nowhere in the descriptor");
  ok(doc.description.length <= 100, "description is within the registry's 100-char cap", doc.description.length);
  ok(/nfc/i.test(doc.description), "description contains the term a searcher would type");
  eq(doc._meta?.["network.tagit"]?.audit_status, "unaudited", "the listing itself discloses the audit status");
  eq(doc._meta?.["network.tagit"]?.write_capability, false, "the listing itself discloses there is no write capability");

  const robots = await (await fetch(`http://127.0.0.1:${port}/robots.txt`)).text();
  ok(/Disallow: \/mcp/.test(robots), "robots.txt disallows /mcp (POST endpoint, zero crawl value, real cost)");
  ok(/Allow: \/\.well-known\/mcp\.json/.test(robots), "robots.txt allows the descriptor (the discovery path)");

  /**
   * DRIFT GUARD. apps/verify/server.json is the document submitted to
   * registry.modelcontextprotocol.io with `mcp-publisher`; /.well-known/mcp.json
   * is what a crawler reads. They are generated from the same module and must
   * stay byte-identical — a registry listing describing a different server from
   * the one that answers is exactly the kind of durable, widely-cached wrong
   * answer this endpoint exists to avoid.
   *
   * Regenerate after changing src/lib/mcp/descriptor.ts:
   *   curl -s http://127.0.0.1:3097/.well-known/mcp.json -o server.json
   */
  const checkedIn = JSON.parse(
    await readFile(new URL("../server.json", import.meta.url), "utf8"),
  );
  eq(
    JSON.stringify(checkedIn),
    JSON.stringify(doc),
    "checked-in server.json is identical to the served /.well-known/mcp.json",
  );
  eq(
    checkedIn.$schema,
    "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    "server.json pins a specific schema revision (not 'latest')",
  );
  for (const required of ["name", "description", "version"]) {
    ok(required in checkedIn, `server.json has the registry-required field: ${required}`);
  }
}

// ── server lifecycle ────────────────────────────────────────────────────────
/*
 * THE STALE-SERVER HAZARD — the same one documented at length in
 * scripts/test-asset-api.ts, and it bit again while writing this file.
 *
 * `next start` forks the real listener as a SEPARATE `next-server` child, so
 * killing the wrapper by process-name pattern leaves a grandchild alive holding
 * the port. The next run then binds nothing (EADDRINUSE, easy to miss), probes
 * the LEAKED listener, and asserts against the PREVIOUS build. Measured during
 * development: a genuine bug fix appeared to have no effect for two full
 * rebuild cycles because every request was being served by a stale process.
 *
 * Defences, all required: refuse to start on an occupied port, spawn detached so
 * the wrapper leads its own process group, signal the GROUP, and fail loudly if
 * the port is not released.
 */
function portInUse(port: number, timeoutMs = 1_000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (inUse: boolean) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function waitForPortFree(port: number, timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await portInUse(port))) return true;
    await sleep(250);
  }
  return false;
}

const children: Array<{ child: ChildProcess; port: number; log: () => string }> = [];

function killGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

async function startServer(port: number, rpcUrl: string): Promise<void> {
  if (await portInUse(port)) {
    throw new Error(
      `port ${port} is already in use.\n` +
        `Refusing to run: every assertion would silently test whatever is already listening ` +
        `there (typically a leaked server from an earlier run, built from DIFFERENT source).\n` +
        `Free it first:  lsof -nP -iTCP:${port} -sTCP:LISTEN   then  kill <pid>`,
    );
  }
  let output = "";
  const child = spawn("node_modules/.bin/next", ["start", "--port", String(port)], {
    cwd: new URL("..", import.meta.url).pathname,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BASE_SEPOLIA_RPC_URL: rpcUrl },
  });
  child.stdout?.on("data", (c: Buffer) => (output += c.toString()));
  child.stderr?.on("data", (c: Buffer) => (output += c.toString()));
  children.push({ child, port, log: () => output });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`server on :${port} exited before becoming ready.\n${output}`);
    }
    if (/EADDRINUSE/.test(output)) throw new Error(`server on :${port} could not bind.\n${output}`);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/asset/${TOKEN_CLAIMED}`);
      if (res.status > 0) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`server on :${port} did not become ready.\n${output}`);
}

let stub: ChildProcess | null = null;

async function startStub(): Promise<void> {
  if (await portInUse(STUB_PORT)) throw new Error(`stub port ${STUB_PORT} is in use`);
  stub = spawn("node", ["scripts/archive-rpc-stub.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, STUB_PORT: String(STUB_PORT) },
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await portInUse(STUB_PORT)) return;
    await sleep(250);
  }
  throw new Error("archive-rpc-stub did not start");
}

async function stopAll(): Promise<void> {
  for (const { child, port } of children) {
    killGroup(child, "SIGTERM");
    if (await waitForPortFree(port, 8_000)) continue;
    killGroup(child, "SIGKILL");
    if (await waitForPortFree(port, 8_000)) continue;
    failures++;
    checks++;
    console.log(`  FAIL  server on :${port} did not shut down; a leaked listener poisons the NEXT run`);
  }
  if (stub) killGroup(stub, "SIGKILL");
}

async function main(): Promise<void> {
  console.log("starting archive-rpc-stub (test double for an archive-range provider)");
  await startStub();
  console.log(`starting production servers on :${ARCHIVE_PORT} (stub RPC) and :${PUBLIC_PORT} (${PUBLIC_RPC})`);
  await Promise.all([
    startServer(ARCHIVE_PORT, `http://127.0.0.1:${STUB_PORT}`),
    startServer(PUBLIC_PORT, PUBLIC_RPC),
  ]);

  try {
    await testToolAllowlist(ARCHIVE_PORT);
    await testHandshake(ARCHIVE_PORT);
    await testFraming(ARCHIVE_PORT);
    await testVerdictParity(ARCHIVE_PORT);
    await testProvenanceFields(ARCHIVE_PORT);
    await testCheckFlagged(ARCHIVE_PORT);
    const events = await testLifecycleHistory(ARCHIVE_PORT);
    await testHistoryIsRealChainData(events);
    await testLifecycleDegradesHonestly(PUBLIC_PORT);
    await testNoLeakage(ARCHIVE_PORT, PUBLIC_PORT);
    await testDiscovery(ARCHIVE_PORT);
    // Last: it deliberately exhausts a budget.
    await testRateLimit(ARCHIVE_PORT);
  } finally {
    await stopAll();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error(err);
  await stopAll();
  process.exit(1);
});
