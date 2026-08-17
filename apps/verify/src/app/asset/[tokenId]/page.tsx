/**
 * Token-id verification page — /asset/{tokenId}
 *
 * META-T17 CUTOVER: this page's resolver is now the tagit-services assets API
 * (GET {SERVICES_URL}/api/v1/assets/:tokenId via @/lib/services), not a direct
 * chain read. The API reads chain state live server-side, overlays the
 * anchored product doc (DB-first), enforces the restricted-item redaction in
 * ONE place (services visibility.ts), and hands back product/media/price/
 * verification blocks this page renders verbatim. Do not add a second
 * resolver here: a verification host with two resolvers eventually disagrees
 * with itself, and then neither answer is trustworthy.
 *
 * CACHING. The services fetch is tagged `token-<id>` with a 60s revalidate
 * (see @/lib/services), `revalidate` + `generateStaticParams` below put the
 * route itself in Next's Full Route Cache, and POST /api/revalidate (signed
 * webhook from tagit-services) busts exactly the tags of changed tokens. A
 * cache hit serves stored HTML with no render and no upstream read — the
 * primary cost control for this host.
 *
 * SERVER-RENDERED, still: the verdict is in the initial HTML with JavaScript
 * disabled, per-asset <title>/<meta>, and ONE schema.org Product JSON-LD
 * block per page (matching the www.tagit.network one-block convention) —
 * offers only while the pricing API reports a live listing.
 *
 * QUERY-PARAM PRODUCT OVERRIDES REMAIN GONE. Product copy resolves only from
 * the token id through the services API; nothing on this route honors
 * caller-supplied metadata.
 */
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CONTRACT_ADDRESS } from "@/lib/contract";
// CHAIN_ID / CHAIN_NAME come from @/lib/dpp rather than being redeclared here,
// so this page, the JSON-LD passport and the tap routes can never disagree
// about which chain a verdict was read from.
import { CHAIN_ID, CHAIN_NAME } from "@/lib/dpp";
import { fetchAsset, heroMedia, type AssetLookup } from "@/lib/services";
import { anchorVerdict } from "@/lib/anchor-verdict";
import { buildProductJsonLd } from "@/lib/jsonld";
import { siteUrl } from "@/lib/site";
import { STATES, STATE_DESCRIPTIONS } from "@/lib/states";
import { Shell, StatusHero, DataCard } from "@/components/passport";
import { HeroImage } from "@/components/hero-image";
import { CHAIN_READ_TTL_SECONDS } from "@/lib/cache";
import { AssetClientIsland } from "./asset-client";

/** Shared 60s cache for the token-id read path. See src/lib/cache.ts. */
export const revalidate = CHAIN_READ_TTL_SECONDS;

/**
 * THIS EMPTY ARRAY IS LOAD-BEARING — DO NOT DELETE IT AS DEAD CODE.
 *
 * `revalidate` on its own does nothing here. A route with a dynamic segment
 * and no `generateStaticParams` is treated by the App Router as fully
 * dynamic: re-rendered on every request and answered with
 * `Cache-Control: private, no-cache, no-store`. Declaring
 * `generateStaticParams` — even returning nothing to prebuild — opts the
 * route into the Full Route Cache, so `revalidate` applies and Next serves
 * `s-maxage=60, stale-while-revalidate` with an on-disk render cache behind
 * it. The array is empty because the corpus grows in the services DB, not at
 * build time; `dynamicParams` defaults to true, so every id still renders on
 * demand and is cached on first hit.
 */
export async function generateStaticParams(): Promise<{ tokenId: string }[]> {
  return [];
}

const EXPLORER = `https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`;

interface PageProps {
  params: { tokenId: string };
}

/**
 * Resolve the DTO once per request. `cache()` dedupes between
 * generateMetadata() and the page body. Invalid ids never hit the network.
 */
const resolveAsset = cache(async (tokenId: string): Promise<AssetLookup | { kind: "invalid" }> => {
  if (!/^\d+$/.test(tokenId)) return { kind: "invalid" };
  return fetchAsset(tokenId);
});

function stateName(code: number | undefined): string {
  return (STATES[code ?? 0] ?? STATES[0]).label;
}

/** UTC only. The server has no idea what timezone the reader is in, and a
 *  verification record should be unambiguous rather than friendly. */
function formatUtc(tsSeconds: number): string {
  return `${new Date(tsSeconds * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tokenId } = params;
  const lookup = await resolveAsset(tokenId);

  if (lookup.kind === "invalid") {
    return {
      title: "Invalid token id | TAG IT Verify",
      description: "This is not a valid TAG IT token id.",
      robots: { index: false, follow: false },
    };
  }

  if (lookup.kind === "unavailable") {
    return {
      title: `Token ${tokenId} — verification unavailable | TAG IT Verify`,
      description: `Could not read the TAG IT record for token ${tokenId} (${CHAIN_NAME}, chainId ${CHAIN_ID}).`,
      robots: { index: false, follow: false },
    };
  }

  if (lookup.kind === "none") {
    return {
      title: `Token ${tokenId} — NO RECORD — ${CHAIN_NAME} testnet | TAG IT Verify`,
      description: `No TAG IT record exists for token ${tokenId} on ${CHAIN_NAME} (chainId ${CHAIN_ID}), contract ${CONTRACT_ADDRESS}. Unaudited testnet deployment.`,
      // Unbounded set of near-identical pages — keep them out of the index.
      robots: { index: false, follow: false },
      alternates: { canonical: `/asset/${tokenId}` },
    };
  }

  // Protected item: the owner restricted it. noindex — a protected page must
  // not accumulate search presence — and no per-product copy in the snippet.
  if (lookup.kind === "restricted") {
    return {
      title: `Token ${tokenId} — Protected item | TAG IT Verify`,
      description:
        "Details for this item are protected by its owner. Tap the TAG IT tag to verify authenticity.",
      robots: { index: false, follow: false },
      alternates: { canonical: `/asset/${tokenId}` },
    };
  }

  const { dto } = lookup;
  const name = stateName(dto.stateCode);
  const productName = dto.product?.name || dto.name;
  const registered = dto.timestamp ? formatUtc(dto.timestamp) : "unknown";
  const description = `TAG IT verification for ${productName ? `${productName} (token ${tokenId})` : `token ${tokenId}`}: lifecycle state ${name} (${dto.stateCode}), registered ${registered}, contract ${CONTRACT_ADDRESS} on ${CHAIN_NAME} (chainId ${CHAIN_ID}). Unaudited testnet deployment.`;
  const title = `${productName ? `${productName} — token ${tokenId}` : `Token ${tokenId}`} — ${name} — ${CHAIN_NAME} testnet | TAG IT Verify`;

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
  const lookup = await resolveAsset(tokenId);

  if (lookup.kind === "invalid") {
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

  if (lookup.kind === "unavailable") {
    return (
      <Shell>
        <StatusHero
          tone="warn"
          glyph="!"
          title="Verification Unavailable"
          sub="Could not read the TAG IT record for this token. No verdict is being asserted."
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

  // "No record" is a real, honest answer, not an error.
  if (lookup.kind === "none") {
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
            ["Contract", CONTRACT_ADDRESS],
            ["Chain", `${CHAIN_NAME} (chainId ${CHAIN_ID})`],
          ]}
        />
        <p className="text-center text-xs text-gray-500 mb-5">
          This token id has not been registered. Absence of a record is not evidence that a physical
          product is counterfeit — it means this id was never registered with TAG IT.
        </p>
        <Disclosure />
        <HomeLink />
      </Shell>
    );
  }

  // ── Protected item: minimal render, NO product copy, NO JSON-LD ────────────
  if (lookup.kind === "restricted") {
    return (
      <Shell>
        <StatusHero
          tone="warn"
          glyph="🛡"
          title="Protected Item"
          sub="Details for this item are protected by its owner."
        />
        <DataCard
          rows={[
            ["Token ID", tokenId],
            ["Contract", CONTRACT_ADDRESS],
            ["Chain", `${CHAIN_NAME} (chainId ${CHAIN_ID})`],
          ]}
        />
        <p className="text-center text-xs text-gray-500 mb-5">
          Tap the physical TAG IT tag to verify this item&apos;s authenticity. The owner has
          restricted its public details.
        </p>
        <Disclosure />
        <HomeLink />
      </Shell>
    );
  }

  const { dto } = lookup;
  const stateCode = dto.stateCode ?? 0;
  const name = stateName(stateCode);
  const displayName = dto.product?.name || dto.name || `Token #${tokenId}`;
  const authentic = stateCode >= 1 && stateCode <= 4;
  const state = STATES[stateCode] ?? STATES[0];
  const hero = heroMedia(dto);
  const anchor = anchorVerdict(dto.verification);
  const jsonLd = buildProductJsonLd({ url: siteUrl(`/asset/${tokenId}`), dto });

  const rows: [string, string][] = [
    ["Product", displayName],
    ["Token ID", tokenId],
    ["Lifecycle state", `${name} (${stateCode})`],
    ...(dto.product?.brand ? ([["Brand", dto.product.brand]] as [string, string][]) : []),
    ...(dto.product?.model ? ([["Model", dto.product.model]] as [string, string][]) : []),
    ...(dto.product?.sku ? ([["SKU", dto.product.sku]] as [string, string][]) : []),
    ...(dto.product?.origin ? ([["Origin", dto.product.origin]] as [string, string][]) : []),
    ...(dto.timestamp ? ([["Registered", formatUtc(dto.timestamp)]] as [string, string][]) : []),
    ["Contract", CONTRACT_ADDRESS],
    ["Chain", `${CHAIN_NAME} (chainId ${CHAIN_ID})`],
  ];

  const bandClasses: Record<string, string> = {
    green: "border-[#00D68F]/40 bg-[#00D68F]/10 text-[#00D68F]",
    yellow: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    red: "border-red-500/40 bg-red-500/10 text-red-400",
  };

  return (
    <Shell>
      {/* ONE JSON-LD block per page — the www.tagit.network convention. */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <StatusHero
        tone={authentic ? "ok" : "warn"}
        glyph={authentic ? "✓" : stateCode === 5 ? "⚑" : "⌀"}
        title={
          authentic
            ? "Authentic"
            : stateCode === 5
              ? "Flagged"
              : stateCode === 6
                ? "Retired"
                : "Unknown"
        }
        sub={
          authentic
            ? `Verified on-chain — lifecycle state ${name}`
            : (STATE_DESCRIPTIONS[stateCode] ?? "")
        }
      />

      <div className="flex justify-center mb-4 animate-fadeUp" style={{ animationDelay: "0.25s" }}>
        <div
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border ${state.bg} ${state.border}`}
        >
          <span className="w-2 h-2 rounded-full animate-pulse-dot" />
          <span className={`text-sm font-bold tracking-wider ${state.text}`}>
            {name} ({stateCode})
          </span>
        </div>
      </div>

      {/* Tri-state metadata-anchor verdict band (green / yellow / red). */}
      <div
        className={`rounded-xl border px-4 py-2.5 mb-6 text-center animate-fadeUp ${bandClasses[anchor.tone]}`}
        style={{ animationDelay: "0.3s" }}
      >
        <span className="text-sm font-bold tracking-wide">{anchor.label}</span>
        <span className="block text-[11px] opacity-80 mt-0.5">{anchor.detail}</span>
      </div>

      {hero && <HeroImage src={hero.url} alt={displayName} lqip={hero.lqip} />}

      <DataCard rows={rows} />

      {dto.description && (
        <div
          className="rounded-2xl border border-white/10 p-5 mb-5 animate-fadeUp"
          style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.4s" }}
        >
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
            {dto.description}
          </p>
        </div>
      )}

      {/* The buy flow lives in the client island; the widget fetches its own
          server price and hides itself when there is no live listing. */}
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
 * verification host that does not say which chain it read, and whether that
 * code has been audited, is asserting more confidence than it has earned.
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
      {
        "Testnet records carry no economic guarantee and this deployment has not completed a security audit. Do not rely on it for commercial settlement."
      }
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
