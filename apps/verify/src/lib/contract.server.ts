import "server-only";

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { TAGITCoreABI } from "./abi";
import { CONTRACT_ADDRESS } from "./contract";

/**
 * THE chain transport for this host. Server-side only, and that is enforced by
 * the `server-only` import above rather than by convention: any client component
 * that reaches this module — directly or through a chain of imports — fails the
 * build with an explicit error instead of shipping the URL below to the browser.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The transport used to be `process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC` on a single
 * module-level client that BOTH the server page and the client island imported.
 * Anything prefixed NEXT_PUBLIC_ is inlined into the browser bundle at build time
 * and is world-readable. So the one variable a spend-capped key would have to go
 * into was also the one variable that publishes its value to every visitor —
 * putting a capped key there would have burned the cap by handing out the key,
 * not by serving traffic.
 *
 * `BASE_SEPOLIA_RPC_URL` has no NEXT_PUBLIC_ prefix, so Next never inlines it.
 * The name matches tagit-services/src/config (BASE_SEPOLIA_RPC_URL) on purpose:
 * one convention across the two codebases that read this chain. It is a DIFFERENT
 * key from the services one — isolation is the point; sharing the name is not
 * sharing the value.
 *
 * Unset in production THROWS — see resolveRpcUrl() below. It does not degrade to
 * the public endpoint, because a silent fallback means believing you are capped
 * when you are not. Nothing in this file can bound spend; only the provider-side
 * cap does that, so the variable's presence is the only signal that a cap exists.
 *
 * The 60s edge cache (src/lib/cache.ts) is the primary cost control; it collapses
 * a crawl burst on ONE token into one read per TTL. It does not bound enumeration
 * across many token ids. Only a provider-side hard cap does that.
 *
 * Verify the split holds: `pnpm --filter @tagit/verify test:rpc-split`.
 */
const PUBLIC_FALLBACK_RPC = "https://sepolia.base.org";

/**
 * FAILS LOUD, NOT OPEN.
 *
 * In production a missing BASE_SEPOLIA_RPC_URL throws instead of quietly
 * dropping back to the free public endpoint. Silent fallback is exactly how you
 * end up believing you are spend-capped when you are not — it is the shape of
 * tagit-services/api/index.ts:11, and it is the failure this whole task exists
 * to prevent. An uncapped public surface is what produced the Vercel
 * overbilling incident.
 *
 * The throw is deliberately at CALL time, not module init, so `next build`
 * still succeeds without the variable present. In development it warns once and
 * uses the public endpoint, because requiring every contributor to hold a capped
 * key to run the app locally would just get the guard deleted.
 *
 * DEPLOY GATE: because this throws in production, BASE_SEPOLIA_RPC_URL must be
 * set in Vercel BEFORE this ships, or every verify page 500s. That is the
 * intended coupling to DEV-ANVS-001 S0.2 — the capped key is a prerequisite for
 * this host being crawlable, not an afterthought.
 */
let warnedInDev = false;

function resolveRpcUrl(): string {
  const configured = process.env.BASE_SEPOLIA_RPC_URL;
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "BASE_SEPOLIA_RPC_URL is not set. The public read path must use a " +
        "dedicated, spend-capped RPC key — refusing to fall back to the shared " +
        "public endpoint in production (see DEV-ANVS-001 S0.2).",
    );
  }

  if (!warnedInDev) {
    warnedInDev = true;
    console.warn(
      "[contract.server] BASE_SEPOLIA_RPC_URL unset — using the public endpoint. " +
        "This would throw in production.",
    );
  }
  return PUBLIC_FALLBACK_RPC;
}

/**
 * THE server-side chain transport. Built lazily so that resolveRpcUrl() runs on
 * first use rather than at import time — a module-init throw would break the
 * build, which would get this guard removed rather than fixed.
 */
// Inferred from this factory rather than annotated as
// ReturnType<typeof createPublicClient>: that bare form erases the concrete
// `chain: baseSepolia` binding, which turns every downstream getBlock()/
// readContract() into a structurally-incompatible union.
function createClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(resolveRpcUrl()),
  });
}

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getPublicClient(): ReturnType<typeof createClient> {
  if (!cachedClient) cachedClient = createClient();
  return cachedClient;
}

/**
 * THE resolver. Every surface on this host — the SSR asset page, the SUN/GS1 tap
 * routes, the DPP credential and the public JSON read at /api/asset/[tokenId] —
 * gets its lifecycle verdict from this one function. A verification host with
 * two readers eventually disagrees with itself, and then neither answer is worth
 * anything. Do not add a second `readContract({ functionName: "getAsset" })`.
 *
 * It is now unreachable from the browser, which strengthens that invariant rather
 * than duplicating it: there is still exactly one implementation, and it is the
 * only one that can exist, because a second copy in a client component would need
 * its own transport and would fail the build here.
 *
 * `blockNumber` pins the read to a specific block instead of "latest". It exists
 * so a caller can publish the block it read at and let anyone re-derive the same
 * verdict independently:
 *
 *   cast call 0x3aDc…1d1D "getAsset(uint256)" <tokenId> \
 *        --block <blockNumber> --rpc-url https://sepolia.base.org
 *
 * That is the whole point of the chainRef in the public API response — a chain
 * reference whose values cannot reproduce the verdict is worse than none,
 * because it looks like a proof. Omitted (the default) reads the chain head,
 * which is what every existing caller wants.
 *
 * An unminted token does NOT revert here: the contract returns a zero record
 * with state 0. Callers must treat state 0 as "no record", not as an error.
 */
export async function getAsset(tokenId: bigint, blockNumber?: bigint) {
  const [owner, timestamp, state, flags, reserved] = (await getPublicClient().readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "getAsset",
    args: [tokenId],
    ...(blockNumber === undefined ? {} : { blockNumber }),
  })) as [string, bigint, number, number, number];

  return { owner, timestamp, state, flags, reserved };
}

export async function getTokenByTag(tagHash: `0x${string}`) {
  return getPublicClient().readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "getTokenByTag",
    args: [tagHash],
  });
}

export async function getTagByToken(tokenId: bigint) {
  return getPublicClient().readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "getTagByToken",
    args: [tokenId],
  });
}

/**
 * Read the on-chain metadata content hash — keccak256 of the off-chain DPP
 * metadata JSON. This is the integrity anchor: if the off-chain passport bytes
 * change, their keccak256 no longer matches this value, so tampering is
 * detectable. Returns null (not a throw) for the zero hash / unset.
 */
export async function getMetadataHash(tokenId: bigint): Promise<`0x${string}` | null> {
  const hash = (await getPublicClient().readContract({
    address: CONTRACT_ADDRESS,
    abi: TAGITCoreABI,
    functionName: "metadataHash",
    args: [tokenId],
  })) as `0x${string}`;
  if (!hash || /^0x0{64}$/.test(hash)) return null;
  return hash;
}
