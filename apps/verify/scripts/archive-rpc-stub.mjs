#!/usr/bin/env node
/**
 * A TEST DOUBLE for an archive-range Base Sepolia RPC. NOT FOR PRODUCTION.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 * src/lib/lifecycle.ts issues ONE eth_getLogs over [deployment_block, head] —
 * currently ~5.1M blocks. Twelve keyless Base Sepolia endpoints were measured
 * (see the header of that file) and NOT ONE of them accepts a range that wide,
 * so the happy path of get_lifecycle_history cannot be exercised against any
 * free provider. Without something like this, the only reachable behaviour is
 * the typed `available: false` fallback, and the decode / ordering / commitment
 * / dedupe / cache logic would ship untested.
 *
 * This process stands in for the archive-capable provider that production is
 * expected to be pointed at. It answers eth_getLogs over an arbitrary range and
 * forwards every other method untouched to the Base public endpoint.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 * It is NOT a fallback, NOT a fixture, and NOT an alternative data source for
 * the product. It backs eth_getLogs with Blockscout's public index, which
 * src/lib/lifecycle.ts deliberately refuses to use — a verification host must
 * not launder a third party's claim as chain state. That objection is about what
 * the PRODUCT is allowed to assert to a caller; it does not apply to a local
 * test harness whose output is independently re-verified against the chain.
 *
 * And it IS re-verified: scripts/test-mcp.ts takes every event this path
 * produces and re-reads it from https://sepolia.base.org with a one-block
 * eth_getLogs, comparing topics and data byte-for-byte. If the stub ever
 * fabricated or dropped an event, that check fails. The events pasted in any
 * proof therefore come from Blockscout's index but are confirmed by Base's own
 * node before anyone is asked to believe them.
 *
 * Binds 127.0.0.1 only, and refuses to do otherwise, so it cannot be reached
 * from off-box even by accident.
 *
 *   node scripts/archive-rpc-stub.mjs          # listens on 127.0.0.1:8899
 *   BASE_SEPOLIA_RPC_URL=http://127.0.0.1:8899 pnpm start
 */
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 8899);
const UPSTREAM = "https://sepolia.base.org";
const BLOCKSCOUT = "https://base-sepolia.blockscout.com/api";

/** The four TAGITCore lifecycle event signature hashes — see src/lib/abi.ts. */
const TOPIC0 = [
  "0x5c6b40cc9c243e5932bb50b35997a88a50ea5263e1db10c10f168de3c1ba0f71",
  "0xb49a1942181676c53a45adef7c0e3378f270b5f4bed5c43d6cefb7886f82a0a9",
  "0xc2d03547b772fd22e620aac789d884d7b502e1e0499abaa02dce3bd86022f3fe",
  "0x71bd2049f64d1fd0969ab18322a80a3c0214dc909dcbe27e5da596bc5958c1bc",
];

async function forward(body) {
  const res = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Blockscout's logs endpoint takes ONE topic0 per query, so a four-way OR
 * becomes four queries that are merged here. It also pads the `topics` array to
 * four entries with nulls, which a real node never does and which would break
 * ABI decoding downstream — the trailing nulls are stripped so the log has
 * exactly the topics it was emitted with.
 */
async function getLogs(filter) {
  const from = BigInt(filter.fromBlock ?? "0x0").toString();
  const to =
    filter.toBlock && filter.toBlock !== "latest"
      ? BigInt(filter.toBlock).toString()
      : "latest";
  const topic1 = Array.isArray(filter.topics) ? filter.topics[1] : undefined;
  const wanted = Array.isArray(filter.topics?.[0])
    ? filter.topics[0]
    : filter.topics?.[0]
      ? [filter.topics[0]]
      : TOPIC0;

  const out = [];
  for (const t0 of wanted) {
    const url =
      `${BLOCKSCOUT}?module=logs&action=getLogs&fromBlock=${from}&toBlock=${to}` +
      `&address=${filter.address}&topic0=${t0}` +
      (topic1 ? `&topic1=${topic1}&topic0_1_opr=and` : "");
    const res = await fetch(url);
    const body = await res.json();
    if (!Array.isArray(body.result)) continue;
    for (const log of body.result) {
      const topics = (log.topics ?? []).filter((t) => t !== null && t !== undefined);
      out.push({
        address: log.address,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex === "0x" ? "0x0" : log.logIndex,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        topics,
        data: log.data,
        removed: false,
      });
    }
  }
  out.sort(
    (a, b) =>
      Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) ||
      Number(BigInt(a.logIndex) - BigInt(b.logIndex)),
  );
  return out;
}

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    let out;
    try {
      const body = JSON.parse(raw);
      if (body.method === "eth_getLogs") {
        out = { jsonrpc: "2.0", id: body.id, result: await getLogs(body.params[0]) };
      } else {
        out = await forward(body);
      }
    } catch (error) {
      out = { jsonrpc: "2.0", id: null, error: { code: -32603, message: String(error) } };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  });
});

// 127.0.0.1 explicitly, never 0.0.0.0: a stand-in RPC that is reachable off-box
// is a way for this to end up in front of something real.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`archive-rpc-stub (TEST DOUBLE — not for production) on http://127.0.0.1:${PORT}`);
});
