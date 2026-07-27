/**
 * Proves the spend-capped RPC key never reaches the browser.
 *
 * WHY A BUILD-AND-GREP AND NOT A UNIT TEST
 * ────────────────────────────────────────
 * The property under test is not "does this function behave" — it is "does this
 * string exist in the bytes we serve to the public". Only a real `next build`
 * answers that, because the leak this guards against is a build-time inlining
 * step: Next substitutes `process.env.NEXT_PUBLIC_*` into the client bundle as a
 * literal. Any test that stubs the bundler tests the stub.
 *
 * The regression it exists to catch is concrete and has already happened once in
 * this codebase: the chain transport read NEXT_PUBLIC_BASE_SEPOLIA_RPC from a
 * module-level client that both the SSR page and a client component imported. Put
 * a capped key in that variable and you publish it to every visitor.
 *
 * HOW IT WORKS
 *   1. Build with BASE_SEPOLIA_RPC_URL set to a unique sentinel URL.
 *   2. NEGATIVE: the sentinel must appear NOWHERE under .next/static (the client
 *      bundle) or in any prerendered HTML.
 *   3. POSITIVE: the sentinel MUST appear under .next/server. A grep that finds
 *      nothing anywhere proves nothing — it is indistinguishable from a broken
 *      grep, a failed build, or a variable no code reads. This half is what makes
 *      step 2 evidence instead of a green tick.
 *
 * Run: pnpm --filter @tagit/verify test:rpc-split
 * Requires network (it builds, and the build reaches the chain for
 * generateStaticParams / metadata on cached routes).
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = new URL("..", import.meta.url).pathname;
const NEXT_DIR = join(APP_DIR, ".next");

const SENTINEL = `https://rpc-split-sentinel-${Math.random().toString(36).slice(2, 12)}.invalid`;

/** Files whose bytes reach the public. .next/static is the client bundle; the
 *  prerendered .html files are what a crawler with JS disabled receives. */
function collect(dir: string, match: (p: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full, match));
    else if (match(full)) out.push(full);
  }
  return out;
}

function grep(files: string[]): string[] {
  return files.filter((f) => {
    try {
      return readFileSync(f, "utf8").includes(SENTINEL);
    } catch {
      return false; // binary / unreadable — cannot carry a URL literal we care about
    }
  });
}

function main() {
  console.log(`sentinel: ${SENTINEL}`);
  console.log("building (this takes a minute)…");

  rmSync(NEXT_DIR, { recursive: true, force: true });
  execFileSync("npx", ["next", "build"], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: { ...process.env, BASE_SEPOLIA_RPC_URL: SENTINEL },
  });

  const clientFiles = [
    ...collect(join(NEXT_DIR, "static"), () => true),
    ...collect(join(NEXT_DIR, "server"), (p) => p.endsWith(".html")),
  ];
  const serverFiles = collect(join(NEXT_DIR, "server"), (p) => /\.(js|mjs|cjs|json)$/.test(p));

  if (clientFiles.length === 0 || serverFiles.length === 0) {
    console.error(
      `\nINCONCLUSIVE: scanned ${clientFiles.length} client and ${serverFiles.length} server ` +
        `files. The build did not produce what this test expects, so a clean result would be meaningless.`,
    );
    process.exit(2);
  }

  const leaked = grep(clientFiles);
  const present = grep(serverFiles);

  console.log(`\nscanned ${clientFiles.length} client-reachable files, ${serverFiles.length} server files`);

  if (present.length === 0) {
    console.error(
      "\nFAIL (test is not proving anything): the sentinel is absent from the SERVER bundle too.\n" +
        "  Either nothing reads BASE_SEPOLIA_RPC_URL, or the build inlined nothing.\n" +
        "  A negative result from this run would be a false pass — fix this before trusting it.",
    );
    process.exit(1);
  }

  if (leaked.length > 0) {
    console.error("\nFAIL: the capped RPC URL is in the client-reachable bundle:");
    for (const f of leaked) console.error(`  ${f.replace(APP_DIR, "")}`);
    console.error(
      "\n  A NEXT_PUBLIC_ prefix, or a client component importing @/lib/contract.server,\n" +
        "  will do this. Anything shipped here is world-readable — rotate the key.",
    );
    process.exit(1);
  }

  console.log(
    `\nPASS: sentinel present in ${present.length} server file(s), absent from all ` +
      `${clientFiles.length} client-reachable files.`,
  );
}

main();
