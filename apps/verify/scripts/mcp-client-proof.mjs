#!/usr/bin/env node
/**
 * Drive POST /mcp with the OFFICIAL MCP client SDK.
 *
 * WHY THIS EXISTS SEPARATELY FROM scripts/test-mcp.ts. That suite speaks raw
 * JSON-RPC over fetch, which proves the wire format is what we think it is. It
 * does NOT prove that a real client can drive the server: a handshake curl
 * accepts but no client can complete is not a working MCP server. This script
 * closes that gap by using `@modelcontextprotocol/sdk`'s own `Client` and
 * `StreamableHTTPClientTransport` — the exact code path Claude Desktop, Claude
 * Code and every other SDK-based host use.
 *
 * That pairing is deliberate. src/lib/mcp/protocol.ts implements the server side
 * by hand (see its header for why the SDK's Node-req/res transport is the wrong
 * shape for a Next App Router handler). Testing a hand-rolled server with the
 * SDK's client is a STRONGER check than SDK-on-both-ends, which can happily
 * agree with itself about a mistake.
 *
 * THE SDK IS NOT A DEPENDENCY OF THIS APP, deliberately — see the lockfile note
 * in src/lib/mcp/protocol.ts. Provide it out-of-tree:
 *
 *   mkdir -p /tmp/mcp-proof && cd /tmp/mcp-proof
 *   npm init -y && npm i --no-save @modelcontextprotocol/sdk
 *   MCP_SDK_DIR=/tmp/mcp-proof/node_modules \
 *     node apps/verify/scripts/mcp-client-proof.mjs http://127.0.0.1:3097/mcp
 *
 * MCP_SDK_DIR, and not NODE_PATH: NODE_PATH is honoured by CommonJS `require`
 * only. ESM bare-specifier resolution ignores it entirely and walks up from the
 * importing module's own directory, which is inside this repo and correctly has
 * no MCP SDK in it. An out-of-tree ESM dependency has to be addressed by path.
 */
const ENDPOINT = process.argv[2] ?? "http://127.0.0.1:3097/mcp";

async function loadSdk() {
  const dir = process.env.MCP_SDK_DIR;
  const candidates = dir
    ? [
        [`${dir}/@modelcontextprotocol/sdk/dist/esm/client/index.js`, `${dir}/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js`],
        [`${dir}/@modelcontextprotocol/sdk/client/index.js`, `${dir}/@modelcontextprotocol/sdk/client/streamableHttp.js`],
      ]
    : [];
  // Bare specifier last, so an explicitly-pointed-at SDK always wins.
  candidates.push([
    "@modelcontextprotocol/sdk/client/index.js",
    "@modelcontextprotocol/sdk/client/streamableHttp.js",
  ]);

  for (const [clientPath, transportPath] of candidates) {
    try {
      const { Client } = await import(clientPath);
      const { StreamableHTTPClientTransport } = await import(transportPath);
      return { Client, StreamableHTTPClientTransport, from: clientPath };
    } catch {
      /* try the next candidate */
    }
  }
  console.error(
    "@modelcontextprotocol/sdk is not resolvable.\n" +
      "It is intentionally NOT a dependency of apps/verify (see src/lib/mcp/protocol.ts).\n" +
      "Install it out-of-tree and re-run:\n" +
      "  mkdir -p /tmp/mcp-proof && cd /tmp/mcp-proof && npm init -y && npm i --no-save @modelcontextprotocol/sdk\n" +
      "  MCP_SDK_DIR=/tmp/mcp-proof/node_modules node apps/verify/scripts/mcp-client-proof.mjs",
  );
  process.exit(2);
}

const { Client, StreamableHTTPClientTransport, from } = await loadSdk();

const line = (s = "") => console.log(s);
const rule = (t) => line(`\n${"─".repeat(78)}\n${t}\n${"─".repeat(78)}`);

const client = new Client({ name: "tagit-mcp-client-proof", version: "1.0.0" }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT));

rule(`CONNECT — official @modelcontextprotocol/sdk client -> ${ENDPOINT}`);
line(`sdk module          : ${from}`);
await client.connect(transport);
line(`negotiated protocol : ${transport.protocolVersion ?? "(from initialize)"}`);
line(`server              : ${JSON.stringify(client.getServerVersion())}`);
line(`capabilities        : ${JSON.stringify(client.getServerCapabilities())}`);
const instructions = client.getInstructions() ?? "";
line(`instructions        : ${instructions.length} chars`);

rule("tools/list");
const { tools } = await client.listTools();
line(`${tools.length} tools:`);
for (const t of tools) {
  line(`  • ${t.name}  (readOnlyHint=${t.annotations?.readOnlyHint}, destructiveHint=${t.annotations?.destructiveHint})`);
}

async function show(label, name, args) {
  rule(`tools/call  ${name}(${JSON.stringify(args)})   ${label}`);
  const res = await client.callTool({ name, arguments: args });
  line(`isError: ${res.isError}`);
  line(`summary: ${res.content?.[0]?.text ?? "(none)"}`);
  line("structuredContent:");
  line(JSON.stringify(res.structuredContent, null, 2));
  return res;
}

await show("CLAIMED, real IPFS metadata", "verify_asset", { token_id: 5 });
await show("never minted -> zero record", "verify_asset", { token_id: 999999999 });
await show("FLAGGED", "check_flagged", { token_id: 35 });
await show("not flagged", "check_flagged", { token_id: 5 });
await show("full on-chain timeline", "get_lifecycle_history", { token_id: 5 });

rule("DISCONNECT");
await client.close();
line("closed cleanly");
