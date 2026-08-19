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

export interface AssetVerificationBlock {
  anchoredVersion: number | null;
  latestVersion: number | null;
  anchorStatus: string | null;
  metadataHash: string | null;
  verified: boolean;
  /** Present only on the restricted minimal envelope. */
  status?: string;
}

/** Canonical price object (tagit-services src/pricing/service.ts). */
export interface AssetPrice {
  tokenId: string;
  priceUsdc6: string | null;
  display: string | null;
  msrp?: { amount: number; currency: string };
  saleState: "not_for_sale" | "listed" | "sold";
  version: number;
  purchase?: {
    payTo: string;
    token: string;
    chainId: number;
    settleEndpoint: string;
  };
}

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
 * Server-side fetch of one asset DTO. Tagged + 60s ISR so a cache hit costs
 * nothing and the revalidate webhook can invalidate it precisely.
 */
export async function fetchAsset(tokenId: string): Promise<AssetLookup> {
  if (!/^\d+$/.test(tokenId)) return { kind: "none" };
  try {
    const res = await fetch(`${SERVICES_URL}/api/v1/assets/${tokenId}`, {
      headers: { accept: "application/json" },
      next: { tags: [tokenTag(tokenId)], revalidate: 60 },
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
