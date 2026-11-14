/**
 * TAG IT Digital Product Passport (DPP) — data model + W3C Verifiable
 * Credential serializer. Server-only (reads on-chain data + the item record).
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
import { CONTRACT_ADDRESS } from "./contract";
import { fetchAsset, heroMedia } from "./services";
import { STATES, STATE_DESCRIPTIONS } from "./states";

/** Base Sepolia — the primary chain the verifier reads (CAIP-2 eip155:84532). */
export const CHAIN_ID = 84532;
export const CHAIN_CAIP2 = `eip155:${CHAIN_ID}`;
export const CHAIN_NAME = "Base Sepolia";

/** Issuer identity for the passport credential (DID to be published, phase 2). */
export const ISSUER_DID = "did:web:id.tagit.network";
export const RESOLVER_BASE = "https://id.tagit.network";

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

/**
 * Resolve a token's product fields from the tagit-services assets API
 * (META-T17 cutover — the old hardcoded ASSET_METADATA map is gone). ONE
 * source of truth for the HTML pages, the tap routes and the JSON-LD/VC
 * endpoints: product copy resolves only from the token id, on every route.
 * Nothing a caller puts in the URL can change the name, brand or image shown
 * beside a verdict — the same rule /asset/[tokenId] and /api/asset already
 * follow (see untrustedEnvelope in @/lib/verdict).
 *
 * Restricted items resolve to an EMPTY product: the services API redacts the
 * DTO, and this function must not resurrect product copy from anywhere else.
 * A services outage also resolves to empty — a metadata outage must never
 * block a verdict.
 */
export async function loadProduct(tokenId: string): Promise<ProductMetadata> {
  const lookup = await fetchAsset(tokenId);
  const product: ProductMetadata = {};
  if (lookup.kind === "record") {
    const { dto } = lookup;
    product.name = dto.product?.name ?? dto.name;
    product.brand = dto.product?.brand;
    product.description = dto.description;
    product.image = heroMedia(dto)?.url;
    product.images = dto.media?.map((m) => m.url);
    product.sku = dto.product?.sku;
    product.origin = dto.product?.origin;
  }
  return product;
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
