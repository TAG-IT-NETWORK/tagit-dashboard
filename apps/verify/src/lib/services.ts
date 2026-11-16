import "server-only";

/**
 * tagit-services API client — the verify app's data plane (META-T17 cutover).
 *
 * Product/media/price/verification data comes from GET
 * {SERVICES_URL}/api/v1/assets/:tokenId instead of the old hardcoded
 * ASSET_METADATA map. Every fetch is tagged `token-<id>` so the
 * POST /api/revalidate webhook (signed by tagit-services) can bust exactly the
 * pages whose token changed, and carries a 60s revalidate as the fallback TTL.
 *
 * `server-only`: SERVICES_URL stays on the server; the browser talks to this
 * host's own route handlers (/api/asset/[tokenId]/price, /api/buy), never to
 * tagit-services directly.
 */

export const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

/** Cache tag for one token's public surfaces. Shared with /api/revalidate. */
export function tokenTag(tokenId: string): string {
  return `token-${tokenId}`;
}

// ── DTO types (mirrors tagit-services src/api/assets.ts detail response) ─────

export interface AssetMediaEntry {
  role: string;
  url: string;
  mime: string;
  /** Base64 data-URI low-quality placeholder, when the media pipeline baked one. */
  lqip?: string;
}

export interface AssetProductBlock {
  name?: string;
  brand?: string;
  model?: string;
  sku?: string;
  origin?: string;
  category?: string;
  gtin?: string;
}

/**
 * Product facts a brand wrote for shoppers (TAP-T09) — the `facts` block of
 * tagit-services' item record (src/catalog/product-facts.ts, PublicFacts).
 * Present only for a cosmetics item with at least one fact; only the filled
 * keys are sent. Dates are YYYY-MM-DD. Every string is brand-written plain
 * text: show it as text, never as markup (REQ-S-10).
 */
export interface AssetFactsBlock {
  size?: string;
  ingredients?: string;
  howToUse?: string;
  warnings?: string;
  /** Whole months the product keeps once opened. */
  useWithinMonths?: number;
  /** The batch (lot) the item came from. */
  lot?: string;
  madeOn?: string;
  bestBefore?: string;
}

export interface AssetVerificationBlock {
  anchoredVersion: number | null;
  latestVersion: number | null;
  anchorStatus: string | null;
  metadataHash: string | null;
  verified: boolean;
  /** Present only on the restricted minimal envelope. */
  status?: string;
}

/**
 * FX approximation block, nested INSIDE the price block by the services detail
 * DTO. `approx` is a PRE-FORMATTED decimal string with the currency's exponent
 * already applied by the server (EUR -> "66.54", JPY -> "12366" with no
 * decimals). It must be rendered AS-IS — never re-formatted with toFixed or
 * Intl number formatting, which would silently assert a precision the server
 * did not produce. See @/lib/fx for the one renderer.
 *
 * The block appears only when the request carries `?currency=` (see
 * DISPLAY_CURRENCY below) or the listing has an msrp currency.
 */
export interface AssetPriceFx {
  currency: string;
  approx: string;
}

/** Canonical price object (tagit-services src/pricing/service.ts). */
export interface AssetPrice {
  tokenId: string;
  priceUsdc6: string | null;
  display: string | null;
  msrp?: { amount: number; currency: string };
  fx?: AssetPriceFx;
  saleState: "not_for_sale" | "listed" | "sold";
  version: number;
  purchase?: {
    payTo: string;
    token: string;
    chainId: number;
    settleEndpoint: string;
  };
}

/**
 * One history event as tagit-services returns it from
 * GET /api/v1/assets/:tokenId/provenance (see fetchAssetProvenance below).
 */
export interface AssetProvenanceEntry {
  type: string;
  label?: string;
  blockNumber: number;
  txHash: string;
  timestamp?: number;
  data?: Record<string, unknown>;
}

/**
 * The item record this host reads — the LEAN view (see assetUrl). It carries
 * no history: history has its own route and its own fetch.
 */
export interface AssetDto {
  tokenId: string;
  owner?: string; // truncated by the API (shortAddr)
  stateCode?: number;
  lifecycleState?: string;
  name?: string;
  image?: string;
  timestamp?: number;
  description?: string;
  tokenURI?: string;
  tagHash?: string;
  flags?: number;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  restricted?: boolean;
  product?: AssetProductBlock;
  facts?: AssetFactsBlock;
  media?: AssetMediaEntry[];
  price?: AssetPrice;
  verification?: AssetVerificationBlock;
}

export type AssetLookup =
  | { kind: "record"; dto: AssetDto }
  | { kind: "restricted"; dto: AssetDto }
  | { kind: "none" } // 404 — no on-chain record / unknown token
  | { kind: "unavailable" }; // services unreachable or 5xx

/**
 * Display currency requested from the services API for the fx approximation
 * (META-T37).
 *
 * DELIBERATELY A FIXED CONSTANT, NOT Accept-Language. Reading request headers
 * in this render path would mark the /asset/[tokenId] route dynamic and opt it
 * out of Next's Full Route Cache — the primary cost control for this host (see
 * the caching note in src/app/asset/[tokenId]/page.tsx). It would also cache
 * one visitor's locale into the shared 60s ISR entry for every subsequent
 * visitor, which is worse than a consistent default. EUR is the default
 * because the verify host's fx line exists for the EU Digital Product
 * Passport audience; the amount is explicitly approximate either way.
 * Per-viewer currency selection, if it ever ships, belongs in a client island
 * against the price proxy — not here.
 */
export const DISPLAY_CURRENCY = "EUR";

/**
 * How long this host waits for tagit-services before giving up on product
 * copy. A tap must never hang on it: the lookup resolves to "unavailable" and
 * the page still renders its verdict. Generous, because a cold services
 * function can take a few seconds to start.
 */
export const ASSET_TIMEOUT_MS = 8_000;

/**
 * URL of the item record this host reads.
 *
 * `view=lean` (TAP-T06) is the point: the full view builds the item's history
 * by paging through the block explorer — about 5 s when it is not cached —
 * and nothing rendered from this record shows history. Every page on this
 * host, the tap pages first of all, reads the lean view. History is fetched
 * separately (fetchAssetProvenance) by the one route that shows it.
 *
 * `currency=` asks the services API to include the price.fx approximation
 * block in the requested display currency (fx also appears without the param
 * when the listing carries an msrp currency).
 */
export function assetUrl(tokenId: string): string {
  return `${SERVICES_URL}/api/v1/assets/${tokenId}?currency=${DISPLAY_CURRENCY}&view=lean`;
}

/** URL of the item's history on tagit-services. */
export function assetProvenanceUrl(tokenId: string): string {
  return `${SERVICES_URL}/api/v1/assets/${tokenId}/provenance`;
}

/**
 * Server-side fetch of one asset DTO (lean view). Tagged + 60s ISR so a cache
 * hit costs nothing and the revalidate webhook can invalidate it precisely.
 */
export async function fetchAsset(tokenId: string): Promise<AssetLookup> {
  if (!/^\d+$/.test(tokenId)) return { kind: "none" };
  try {
    const res = await fetch(assetUrl(tokenId), {
      headers: { accept: "application/json" },
      next: { tags: [tokenTag(tokenId)], revalidate: 60 },
      signal: AbortSignal.timeout(ASSET_TIMEOUT_MS),
    });
    if (res.status === 404) return { kind: "none" };
    if (!res.ok) return { kind: "unavailable" };
    const dto = (await res.json()) as AssetDto;
    if (dto.restricted === true) return { kind: "restricted", dto };
    return { kind: "record", dto };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * How long this host waits for an item's history. The route behind it scans
 * the block explorer (about 5 s when nothing is cached), so the limit is
 * generous — but a hung call must still end, as "no history to show".
 */
export const PROVENANCE_TIMEOUT_MS = 15_000;

/**
 * Server-side fetch of one item's history from tagit-services, for the
 * provenance timeline's fallback. Slow on a cache miss (the explorer scan
 * lives behind this route now), so nothing on a tap path may call it.
 *
 * Returns null when there is nothing to show: services unreachable or too
 * slow, the item unknown, or the item restricted (the protected envelope
 * carries no history).
 */
export async function fetchAssetProvenance(
  tokenId: string,
): Promise<AssetProvenanceEntry[] | null> {
  if (!/^\d+$/.test(tokenId)) return null;
  try {
    const res = await fetch(assetProvenanceUrl(tokenId), {
      headers: { accept: "application/json" },
      next: { tags: [tokenTag(tokenId)], revalidate: 60 },
      signal: AbortSignal.timeout(PROVENANCE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { provenance?: unknown } | null;
    return body && Array.isArray(body.provenance)
      ? (body.provenance as AssetProvenanceEntry[])
      : null;
  } catch {
    return null;
  }
}

/** Hero image URL for a DTO: the hero media entry, else the legacy image field. */
export function heroMedia(dto: AssetDto): AssetMediaEntry | undefined {
  const hero = dto.media?.find((m) => m.role === "hero" || m.role === "primary");
  if (hero) return hero;
  if (dto.image) return { role: "hero", url: dto.image, mime: "image/*" };
  return undefined;
}

// ── Sitemap source ───────────────────────────────────────────────────────────

export interface PublicSitemapEntry {
  tokenId: string;
  lastModified: Date;
}

/**
 * Public + anchored tokens for sitemap.xml, from the services API — NOT a
 * hardcoded list of verdicts.
 *
 * Primary source: GET /api/v1/assets/public (the services public-list
 * endpoint; returns only public+anchored tokens). Until that endpoint ships,
 * the curated candidate ids are probed through the detail API and only ids the
 * API reports as public AND anchored (verification.verified) are listed —
 * restricted or unanchored tokens never reach the sitemap.
 */
export async function fetchPublicSitemapEntries(
  candidateIds: readonly string[],
): Promise<PublicSitemapEntry[]> {
  // Preferred: dedicated public list endpoint.
  try {
    const res = await fetch(`${SERVICES_URL}/api/v1/assets/public`, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const body = (await res.json()) as {
        assets?: Array<{ tokenId?: string; lastModified?: string; timestamp?: number }>;
      };
      const entries = (body.assets ?? [])
        .filter(
          (a): a is { tokenId: string; lastModified?: string; timestamp?: number } =>
            typeof a.tokenId === "string" && /^\d+$/.test(a.tokenId),
        )
        .map((a) => ({
          tokenId: a.tokenId,
          lastModified: a.lastModified
            ? new Date(a.lastModified)
            : a.timestamp
              ? new Date(a.timestamp * 1000)
              : new Date(),
        }));
      if (entries.length > 0) return entries;
    }
  } catch {
    // fall through to the probe path
  }

  // Fallback: probe curated candidates through the detail API.
  const probes = await Promise.all(
    candidateIds.map(async (id) => {
      const lookup = await fetchAsset(id);
      if (lookup.kind !== "record") return null;
      const { dto } = lookup;
      if (!dto.verification?.verified) return null;
      return {
        tokenId: id,
        lastModified: dto.timestamp ? new Date(dto.timestamp * 1000) : new Date(),
      };
    }),
  );
  return probes.filter((p): p is PublicSitemapEntry => p !== null);
}
