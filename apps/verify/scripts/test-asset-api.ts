#!/usr/bin/env tsx
/**
 * Tests for the free, keyless assertion read — GET /api/asset/{tokenId}.
 *
 * WHY A SCRIPT AND NOT A TEST RUNNER. apps/verify has no test runner and no test
 * dependency (only @tagit/admin carries vitest). Rather than add a runner, a
 * config and a dependency to this app for one route, this is a zero-dependency
 * tsx script that exits non-zero on the first failing assertion set. It runs the
 * real production server and the real Base Sepolia RPC, which is also the point:
 * the interesting failures here (cache headers, CORS, owner leakage, Next
 * swallowing a status) are all wire-level and a mocked unit test would miss
 * every one of them.
 *
 *   pnpm --filter @tagit/verify build          # required: it starts `next start`
 *   npx tsx scripts/test-asset-api.ts          # spawns the server on :3099
 *   BASE_URL=https://verify.tagit.network npx tsx scripts/test-asset-api.ts
 *
 * Live-chain expectations (Base Sepolia, TAGITCore 0x3aDc…1d1D):
 *   token 50 -> CLAIMED (4), owner 0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D
 *   token 18 -> MINTED (1)
 *   token 1  -> RECYCLED (6)
 *   token 999999999 -> no record (state 0)
 * If the chain moves under us these become failures, which is correct: a
 * verification API whose verdicts drift silently is the thing we are guarding
 * against.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { encodeAbiParameters, keccak256, parseAbiParameters } from "viem";
import { sanitizeUntrustedText, sanitizeUntrustedUrl } from "../src/lib/sanitize";

const PORT = Number(process.env.PORT ?? 3099);
const EXTERNAL_BASE = process.env.BASE_URL;
const BASE = EXTERNAL_BASE ?? `http://127.0.0.1:${PORT}`;

const CONTRACT = "0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D";
const CHAIN_ID = 84532;
const KNOWN_OWNER_50 = "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D";

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

const ESC = String.fromCharCode(0x1b);
const NUL = String.fromCharCode(0x00);
const BEL = String.fromCharCode(0x07);
const RLO = String.fromCharCode(0x202e);
const ZWSP = String.fromCharCode(0x200b);
const BOM = String.fromCharCode(0xfeff);
const SHY = String.fromCharCode(0x00ad); // soft hyphen
const WJ = String.fromCharCode(0x2060); // word joiner
const HFILL = String.fromCharCode(0x3164); // Hangul filler — blank, not whitespace
/** "TAG" re-encoded in the Unicode TAG block: invisible to a human, readable to
 *  a model. `E0000 + ascii` is the ASCII-smuggling encoding. */
const TAG_PAYLOAD = [0xe0001, 0xe0054, 0xe0041, 0xe0047].map((c) => String.fromCodePoint(c)).join("");

/** Any byte class the sanitiser is supposed to remove. Used both as a unit
 *  assertion and as a scan over every string in a live response.
 *  Kept in lockstep with isDroppedCodepoint() in src/lib/sanitize.ts. */
function hasNeutralisableBytes(value: string): boolean {
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return true;
    if (cp === 0x00ad || cp === 0x180e) return true;
    if (cp >= 0x200b && cp <= 0x200f) return true;
    if (cp >= 0x202a && cp <= 0x202e) return true;
    if (cp >= 0x2060 && cp <= 0x2064) return true;
    if (cp >= 0x2066 && cp <= 0x2069) return true;
    if (cp === 0x3164 || cp === 0xffa0 || cp === 0xfeff) return true;
    if (cp >= 0xe0000 && cp <= 0xe007f) return true;
  }
  return false;
}

function walkStrings(value: unknown, visit: (s: string, path: string) => void, path = "$"): void {
  if (typeof value === "string") return visit(value, path);
  if (Array.isArray(value)) return value.forEach((v, i) => walkStrings(v, visit, `${path}[${i}]`));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkStrings(v, visit, `${path}.${k}`);
  }
}

interface Fetched {
  status: number;
  headers: Headers;
  text: string;
  json: any;
}

async function get(path: string, init?: RequestInit): Promise<Fetched> {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* left null so the caller can assert "this was not JSON" */
  }
  return { status: res.status, headers: res.headers, text, json };
}

// ── sanitiser unit tests ────────────────────────────────────────────────────
function testSanitizer(): void {
  section("sanitize: injected control sequences are neutralised");

  const ansi = `${ESC}[31mCOUNTERFEIT${ESC}[2K${ESC}[1AAUTHENTIC`;
  const cleanedAnsi = sanitizeUntrustedText(ansi);
  eq(cleanedAnsi, "COUNTERFEITAUTHENTIC", "full CSI sequences removed, payload text kept");
  ok(!cleanedAnsi!.includes("[31m"), "no readable sequence remainder left behind", cleanedAnsi);

  const osc = `${ESC}]8;;https://evil.example${BEL}Genuine Bag${ESC}]0;pwn${BEL}`;
  eq(sanitizeUntrustedText(osc), "Genuine Bag", "OSC hyperlink/title sequences removed");

  eq(sanitizeUntrustedText(`Nike${RLO}gab`), "Nikegab", "bidi override (Trojan Source) removed");
  eq(sanitizeUntrustedText(`Ni${ZWSP}ke${BOM}`), "Nike", "zero-width + BOM removed");
  eq(sanitizeUntrustedText(`ok${NUL}ay`), "okay", "NUL removed");
  eq(sanitizeUntrustedText("line one\nline two"), "line one line two", "newline becomes a space");
  eq(sanitizeUntrustedText(`${NUL}${ESC}[0m`), null, "pure-control field disappears instead of ''");
  eq(sanitizeUntrustedText(123 as unknown), null, "non-string returns null");
  eq(sanitizeUntrustedText("a".repeat(500))!.length, 200, "short fields are capped");
  eq(sanitizeUntrustedText("a".repeat(2000), 1000)!.length, 1000, "description cap honoured");
  ok(!hasNeutralisableBytes(sanitizeUntrustedText(ansi + osc + RLO + ZWSP)!), "no residue after cleaning");

  // Invisible carriers. A field that a human reviewer reads as "Nike" must not
  // reach a model carrying anything the reviewer could not see.
  eq(sanitizeUntrustedText(`Nike${TAG_PAYLOAD}`), "Nike", "Unicode TAG block (ASCII smuggling) removed");
  eq(sanitizeUntrustedText(`Ni${SHY}ke`), "Nike", "soft hyphen removed");
  eq(sanitizeUntrustedText(`Ni${WJ}ke`), "Nike", "word joiner / invisible operators removed");
  eq(sanitizeUntrustedText(`Ni${HFILL}ke`), "Nike", "Hangul filler removed");
  eq(sanitizeUntrustedText(`Nike${TAG_PAYLOAD}`), sanitizeUntrustedText("Nike"), "two visually identical brands compare equal after cleaning");
  ok(
    !hasNeutralisableBytes(sanitizeUntrustedText(`Ni${SHY}${WJ}${HFILL}ke${TAG_PAYLOAD}`)!),
    "no invisible-carrier residue after cleaning",
  );
  eq(sanitizeUntrustedText(`Bag ${String.fromCodePoint(0x1f45c)}`), `Bag ${String.fromCodePoint(0x1f45c)}`, "astral emoji survives (the transform is lossy, not destructive)");

  section("sanitize: url scheme allowlist");
  eq(sanitizeUntrustedUrl("javascript:alert(1)"), null, "javascript: rejected");
  eq(sanitizeUntrustedUrl("data:text/html;base64,PHNjcmlwdD4="), null, "data: rejected");
  eq(sanitizeUntrustedUrl("file:///etc/passwd"), null, "file: rejected");
  eq(sanitizeUntrustedUrl("not a url"), null, "unparseable rejected");
  eq(sanitizeUntrustedUrl("https://w3s.link/ipfs/Qm123"), "https://w3s.link/ipfs/Qm123", "https kept");
  eq(sanitizeUntrustedUrl(`https://ok.example/a${ESC}[31m`), "https://ok.example/a", "url is cleaned too");
}

// ── /api/asset/{tokenId} ────────────────────────────────────────────────────
const TOP_LEVEL_FIELDS = [
  "version",
  "token_id",
  "authentic",
  "state",
  "state_code",
  "flagged",
  "owner_commitment",
  "chainRef",
  "untrusted",
  "network",
  "audit_status",
  "production_ready",
];

const SUPPLIER_FIELDS = ["name", "brand", "description", "sku", "origin", "size", "image"];

function expectedCommitment(tokenId: bigint, owner: string): string {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("uint256 chainId, address contractAddress, uint256 tokenId, address owner"),
      [BigInt(CHAIN_ID), CONTRACT as `0x${string}`, tokenId, owner as `0x${string}`],
    ),
  );
}

async function testHappyPath(): Promise<void> {
  section("GET /api/asset/50 — happy path shape");
  const r = await get("/api/asset/50");
  eq(r.status, 200, "status");

  for (const f of TOP_LEVEL_FIELDS) ok(f in r.json, `field present: ${f}`);
  ok(
    Object.keys(r.json).length === TOP_LEVEL_FIELDS.length,
    "no undeclared top-level fields (the shape is a generated contract)",
    Object.keys(r.json),
  );

  eq(r.json.version, "1", "version");
  eq(r.json.token_id, "50", "token_id is a string");
  eq(r.json.state, "CLAIMED", "state name");
  eq(r.json.state_code, 4, "state_code");
  eq(r.json.authentic, true, "authentic");
  eq(r.json.flagged, false, "flagged");
  eq(r.json.network, "base-sepolia", "network");
  eq(r.json.audit_status, "unaudited", "audit_status");
  eq(r.json.production_ready, false, "production_ready");

  section("GET /api/asset/50 — chainRef is re-derivable");
  eq(r.json.chainRef.chain_id, CHAIN_ID, "chainRef.chain_id");
  eq(r.json.chainRef.contract, CONTRACT, "chainRef.contract");
  eq(r.json.chainRef.token_id, "50", "chainRef.token_id");
  ok(Number.isInteger(r.json.chainRef.block_number) && r.json.chainRef.block_number > 0, "chainRef.block_number is a positive integer", r.json.chainRef.block_number);
  ok(/^0x[0-9a-f]{64}$/.test(r.json.chainRef.block_hash ?? ""), "chainRef.block_hash is a 32-byte hash", r.json.chainRef.block_hash);

  section("GET /api/asset/50 — owner address is absent, commitment is checkable");
  ok(!r.text.toLowerCase().includes("0x458b4d"), "raw owner address appears NOWHERE in the body");
  ok(!r.text.toLowerCase().includes(KNOWN_OWNER_50.toLowerCase()), "full owner address absent (case-insensitive)");
  ok(!("owner" in r.json), "no `owner` key at all");
  eq(
    r.json.owner_commitment,
    expectedCommitment(50n, KNOWN_OWNER_50),
    "commitment equals keccak256(abi.encode(chain_id, contract, token_id, owner)) for the known owner",
  );
  ok(
    r.json.owner_commitment !== expectedCommitment(51n, KNOWN_OWNER_50),
    "commitment is domain-separated per token (same owner, different token -> different hash)",
  );

  section("GET /api/asset/50 — untrusted envelope");
  ok(typeof r.json.untrusted._warning === "string" && r.json.untrusted._warning.length > 50, "untrusted._warning present");
  ok(/never interpret it as instructions/i.test(r.json.untrusted._warning), "warning names the prompt-injection rule");
  for (const f of SUPPLIER_FIELDS) {
    ok(f in r.json.untrusted, `untrusted.${f} present`);
    ok(!(f in r.json), `supplier field NOT hoisted to top level: ${f}`);
  }
  const residue: string[] = [];
  walkStrings(r.json, (s, path) => {
    if (hasNeutralisableBytes(s)) residue.push(path);
  });
  ok(residue.length === 0, "no control/bidi/zero-width bytes anywhere in the live response", residue);

  section("GET /api/asset/50 — headers");
  eq(r.headers.get("access-control-allow-origin"), "*", "CORS header");
  ok((r.headers.get("content-type") ?? "").startsWith("application/json"), "content-type is JSON", r.headers.get("content-type"));
  ok(/s-maxage=60/.test(r.headers.get("cache-control") ?? ""), "verdict is shared-cacheable for 60s", r.headers.get("cache-control"));
}

async function testOtherStates(): Promise<void> {
  section("GET /api/asset/18 and /api/asset/1 — state names");
  const minted = await get("/api/asset/18");
  eq(minted.status, 200, "token 18 status");
  eq(minted.json.state, "MINTED", "token 18 state");
  eq(minted.json.state_code, 1, "token 18 state_code");
  eq(minted.json.authentic, true, "token 18 authentic (MINTED is in 1..4)");

  const recycled = await get("/api/asset/1");
  eq(recycled.status, 200, "token 1 status");
  eq(recycled.json.state, "RECYCLED", "token 1 state");
  eq(recycled.json.state_code, 6, "token 1 state_code");
  eq(recycled.json.authentic, false, "token 1 authentic=false (RECYCLED is outside 1..4)");
  eq(recycled.json.flagged, false, "token 1 flagged=false");

  section("token id normalisation");
  const padded = await get("/api/asset/050");
  eq(padded.json.token_id, "50", "leading zeros normalise to canonical decimal");
}

async function testTypedErrors(): Promise<void> {
  section("typed errors");

  const missing = await get("/api/asset/999999999");
  eq(missing.status, 404, "unknown token status");
  eq(missing.json?.error?.code, "ASSET_NOT_FOUND", "unknown token code");
  eq(missing.json?.version, "1", "errors carry version");
  ok(typeof missing.json?.error?.message === "string", "error has a message");
  ok((missing.headers.get("content-type") ?? "").startsWith("application/json"), "404 is JSON, not HTML", missing.headers.get("content-type"));
  ok(!/<html/i.test(missing.text), "404 body contains no HTML");
  ok(/no-store/.test(missing.headers.get("cache-control") ?? ""), "404 is not shared-cacheable", missing.headers.get("cache-control"));
  eq(missing.headers.get("access-control-allow-origin"), "*", "404 keeps CORS");

  for (const bad of ["notanumber", "-1", "1.5", "0x1f", "50%20", "1e10", "9".repeat(80)]) {
    const r = await get(`/api/asset/${bad}`);
    eq(r.status, 400, `malformed "${bad}" status`);
    eq(r.json?.error?.code, "INVALID_TOKEN_ID", `malformed "${bad}" code`);
    ok(/no-store/.test(r.headers.get("cache-control") ?? ""), `malformed "${bad}" not cacheable`);
  }

  // 2^256 exactly — one past uint256 max, and the reason the length guard alone
  // is not enough.
  const overflow = await get(`/api/asset/${(1n << 256n).toString()}`);
  eq(overflow.status, 400, "2^256 status");
  eq(overflow.json?.error?.code, "INVALID_TOKEN_ID", "2^256 code");

  section("CORS preflight");
  const preflight = await get("/api/asset/50", { method: "OPTIONS" });
  eq(preflight.status, 204, "OPTIONS status");
  eq(preflight.headers.get("access-control-allow-origin"), "*", "OPTIONS CORS header");
}

/**
 * REGRESSION GUARD. /api/verify is a stable contract consumed by the ORACULAR
 * mobile app with a TestFlight build imminent. The new typed-error scheme must
 * NOT have leaked into it: no `error.code` object, no `version`, and its
 * deliberate "200 for counterfeit" behaviour untouched.
 */
async function testVerifyUnchanged(): Promise<void> {
  section("REGRESSION: /api/verify is unchanged");

  const noParams = await get("/api/verify");
  eq(noParams.status, 400, "no params status");
  eq(noParams.json?.verified, false, "no params verified:false");
  eq(noParams.json?.error, "missing picc or cmac query params", "no params error string (not an object)");
  ok(typeof noParams.json?.error === "string", "error stayed a plain string", typeof noParams.json?.error);
  ok(!("version" in (noParams.json ?? {})), "no `version` field leaked in");
  ok(
    typeof noParams.json?.error !== "object",
    "error is not the new typed { code, message } object",
    noParams.json?.error,
  );
  eq(Object.keys(noParams.json ?? {}).sort().join(","), "error,verified", "exact key set");
  eq(noParams.headers.get("access-control-allow-origin"), "*", "CORS unchanged");
  eq(noParams.headers.get("cache-control"), "no-store", "still no-store");

  const withParams = await get("/api/verify?picc=" + "0".repeat(32) + "&cmac=" + "0".repeat(16));
  ok(
    withParams.status === 200 || withParams.status === 503,
    "a syntactically valid tap still resolves through the SUN path (200 verdict, or 503 when SDM_MASTER_KEY is unset)",
    withParams.status,
  );
  ok("verified" in (withParams.json ?? {}), "response still keyed on `verified`", withParams.json);
}

// ── server lifecycle ────────────────────────────────────────────────────────
/*
 * THE STALE-SERVER HAZARD — why this section is more than four lines.
 *
 * `next start` is a thin CLI wrapper that forks the actual listener as a
 * SEPARATE `next-server` child. Signalling only the wrapper (`child.kill()`)
 * frequently leaves that grandchild alive, orphaned, and still holding the port.
 * Combined with `stdio: "ignore"`, the failure mode is silent and catastrophic
 * for a test suite:
 *
 *   run 1  -> starts a server, asserts, "kills" it, leaks a listener on :3099
 *   run 2  -> spawn fails to bind (EADDRINUSE, swallowed by stdio:"ignore"),
 *             the readiness probe succeeds instantly against the LEAKED
 *             process, and every wire assertion is made against the PREVIOUS
 *             build. Deliberate regressions in the route pass green.
 *
 * Measured, not theorised: with an owner-address leak and a corrupted
 * owner_commitment compiled into the route, a run against a leaked listener
 * reported 123/125 (only the in-process sanitiser checks failed); the identical
 * build against a free port reported 118/125 and caught both.
 *
 * Three defences, all required:
 *   1. REFUSE to start if the port is already occupied — never silently adopt a
 *      server we did not build.
 *   2. Spawn detached so the wrapper leads its own process GROUP, and signal the
 *      whole group so `next-server` dies with it.
 *   3. Wait for the port to actually be released before returning, and fail the
 *      run if it is not — a leak must be loud, not inherited by the next run.
 */

/** True if something is already accepting connections on `port`. */
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

/**
 * Poll until the server answers — but abort immediately if the child process we
 * started has died, rather than burning the full timeout (or, worse, succeeding
 * against somebody else's listener).
 */
async function waitForServer(url: string, child: ChildProcess, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `server process exited (code=${child.exitCode} signal=${child.signalCode}) before becoming ready.\n` +
          `--- server output ---\n${serverOutput || "(none)"}`,
      );
    }
    try {
      const res = await fetch(url);
      if (res.status > 0) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`server did not become ready at ${url}\n--- server output ---\n${serverOutput || "(none)"}`);
}

let serverOutput = "";

/** Signal the child's whole process group, so the forked `next-server` dies too. */
function killGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal); // negative pid == process group
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

async function stopServer(child: ChildProcess): Promise<void> {
  killGroup(child, "SIGTERM");
  if (await waitForPortFree(PORT, 8_000)) return;
  killGroup(child, "SIGKILL");
  if (await waitForPortFree(PORT, 8_000)) return;
  // Loud, and it fails the run: a leaked listener silently poisons the NEXT run.
  failures++;
  checks++;
  console.log(
    `  FAIL  server on :${PORT} did not shut down; a leaked listener would make the next run test a stale build`,
  );
}

async function main(): Promise<void> {
  let server: ChildProcess | null = null;
  if (!EXTERNAL_BASE) {
    if (await portInUse(PORT)) {
      throw new Error(
        `port ${PORT} is already in use.\n` +
          `Refusing to run: the assertions below would silently test whatever is already listening there ` +
          `(typically a leaked server from an earlier run, built from DIFFERENT source) instead of this build.\n` +
          `Free it first:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN   then  kill <pid>\n` +
          `Or point the suite elsewhere:  PORT=<other> pnpm test:api`,
      );
    }
    console.log(`starting production server on :${PORT} (set BASE_URL to test a deployed host instead)`);
    server = spawn("node_modules/.bin/next", ["start", "--port", String(PORT)], {
      cwd: new URL("..", import.meta.url).pathname,
      // Own process group, so SIGTERM reaches the forked `next-server` too.
      detached: true,
      // NOT "ignore": a bind failure or a crash must be readable, not swallowed.
      stdio: ["ignore", "pipe", "pipe"],
      // `next start` runs as NODE_ENV=production, where rpcClient() refuses to
      // run without a server-side RPC endpoint rather than silently falling back
      // to the public one (src/lib/contract.ts). That guard is the point of the
      // transport split, so the harness must supply an endpoint rather than have
      // the guard relaxed for it. The public endpoint is correct here: this suite
      // tests the API contract, not the spend cap.
      env: {
        ...process.env,
        BASE_SEPOLIA_RPC_URL:
          process.env.BASE_SEPOLIA_RPC_URL ||
          process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
          "https://sepolia.base.org",
      },
    });
    server.stdout?.on("data", (c: Buffer) => (serverOutput += c.toString()));
    server.stderr?.on("data", (c: Buffer) => (serverOutput += c.toString()));
    const onExit = () => server && killGroup(server, "SIGKILL");
    process.once("SIGINT", () => {
      onExit();
      process.exit(130);
    });
    process.once("exit", onExit);
    await waitForServer(`${BASE}/api/asset/50`, server);
  }

  try {
    testSanitizer();
    await testHappyPath();
    await testOtherStates();
    await testTypedErrors();
    await testVerifyUnchanged();
  } finally {
    if (server) await stopServer(server);
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
