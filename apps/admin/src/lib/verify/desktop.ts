import { hexToBytes, keccak256, type Hex } from "viem";

/**
 * Desktop verification (pure — unit-tested). The admin "Verify" page lets an
 * operator tap a tagged product on the ACR1252U instead of a phone: the
 * bridge reads + decodes the chip's SUN, the contract maps the tag hash to
 * its token, the services catalog returns the full record. This module owns
 * the interpretation so the verdict is testable without hardware.
 */

// ── Chip read ────────────────────────────────────────────────────────────────

export interface ScanSun {
  /** Colon-hex UID as the bridge reports it. */
  uid: string;
  counter: number;
  cmac: string;
  picc: string;
  cmacVerified: boolean;
}

export type ScanInterpretation =
  | { kind: "blank"; records: number }
  | { kind: "not-sun"; records: number; url: string | null }
  | { kind: "undecoded"; records: number; url: string | null; reason: string }
  | { kind: "sun"; records: number; url: string | null; sun: ScanSun };

/** Interpret a bridge read-ndef result ({records, sun, sunError}). */
export function interpretScan(result: unknown): ScanInterpretation {
  const env = result as { records?: unknown; sun?: unknown; sunError?: unknown } | null;
  const records = Array.isArray(env?.records) ? (env!.records as Array<{ recordType?: unknown; data?: unknown }>) : [];
  const url = records.find((r) => r?.recordType === "url" && typeof r.data === "string")?.data as string | undefined;
  if (records.length === 0) return { kind: "blank", records: 0 };
  const sun = env?.sun as Partial<ScanSun> | null | undefined;
  if (
    sun &&
    typeof sun.uid === "string" &&
    typeof sun.counter === "number" &&
    typeof sun.cmac === "string" &&
    typeof sun.picc === "string"
  ) {
    return {
      kind: "sun",
      records: records.length,
      url: url ?? null,
      sun: {
        uid: sun.uid,
        counter: sun.counter,
        cmac: sun.cmac,
        picc: sun.picc,
        cmacVerified: sun.cmacVerified === true,
      },
    };
  }
  const isSunUrl = typeof url === "string" && /[?&]picc=[0-9a-fA-F]{32}/.test(url);
  if (isSunUrl) {
    return {
      kind: "undecoded",
      records: records.length,
      url: url ?? null,
      reason: typeof env?.sunError === "string" ? env.sunError : "bridge did not decode the SUN",
    };
  }
  return { kind: "not-sun", records: records.length, url: url ?? null };
}

// ── Tag hash ─────────────────────────────────────────────────────────────────

/** keccak256 of the UID's raw bytes — the canonical tagHash the relayer binds. */
export function tagHashFromUid(uid: string): Hex | null {
  const clean = uid.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length === 0 || clean.length % 2 !== 0) return null;
  return keccak256(hexToBytes(`0x${clean}` as Hex));
}

export function uidsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  return norm(a).length > 0 && norm(a) === norm(b);
}

// ── Asset detail (services GET /api/v1/assets/:tokenId) ──────────────────────

export interface ProvenanceEvent {
  type: string;
  label: string;
  blockNumber: number | null;
  txHash: string | null;
  timestamp: number | null;
}

export interface AssetDetail {
  tokenId: string;
  owner: string | null;
  stateCode: number | null;
  lifecycleState: string | null;
  name: string | null;
  image: string | null;
  description: string | null;
  tagHash: string | null;
  timestamp: number | null;
  product: { brand: string | null; model: string | null; sku: string | null; origin: string | null; category: string | null };
  attributes: Array<{ trait_type: string; value: string }>;
  price: { display: string | null; saleState: string | null } | null;
  verification: {
    anchoredVersion: number | null;
    latestVersion: number | null;
    anchorStatus: string | null;
    metadataHash: string | null;
    verified: boolean;
  } | null;
  provenance: ProvenanceEvent[];
  restricted: boolean;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Tolerant picker over the public/admin asset DTO (null = not an asset body). */
export function readDetail(body: unknown): AssetDetail | null {
  const d = body as Record<string, unknown> | null;
  if (!d || typeof d !== "object" || typeof d.tokenId !== "string") return null;
  const product = (d.product ?? {}) as Record<string, unknown>;
  const price = d.price as Record<string, unknown> | null | undefined;
  const ver = d.verification as Record<string, unknown> | null | undefined;
  const attributes = Array.isArray(d.attributes)
    ? (d.attributes as Array<Record<string, unknown>>)
        .filter((a) => typeof a?.trait_type === "string" && typeof a?.value === "string")
        .map((a) => ({ trait_type: a.trait_type as string, value: a.value as string }))
    : [];
  const provenance = Array.isArray(d.provenance)
    ? (d.provenance as Array<Record<string, unknown>>).map((e) => ({
        type: str(e?.type) ?? "event",
        label: str(e?.label) ?? str(e?.type) ?? "event",
        blockNumber: num(e?.blockNumber),
        txHash: str(e?.txHash),
        timestamp: num(e?.timestamp),
      }))
    : [];
  return {
    tokenId: d.tokenId,
    owner: str(d.owner),
    stateCode: num(d.stateCode),
    lifecycleState: str(d.lifecycleState),
    name: str(d.name),
    image: str(d.image),
    description: str(d.description),
    tagHash: str(d.tagHash),
    timestamp: num(d.timestamp),
    product: {
      brand: str(product.brand),
      model: str(product.model),
      sku: str(product.sku),
      origin: str(product.origin),
      category: str(product.category),
    },
    attributes,
    price: price ? { display: str(price.display), saleState: str(price.saleState) } : null,
    verification:
      ver && typeof ver === "object"
        ? {
            anchoredVersion: num(ver.anchoredVersion),
            latestVersion: num(ver.latestVersion),
            anchorStatus: str(ver.anchorStatus),
            metadataHash: str(ver.metadataHash),
            verified: ver.verified === true,
          }
        : null,
    provenance,
    restricted: d.restricted === true,
  };
}

// ── Server SUN check (POST /api/catalog-proxy/binding/verify) ────────────────

export interface ServerCheck {
  status: number;
  verified: boolean | null;
  cmacVerified: boolean | null;
  reason: string | null;
  counter: number | null;
  /** Not attempted (viewer role, no SUN) or the call failed before an answer. */
  skipped: string | null;
}

export function readServerCheck(status: number, body: unknown): ServerCheck {
  const b = body as Record<string, unknown> | null;
  if (status === 403) return { status, verified: null, cmacVerified: null, reason: null, counter: null, skipped: "operator role required for the server SUN check" };
  if (status === 0) return { status, verified: null, cmacVerified: null, reason: null, counter: null, skipped: "verify service unreachable" };
  const proof = (b?.proof ?? null) as Record<string, unknown> | null;
  return {
    status,
    verified: typeof b?.verified === "boolean" ? b.verified : null,
    cmacVerified: typeof b?.cmacVerified === "boolean" ? b.cmacVerified : null,
    reason: str(b?.reason) ?? str(b?.error) ?? str(b?.message),
    counter: num(proof?.counter),
    skipped: null,
  };
}

// ── Verdict ──────────────────────────────────────────────────────────────────

export type VerdictLevel = "authentic" | "warning" | "tamper" | "unknown";

export interface Verdict {
  level: VerdictLevel;
  title: string;
  reason: string;
}

export function computeVerdict(input: {
  scan: ScanInterpretation;
  cardUid: string;
  tokenId: bigint | null;
  detail: AssetDetail | null;
  server: ServerCheck | null;
}): Verdict {
  const { scan, cardUid, tokenId, detail, server } = input;
  if (scan.kind === "blank") {
    return { level: "unknown", title: "Blank chip", reason: "No NDEF message — this chip was never programmed. Not a TAG IT product." };
  }
  if (scan.kind === "not-sun") {
    return { level: "unknown", title: "Not a TAG IT chip", reason: scan.url ? `Carries an unrelated URL (${scan.url})` : "Carries no TAG IT SUN record." };
  }
  if (scan.kind === "undecoded") {
    return { level: "warning", title: "SUN could not be decoded", reason: scan.reason };
  }
  if (!uidsMatch(scan.sun.uid, cardUid)) {
    return { level: "tamper", title: "TAMPER — UID mismatch", reason: "The chip's encrypted SUN names a different UID than the chip on the reader. Cloned or re-encoded tag." };
  }
  if (!scan.sun.cmacVerified) {
    return { level: "tamper", title: "TAMPER — signature invalid", reason: "The SDM signature does not verify under our master key. Do not trust this chip." };
  }
  if (server?.reason === "CMAC_INVALID") {
    return { level: "tamper", title: "TAMPER — server rejected the signature", reason: "The server's SDMMAC check failed (CMAC_INVALID)." };
  }
  if (tokenId === null) {
    return { level: "unknown", title: "Looking up the token…", reason: "Resolving the tag hash on-chain." };
  }
  if (tokenId === 0n) {
    return { level: "warning", title: "Genuine chip, not bound", reason: "The signature is valid but no token on this chain is bound to this tag. Programmed but never bound, or bound on another network." };
  }
  if (detail && detail.stateCode !== null && detail.stateCode >= 5) {
    return {
      level: "warning",
      title: detail.stateCode === 5 ? "FLAGGED asset" : "RECYCLED asset",
      reason: detail.stateCode === 5 ? "This item is flagged (recall, theft or loss). Do not sell or accept it." : "This item was retired on-chain. The chip is no longer a valid identity.",
    };
  }
  if (server && server.verified === false && !server.skipped) {
    return { level: "warning", title: "Server could not verify", reason: server.reason ?? "The server verification returned verified:false." };
  }
  const stateTxt = detail?.lifecycleState ?? "on-chain";
  return {
    level: "authentic",
    title: "Authentic",
    reason: `Chip signature valid, bound to token #${tokenId.toString()} (${stateTxt})${server && !server.skipped ? server.cmacVerified ? ", server CMAC verified" : ", server counter check passed" : ""}.`,
  };
}

export function stateName(code: number | null): string {
  const names = ["NONE", "MINTED", "BOUND", "ACTIVATED", "CLAIMED", "FLAGGED", "RECYCLED"];
  return code !== null && names[code] ? names[code] : "UNKNOWN";
}
