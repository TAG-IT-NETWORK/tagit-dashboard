#!/usr/bin/env tsx
/**
 * P0.4 — the guessable-alias redirect table.
 *
 * WHY A SCRIPT AND NOT A UNIT TEST — same reasoning as the sibling suites:
 * apps/verify has no test runner, and the interesting failure here is wire-level
 * (status code, Location header, and above all which paths are NOT matched).
 * A unit test against the config object would assert the table I wrote is the
 * table I wrote, and would not have caught the shadowing case that motivates
 * half of these assertions.
 *
 *   pnpm --filter @tagit/verify build
 *   pnpm --filter @tagit/verify test:redirects
 *
 * THE REAL RISK IS SHADOWING, NOT THE REDIRECTS THEMSELVES. `/:tokenId` at the
 * root matches every single-segment path unless constrained, so a careless
 * edit silently swallows /sun, /mcp and anything added later. The NEGATIVE
 * assertions below are therefore the load-bearing ones: they fail loudly if the
 * digit constraint is ever loosened.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.PORT ?? 3099);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
let checks = 0;

function ok(cond: boolean, label: string, detail?: unknown): void {
  checks++;
  if (cond) {
    console.log(`  PASS  ${label}`);
    return;
  }
  failures++;
  console.log(`  FAIL  ${label}${detail === undefined ? "" : `\n        got: ${JSON.stringify(detail)}`}`);
}

/** Raw fetch with redirects OFF — we are asserting on the hop itself. */
async function head(path: string): Promise<{ status: number; location: string | null }> {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
}

async function expectRedirect(from: string, to: string): Promise<void> {
  const { status, location } = await head(from);
  ok(status === 308, `${from} → 308`, status);
  ok(location === to, `${from} → Location: ${to}`, location);
}

/**
 * A path that must NOT be captured by the alias table.
 *
 * Deliberately asserts "not a redirect to /asset/*" rather than a specific
 * status: /sun and /mcp legitimately answer differently (200, 405, 400), and
 * pinning their exact codes here would make this suite fail whenever an
 * unrelated route changes. What matters is only that the redirect table did not
 * eat them.
 */
async function expectNotShadowed(path: string): Promise<void> {
  const { status, location } = await head(path);
  const shadowed = status === 308 && (location ?? "").startsWith("/asset/");
  ok(!shadowed, `${path} is NOT swallowed by the alias table`, { status, location });
}

async function waitForPort(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const up = await new Promise<boolean>((resolve) => {
      const sock = createConnection({ port, host: "127.0.0.1" })
        .on("connect", () => { sock.destroy(); resolve(true); })
        .on("error", () => resolve(false));
    });
    if (up) return;
    await sleep(300);
  }
  throw new Error(`server did not listen on ${port}`);
}

let server: ChildProcess | null = null;

async function main(): Promise<void> {
  server = spawn("npx", ["next", "start", "--port", String(PORT)], {
    stdio: "inherit",
    env: { ...process.env, BASE_SEPOLIA_RPC_URL: "https://sepolia.base.org" },
  });
  await waitForPort(PORT);

  console.log("\nguessable aliases redirect to the canonical verdict");
  await expectRedirect("/5", "/asset/5");
  await expectRedirect("/verify/5", "/asset/5");
  await expectRedirect("/t/5", "/asset/5");
  await expectRedirect("/uid/04A1B2C3D4E580", "/tag/04A1B2C3D4E580");

  console.log("\nlarge and edge-case ids still resolve to a canonical URL");
  await expectRedirect("/0", "/asset/0");
  await expectRedirect(`/${"9".repeat(78)}`, `/asset/${"9".repeat(78)}`);

  console.log("\nTHE LOAD-BEARING PART — real routes are not shadowed");
  for (const p of [
    "/",                                   // home
    "/sun",                                // SUN tap landing
    "/mcp",                                // MCP JSON-RPC endpoint
    "/asset/5",                            // the canonical route itself
    "/tag/04A1B2C3D4E580",                 // chip fallback
    "/api/asset/5",                        // public JSON read
    "/api/verify",                         // stable mobile-app contract
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/mcp.json",
    "/01/09506000134352/21/TEST123",       // GS1 Digital Link resolver
  ]) {
    await expectNotShadowed(p);
  }

  console.log("\nnon-numeric single segments are left alone for future routes");
  for (const p of ["/pricing", "/about", "/5a", "/a5", "/-1", "/5.0"]) {
    await expectNotShadowed(p);
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.error(`${failures} FAILED\n`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => {
    // `next start` forks a next-server grandchild that survives SIGTERM on the
    // parent and keeps the port held — the exact failure that once let a whole
    // suite assert against a stale build. Kill the group.
    if (server?.pid) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* already gone */ } }
    server?.kill("SIGKILL");
  });
