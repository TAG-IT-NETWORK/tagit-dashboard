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
 *
 * WHAT A PERSON READS HERE (TAP-T08). Plain words, from @/lib/consumer-copy,
 * laid out by <RecordResult>: what the brand's record says, the product, and
 * a closed "Technical details" section holding the record number, the network,
 * the state code and the link to the public record. Nobody tapped a tag to
 * reach this page, so it never says the product in the reader's hand was
 * checked. The <title>, meta description and JSON-LD below are written for
 * machines and are unchanged.
 */
import { cache } from "react";
import type { Metadata } from "next";
import { CONTRACT_ADDRESS } from "@/lib/contract";
// CHAIN_ID / CHAIN_NAME come from @/lib/dpp rather than being redeclared here,
// so this page, the JSON-LD passport and the tap routes can never disagree
// about which chain a verdict was read from.
import { CHAIN_ID, CHAIN_NAME } from "@/lib/dpp";
import { fetchAsset, type AssetLookup } from "@/lib/services";
import { COPY } from "@/lib/consumer-copy";
import { STATES } from "@/lib/states";
import { recordPageModel } from "@/lib/tap-page";
import { recordHistoryStatus } from "@/lib/tap-view";
import { HeroImage } from "@/components/hero-image";
import { RatingLine, ReviewsSection } from "@/components/rating-summary";
import { RateWidget } from "@/components/rate-widget";
import { RecordResult } from "@/components/record-result";
import { fetchRatings } from "@/lib/ratings";
import { ProvenanceTimeline } from "@/components/provenance-timeline";
import { AssetClientIsland } from "./asset-client";

/**
 * Shared 60s cache for the token-id read path. Next 15 requires segment
 * config to be a literal, so this mirrors CHAIN_READ_TTL_SECONDS in
 * src/lib/cache.ts — keep the two in sync.
 */
export const revalidate = 60;

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

interface PageProps {
  params: Promise<{ tokenId: string }>;
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
  const { tokenId } = await params;
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
  const { tokenId } = await params;
  const lookup = await resolveAsset(tokenId);
  // What the page may show. The record's owner field is not part of it.
  const model = recordPageModel(lookup, tokenId);
  const { product } = model;

  // Everything but a full record is a short page: no product, no extras.
  if (lookup.kind !== "record" || !product) {
    return (
      <RecordResult
        state={model.state}
        recordNumber={model.recordNumber}
        technical={model.technical}
        retryHref={lookup.kind === "unavailable" ? `/asset/${tokenId}` : undefined}
      />
    );
  }

  // Reviews are shown for an item that is on sale or owned (see <RecordResult>),
  // so they are only read for one.
  const ratings = model.state === "registered" ? await fetchRatings(tokenId) : null;

  return (
    <RecordResult
      state={model.state}
      product={product}
      chips={model.chips}
      recordNumber={model.recordNumber}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      jsonLd={model.jsonLd}
      slots={{
        photo: product.photo ? (
          <HeroImage
            src={product.photo.url}
            alt={COPY.product.photoAlt(product.name)}
            lqip={product.photo.lqip}
          />
        ) : undefined,
        // The buy flow lives in the client island; the widget fetches its own
        // server price and hides itself when there is no live listing.
        buy: (
          <AssetClientIsland
            tokenId={tokenId}
            stateCode={model.stateCode}
            productName={product.name}
          />
        ),
        rating: <RatingLine view={ratings} />,
        reviews: (
          <ReviewsSection
            view={ratings}
            write={<RateWidget tokenId={tokenId} productName={product.name} />}
          />
        ),
        // Loaded CLIENT-SIDE after mount (DASH-T37-SUSPENSE-ISR): this route is
        // SSG/ISR, so the static HTML carries only the skeleton and the island
        // fetches /api/asset/[tokenId]/provenance — zero history work in this
        // render.
        history: (
          <ProvenanceTimeline
            tokenId={tokenId}
            brand={product.brand}
            status={recordHistoryStatus(model.stateCode)}
          />
        ),
      }}
    />
  );
}
