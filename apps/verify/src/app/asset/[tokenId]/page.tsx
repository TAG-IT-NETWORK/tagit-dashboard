/**
 * Token-id verification page — /asset/{tokenId}
 *
 * WHY THIS IS A SERVER COMPONENT
 * ──────────────────────────────
 * This page used to be "use client" and did its chain read in the browser. The
 * architecture was correct and the result was invisible: GET /asset/18 returned
 * ~9.7KB of HTML containing ZERO verdict text — no lifecycle state, no timestamp,
 * no contract address — because all of it was produced after hydration. Two
 * different tokens produced responses differing by five bytes, all of them inside
 * the JS payload. Every crawler, agent and answer engine read a blank page, and
 * search engines saw one identical title across the whole host and treated the
 * URLs as duplicates.
 *
 * It is now an async server component that awaits the chain read, exactly like
 * src/app/01/[...segments]/page.tsx already did. The verdict is in the initial
 * HTML with JavaScript disabled.
 *
 * ONE RESOLVER. The chain read is `getAsset()` from @/lib/contract.server and the
 * product metadata is `loadProduct()` from @/lib/dpp — the same functions the
 * SUN/GS1 tap routes and the JSON-LD passport endpoint use. Do not add a second
 * path that reads the contract directly; a verification host with two resolvers
 * eventually disagrees with itself, and then neither answer is trustworthy.
 *
 * CACHING. `revalidate` + `generateStaticParams` below put this route in Next's
 * Full Route Cache with a 60s TTL, and src/middleware.ts asserts the matching
 * shared-cache directive on the wire. Together they are the primary cost control
 * for the host: a cache hit serves stored HTML with no render and no RPC read.
 * This is safe ONLY because a token-id read is a pure on-chain state lookup with
 * no cryptographic freshness requirement — read the boundary note in
 * src/lib/cache.ts before applying any of this to a SUN tap route.
 *
 * QUERY-PARAM PRODUCT OVERRIDES ARE INTENTIONALLY GONE. The old client page let
 * ?name=, ?brand=, ?msrp=, ?meta=… inject arbitrary product claims. On a page
 * that nobody could read, that was a harmless demo affordance. On a crawlable,
 * indexable verification page it is a content-spoofing vector: anyone could mint
 * a URL that renders their own product copy directly beside a genuine on-chain
 * "Authentic" verdict, and have search engines index it. Per-token metadata still
 * resolves server-side through loadProduct() (static map + its IPFS pointer),
 * which is keyed by token id and therefore not attacker-controlled. Keeping the
 * server render free of searchParams is also what keeps the route cacheable.
 */
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CONTRACT_ADDRESS } from "@/lib/contract";
// The chain read comes from the `server-only` half of the contract module, so
// the RPC URL cannot reach the browser bundle from this route. See the header
// of @/lib/contract.server.
import { getAsset } from "@/lib/contract.server";
// CHAIN_ID / CHAIN_NAME come from @/lib/dpp rather than being redeclared here,
// so this page, the JSON-LD passport and the tap routes can never disagree about
// which chain a verdict was read from.
import { CHAIN_ID, CHAIN_NAME, loadProduct } from "@/lib/dpp";
import { STATES, STATE_DESCRIPTIONS } from "@/lib/states";
import { Shell, StatusHero, DataCard } from "@/components/passport";
import { CHAIN_READ_TTL_SECONDS } from "@/lib/cache";
import { AssetClientIsland } from "./asset-client";

/** Shared 60s cache for the token-id read path. See src/lib/cache.ts. */
export const revalidate = CHAIN_READ_TTL_SECONDS;

/**
 * THIS EMPTY ARRAY IS LOAD-BEARING — DO NOT DELETE IT AS DEAD CODE.
 *
 * `revalidate` on its own does nothing here. A route with a dynamic segment and
 * no `generateStaticParams` is treated by the App Router as fully dynamic: it is
 * re-rendered (and re-reads the chain) on every single request and answers with
 * `Cache-Control: private, no-cache, no-store`. Declaring `generateStaticParams`
 * — even returning nothing to prebuild — opts the route into the Full Route
 * Cache, so `revalidate` starts applying and Next serves `s-maxage=60,
 * stale-while-revalidate` with an on-disk render cache behind it.
 *
 * Measured on a production build of this app:
 *   without it →  Cache-Control: private, no-cache, no-store, max-age=0
 *                 (prerender-manifest dynamicRoutes: {} — no route cache at all)
 *   with it    →  x-nextjs-cache: MISS then HIT
 *                 Cache-Control: s-maxage=60, stale-while-revalidate
 *
 * The HIT is the point: a cache hit serves the stored HTML without invoking the
 * renderer and therefore without an RPC read. That is the difference between one
 * chain read per token per minute and one chain read per bot request, which is
 * the entire cost argument for this host.
 *
 * The array is empty because there is no sensible set of token ids to prebuild —
 * the corpus grows on-chain, not at build time. `dynamicParams` defaults to true,
 * so every id still renders on demand and is cached on first hit.
 */
export async function generateStaticParams(): Promise<{ tokenId: string }[]> {
  return [];
}

const EXPLORER = `https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`;

interface PageProps {
  params: { tokenId: string };
}

type Verdict =
  | { kind: "invalid" }
  | { kind: "unavailable" }
  | { kind: "record"; stateCode: number; timestamp: bigint };

/**
 * Read the on-chain record once per request. `cache()` dedupes the call between
 * generateMetadata() and the page body, which would otherwise issue two
 * identical RPC reads for every render.
 *
 * Note what is NOT returned: the owner address. It is dropped here rather than at
 * the render site so it cannot reach the server HTML or the RSC flight payload by
 * accident — see the privacy note in ./asset-client.tsx.
 */
const readVerdict = cache(async (tokenId: string): Promise<Verdict> => {
  if (!/^\d+$/.test(tokenId)) return { kind: "invalid" };
  try {
    const asset = await getAsset(BigInt(tokenId));
    return { kind: "record", stateCode: asset.state, timestamp: asset.timestamp };
  } catch {
    // An unminted token does NOT revert — getAsset returns a zero record with
    // state 0, handled as a real "no record" verdict below. Reaching this branch
    // means the RPC itself failed, so we say that plainly instead of inventing a
    // verdict. This response can be edge-cached for up to the TTL; bounded
    // staleness on an explicit error banner beats every bot re-hitting a failing
    // RPC endpoint.
    return { kind: "unavailable" };
  }
});

function stateName(code: number): string {
  return (STATES[code] ?? STATES[0]).label;
}

/** UTC only. The server has no idea what timezone the reader is in, and a
 *  verification record should be unambiguous rather than friendly. */
function formatUtc(ts: bigint): string {
  return `${new Date(Number(ts) * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tokenId } = params;
  const verdict = await readVerdict(tokenId);

  // Every URL on this host used to share one title, which is why search engines
  // collapsed them as duplicates. Title and description are now per-asset and
  // carry the verdict itself, so a result snippet is useful without a click.
  if (verdict.kind === "invalid") {
    return {
      title: "Invalid token id | TAG IT Verify",
      description: "This is not a valid TAG IT token id.",
      robots: { index: false, follow: false },
    };
  }

  if (verdict.kind === "unavailable") {
    return {
      title: `Token ${tokenId} — verification unavailable | TAG IT Verify`,
      description: `Could not read the TAG IT record for token ${tokenId} from ${CHAIN_NAME} (chainId ${CHAIN_ID}).`,
      robots: { index: false, follow: false },
    };
  }

  const { stateCode, timestamp } = verdict;
  const name = stateName(stateCode);

  if (stateCode === 0) {
    return {
      title: `Token ${tokenId} — NO RECORD — ${CHAIN_NAME} testnet | TAG IT Verify`,
      description: `No TAG IT record exists for token ${tokenId} on ${CHAIN_NAME} (chainId ${CHAIN_ID}), contract ${CONTRACT_ADDRESS}. Lifecycle state NONE (0). Unaudited testnet deployment.`,
      // Nothing to index: this is the response for every unminted id, so it is
      // an unbounded set of near-identical pages. Keeping them out of the index
      // is both correct and what stops crawlers enumerating token ids.
      robots: { index: false, follow: false },
      alternates: { canonical: `/asset/${tokenId}` },
    };
  }

  const description = `TAG IT verification for token ${tokenId}: lifecycle state ${name} (${stateCode}), registered ${formatUtc(timestamp)}, contract ${CONTRACT_ADDRESS} on ${CHAIN_NAME} (chainId ${CHAIN_ID}). Unaudited testnet deployment.`;
  const title = `Token ${tokenId} — ${name} — ${CHAIN_NAME} testnet | TAG IT Verify`;

  return {
    title,
    description,
    alternates: { canonical: `/asset/${tokenId}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function AssetVerifyPage({ params }: PageProps) {
  const { tokenId } = params;
  const verdict = await readVerdict(tokenId);

  if (verdict.kind === "invalid") {
    return (
      <Shell>
        <StatusHero
          tone="warn"
          glyph="?"
          title="Invalid Token"
          sub="A TAG IT token id is a non-negative integer."
        />
        <Disclosure />
        <HomeLink />
      </Shell>
    );
  }

  if (verdict.kind === "unavailable") {
    return (
      <Shell>
        <StatusHero
          tone="warn"
          glyph="!"
          title="Verification Unavailable"
          sub={`Could not read the ${CHAIN_NAME} record for this token. No verdict is being asserted.`}
        />
        <DataCard
          rows={[
            ["Token ID", tokenId],
            ["Contract", CONTRACT_ADDRESS],
            ["Chain", `${CHAIN_NAME} (chainId ${CHAIN_ID})`],
          ]}
        />
        <Disclosure />
        <HomeLink />
      </Shell>
    );
  }

  const { stateCode, timestamp } = verdict;
  const name = stateName(stateCode);

  // State 0 is a real, honest answer, not an error: an unminted token id returns
  // a zero record rather than reverting. Say "no record", never a fake verdict.
  if (stateCode === 0) {
    return (
      <Shell>
        <StatusHero
          tone="warn"
          glyph="○"
          title="No Record"
          sub="No TAG IT digital twin exists for this token id."
        />
        <DataCard
          rows={[
            ["Token ID", tokenId],
            ["Lifecycle state", `${name} (${stateCode})`],
            ["Registered", "never"],
            ["Contract", CONTRACT_ADDRESS],
            ["Chain", `${CHAIN_NAME} (chainId ${CHAIN_ID})`],
          ]}
        />
        <p className="text-center text-xs text-gray-500 mb-5">
          This token id has not been minted. Absence of a record is not evidence that a physical
          product is counterfeit — it means this id was never registered with TAG IT.
        </p>
        <Disclosure />
        <HomeLink />
      </Shell>
    );
  }

  const product = await loadProduct(tokenId);
  const displayName = product.name || `Token #${tokenId}`;
  const authentic = stateCode >= 1 && stateCode <= 4;
  const state = STATES[stateCode] ?? STATES[0];

  const rows: [string, string][] = [
    ["Product", displayName],
    ["Token ID", tokenId],
    ["Lifecycle state", `${name} (${stateCode})`],
    ...(product.brand ? ([["Brand", product.brand]] as [string, string][]) : []),
    ...(product.sku ? ([["SKU", product.sku]] as [string, string][]) : []),
    ...(product.origin ? ([["Origin", product.origin]] as [string, string][]) : []),
    ...(product.size ? ([["Size", product.size]] as [string, string][]) : []),
    ...(product.msrp ? ([["MSRP", product.msrp]] as [string, string][]) : []),
    ["Registered", formatUtc(timestamp)],
    ["Contract", CONTRACT_ADDRESS],
    ["Chain", `${CHAIN_NAME} (chainId ${CHAIN_ID})`],
  ];

  return (
    <Shell>
      <StatusHero
        tone={authentic ? "ok" : "warn"}
        glyph={authentic ? "✓" : stateCode === 5 ? "⚑" : "⌀"}
        title={
          authentic ? "Authentic" : stateCode === 5 ? "Flagged" : stateCode === 6 ? "Retired" : "Unknown"
        }
        sub={
          authentic
            ? `Verified on-chain — lifecycle state ${name}`
            : STATE_DESCRIPTIONS[stateCode] ?? ""
        }
      />

      <div className="flex justify-center mb-8 animate-fadeUp" style={{ animationDelay: "0.25s" }}>
        <div
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border ${state.bg} ${state.border}`}
        >
          <span className="w-2 h-2 rounded-full animate-pulse-dot" />
          <span className={`text-sm font-bold tracking-wider ${state.text}`}>
            {name} ({stateCode})
          </span>
        </div>
      </div>

      <DataCard rows={rows} />

      {product.description && (
        <div
          className="rounded-2xl border border-white/10 p-5 mb-5 animate-fadeUp"
          style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.4s" }}
        >
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>
      )}

      {/* Owner display and the Privy-backed buy flow live in the client island so
          the wallet address never enters the crawlable payload. */}
      <AssetClientIsland tokenId={tokenId} stateCode={stateCode} productName={displayName} />

      <Disclosure />

      <div className="text-center space-y-2 text-xs text-gray-600 font-mono">
        <Link
          href={EXPLORER}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:underline block"
        >
          View contract on {CHAIN_NAME}
        </Link>
      </div>
    </Shell>
  );
}

/**
 * Explicit network + audit disclosure, server-rendered on every branch. A
 * verification host that does not say which chain it read, and whether that code
 * has been audited, is asserting more confidence than it has earned.
 */
function Disclosure() {
  return (
    // Interpolated into single strings rather than written as mixed JSX: React
    // splits adjacent text nodes with `<!-- -->` markers in the HTML, which
    // breaks the disclosure into fragments for anything doing plain text
    // extraction. The disclosure is the part that most needs to survive that.
    <p className="text-center text-xs text-gray-600 leading-relaxed mb-5">
      {`${CHAIN_NAME} testnet (chainId ${CHAIN_ID}) · UNAUDITED contract`}
      <br />
      {"Testnet records carry no economic guarantee and this deployment has not completed a security audit. Do not rely on it for commercial settlement."}
    </p>
  );
}

function HomeLink() {
  return (
    <div className="text-center">
      <Link href="/" className="text-[#00D68F] hover:underline text-sm">
        Back to TAG IT Verify
      </Link>
    </div>
  );
}
