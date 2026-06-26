/**
 * TAG IT Digital Product Passport (DPP) — data model + W3C Verifiable
 * Credential serializer. Server-only (reads on-chain data + IPFS).
 *
 * Layers (see DPP-001 spec in tagit-hardware):
 *   - Identity   : GS1 Digital Link (GTIN + serial) + the on-chain tokenId/UID.
 *   - Lifecycle  : TAGITCore 7-state FSM + owner + registration time.
 *   - Integrity  : on-chain metadataHash anchor (keccak256 of the OFF-CHAIN
 *                  product-metadata JSON — not the lifecycle/owner fields).
 *   - Presence   : NTAG 424 DNA SUN tap counter (clone/replay resistance).
 *
 * The machine-readable form is a W3C VCDM 2.0 credential typed both
 * `VerifiableCredential` and `DigitalProductPassport` (UN Transparency Protocol
 * DPP shape). It is intended to be consumable by UNTP-aware verifiers once the
 * TAG IT JSON-LD context and the issuer DID document are published (phase 2).
 * NOTE: v1 emits the credential WITHOUT a cryptographic `proof` — integrity
 * currently rests on the on-chain anchor in `evidence`. Issuer-DID signing
 * (Ed25519 / SD-JWT for role-scoped disclosure) is the phase-2 follow-up.
 */
import { CONTRACT_ADDRESS, getMetadataForToken } from "./contract";
import { STATES, STATE_DESCRIPTIONS } from "./states";

/** Base Sepolia — the primary chain the verifier reads (CAIP-2 eip155:84532). */
export const CHAIN_ID = 84532;
export const CHAIN_CAIP2 = `eip155:${CHAIN_ID}`;
export const CHAIN_NAME = "Base Sepolia";

/** Issuer identity for the passport credential (DID to be published, phase 2). */
export const ISSUER_DID = "did:web:id.tagit.network";
export const RESOLVER_BASE = "https://id.tagit.network";

const IPFS_GATEWAY = "https://w3s.link/ipfs/";

/** HTTPS hosts we trust to dereference a metadata source server-side. */
const ALLOWED_META_HOSTS = new Set([
  "w3s.link",
  "ipfs.io",
  "cloudflare-ipfs.com",
  "gateway.pinata.cloud",
  "nftstorage.link",
]);

/**
 * Convert an ipfs:// or https:// media URI for DISPLAY (rendered as an <img> the
 * browser fetches — not dereferenced by our server). Trusted-input only.
 */
export function ipfsToHttp(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) return IPFS_GATEWAY + uri.slice("ipfs://".length);
  return uri;
}

/**
 * SSRF guard: resolve a metadata SOURCE we will fetch() on the server into a
 * safe absolute URL, or undefined. The `?meta=` query param is attacker-
 * controlled, so we only honor ipfs:// (via our fixed gateway) or https:// on a
 * small gateway allowlist, and reject IP-literal / non-https hosts outright.
 * This blocks pivots to cloud metadata endpoints (169.254.169.254), localhost,
 * and internal services.
 */
export function safeMetaSource(metaSource?: string | null): string | undefined {
  if (!metaSource) return undefined;
  if (metaSource.startsWith("ipfs://")) {
    const path = metaSource.slice("ipfs://".length);
    if (!/^[A-Za-z0-9./_-]+$/.test(path)) return undefined;
    return IPFS_GATEWAY + path;
  }
  let u: URL;
  try {
    u = new URL(metaSource);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:") return undefined;
  if (!ALLOWED_META_HOSTS.has(u.hostname)) return undefined;
  // Defense-in-depth: reject IPv4/IPv6 literals even if somehow allowlisted.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || u.hostname.includes(":")) return undefined;
  return u.toString();
}

export interface ProductMetadata {
  name?: string;
  brand?: string;
  description?: string;
  image?: string;
  images?: string[];
  sku?: string;
  origin?: string;
  size?: string;
  msrp?: string;
}

/** Off-chain metadata JSON shape (as pinned to IPFS). */
interface RemoteMetadata extends ProductMetadata {}

/**
 * Fetch + normalize off-chain product metadata from an ipfs:// or https:// URL.
 * IPFS content is immutable by CID, so it's safe to cache aggressively.
 */
export async function fetchProductMetadata(metaSource?: string | null): Promise<ProductMetadata> {
  const url = safeMetaSource(metaSource);
  if (!url) return {};
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return {};
    const m = (await res.json()) as RemoteMetadata;
    return {
      name: m.name,
      brand: m.brand,
      description: m.description,
      image: ipfsToHttp(m.image),
      images: m.images?.map((u) => ipfsToHttp(u)).filter((u): u is string => !!u),
      sku: m.sku,
      origin: m.origin,
      size: m.size,
      msrp: m.msrp,
    };
  } catch {
    return {};
  }
}

/**
 * Resolve a token's product fields: off-chain IPFS metadata (via ?meta= or the
 * static map's pointer) overlaid on the static demo map. One source of truth
 * for both the HTML page and the JSON-LD endpoint.
 */
export async function loadProduct(
  tokenId: string,
  metaParam?: string | null,
): Promise<ProductMetadata> {
  const staticMeta = getMetadataForToken(tokenId);
  const remote = await fetchProductMetadata(metaParam || staticMeta.meta);
  return {
    name: remote.name || staticMeta.productName,
    brand: remote.brand,
    description: remote.description,
    image: remote.image,
    images: remote.images,
    sku: remote.sku,
    origin: remote.origin,
    size: remote.size,
    msrp: remote.msrp || staticMeta.msrp,
  };
}

export interface DppIdentifiers {
  gtin: string | null;
  gtinValid: boolean;
  serial: string | null;
  tokenId: string; // decimal string
  uid: string; // 14 hex, uppercase
  tagHash?: string;
}

export interface DigitalProductPassport {
  dppVersion: "TAGIT-DPP-1";
  identifiers: DppIdentifiers;
  product: ProductMetadata;
  lifecycle: {
    stateCode: number;
    state: string;
    description: string;
    owner: string;
    registered: string | null; // ISO-8601
  };
  integrity: {
    chain: string; // CAIP-2
    chainName: string;
    contract: string;
    metadataHash: string | null; // on-chain anchor
    explorer: string;
  };
  presence: {
    method: "NTAG424DNA-SUN";
    tapCounter: number;
    verifiedAt: string; // ISO-8601
  };
}

export interface BuildDppInput {
  gtin: string | null;
  gtinValid: boolean;
  serial: string | null;
  tokenId: bigint;
  uid: string;
  tagHash?: string;
  counter: number;
  asset: { owner: string; timestamp: bigint; state: number };
  metadataHash: `0x${string}` | null;
  product: ProductMetadata;
  /** ISO timestamp of this verification (caller-supplied so it's testable). */
  verifiedAt: string;
}

export function buildDpp(input: BuildDppInput): DigitalProductPassport {
  const stateCode = input.asset.state;
  return {
    dppVersion: "TAGIT-DPP-1",
    identifiers: {
      gtin: input.gtin,
      gtinValid: input.gtinValid,
      serial: input.serial,
      tokenId: input.tokenId.toString(),
      uid: input.uid,
      tagHash: input.tagHash,
    },
    product: input.product,
    lifecycle: {
      stateCode,
      state: STATES[stateCode]?.label ?? "UNKNOWN",
      description: STATE_DESCRIPTIONS[stateCode] ?? "",
      owner: input.asset.owner,
      registered:
        input.asset.timestamp > 0n
          ? new Date(Number(input.asset.timestamp) * 1000).toISOString()
          : null,
    },
    integrity: {
      chain: CHAIN_CAIP2,
      chainName: CHAIN_NAME,
      contract: CONTRACT_ADDRESS,
      metadataHash: input.metadataHash,
      explorer: `https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`,
    },
    presence: {
      method: "NTAG424DNA-SUN",
      tapCounter: input.counter,
      verifiedAt: input.verifiedAt,
    },
  };
}

/**
 * Serialize a DPP as a W3C Verifiable Credential (VCDM 2.0, JSON-LD).
 *
 * Context strategy (v1): the only fetched context is the stable W3C v2 context;
 * all TAG IT terms resolve via an inline `@vocab` so JSON-LD expansion is
 * deterministic and never depends on an unpublished/unreachable context URL.
 * Phase 2 publishes a real versioned context at `${RESOLVER_BASE}/contexts/...`
 * + the issuer DID document, and aligns the term set to the UN Transparency
 * Protocol DPP vocabulary.
 *
 * UNSIGNED in v1: there is no cryptographic `proof`. The `evidence` entry binds
 * to the on-chain metadataHash, which anchors the OFF-CHAIN PRODUCT METADATA
 * only (not the server-assembled lifecycle/owner/tapCounter fields). Issuer-DID
 * signing (Ed25519 / SD-JWT) is phase 2. Callers should treat this as a
 * machine-readable view, not a self-verifying credential, until then.
 */
export function dppToVerifiableCredential(dpp: DigitalProductPassport): Record<string, unknown> {
  const subjectId =
    dpp.identifiers.gtin && dpp.identifiers.serial
      ? `${RESOLVER_BASE}/01/${dpp.identifiers.gtin}/21/${encodeURIComponent(dpp.identifiers.serial)}`
      : `${RESOLVER_BASE}/token/${dpp.identifiers.tokenId}`;

  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      { "@vocab": `${RESOLVER_BASE}/vocab#` }, // deterministic IRIs for TAG IT terms (no network fetch)
    ],
    type: ["VerifiableCredential", "DigitalProductPassport"],
    issuer: { id: ISSUER_DID, name: "TAG IT Network" },
    validFrom: dpp.presence.verifiedAt,
    credentialSubject: {
      type: ["Product"],
      id: subjectId,
      registeredId: dpp.identifiers.gtin, // GS1 GTIN
      serialNumber: dpp.identifiers.serial,
      name: dpp.product.name,
      brand: dpp.product.brand,
      description: dpp.product.description,
      image: dpp.product.image,
      sku: dpp.product.sku,
      countryOfOrigin: dpp.product.origin,
      lifecycleState: dpp.lifecycle.state,
      owner: dpp.lifecycle.owner, // public on-chain owner address (by design)
      registeredAt: dpp.lifecycle.registered, // on-chain registration time (NOT manufacture date)
      digitalTwin: {
        chain: dpp.integrity.chain,
        contract: dpp.integrity.contract,
        tokenId: dpp.identifiers.tokenId,
        tagUid: dpp.identifiers.uid,
      },
      authenticity: {
        method: dpp.presence.method, // SUN tap cryptographically verified before this VC is built
        tapCounter: dpp.presence.tapCounter,
        tapVerified: true,
      },
    },
    evidence: [
      {
        type: ["OnChainAnchor"],
        chain: dpp.integrity.chain,
        contract: dpp.integrity.contract,
        tokenId: dpp.identifiers.tokenId,
        // Binds off-chain product metadata only. Omitted (not null) when unset.
        anchored: dpp.integrity.metadataHash !== null,
        ...(dpp.integrity.metadataHash ? { metadataHash: dpp.integrity.metadataHash } : {}),
        explorer: dpp.integrity.explorer,
      },
    ],
  };
}
