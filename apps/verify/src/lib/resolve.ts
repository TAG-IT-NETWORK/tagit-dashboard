/**
 * Shared tap-resolution pipeline used by BOTH the legacy /sun route and the
 * GS1 Digital Link resolver (/01/...). Server-only: it touches the SDM master
 * key and the chain RPC. Never import from a client component.
 *
 * Pipeline:  picc+cmac  →  verify SUN crypto  →  decrypt UID  →  on-chain twin.
 *
 * The UID recovered from the encrypted PICC blob is the trust anchor for the
 * on-chain lookup (keccak256(UID) → tagId → tokenId). The GS1 GTIN+serial in
 * the URL path is the standards-compliant *identity* layer rendered alongside;
 * it does not (yet) drive resolution, so no on-chain GTIN map is required.
 */
import { verifySunUrl } from "./sdm";
import { getAsset, getMetadataHash, getTokenByTag, uidToTagHash } from "./contract";

export interface AssetState {
  owner: string;
  timestamp: bigint;
  state: number;
  flags: number;
  reserved: number;
}

export type TapResolution =
  | { kind: "bad-params" }
  | { kind: "not-configured" }
  | { kind: "counterfeit"; reason: string }
  | { kind: "authentic-unbound"; uid: string; counter: number }
  | { kind: "lookup-failed"; uid: string; counter: number; reason: string }
  | {
      kind: "resolved";
      uid: string;
      counter: number;
      tokenId: bigint;
      asset: AssetState;
      metadataHash: `0x${string}` | null;
    };

/** Load and validate the 16-byte SDM master key from the Vercel env. */
export function getMasterKey(): Buffer | null {
  const hex = process.env.SDM_MASTER_KEY?.trim();
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

/**
 * Verify a SUN tap and resolve its on-chain digital twin. Pure data (no JSX) so
 * every surface (HTML page, JSON-LD VC endpoint) renders from one source.
 */
export async function resolveTap(picc?: string, cmac?: string): Promise<TapResolution> {
  if (!picc || !cmac) return { kind: "bad-params" };

  const masterKey = getMasterKey();
  if (!masterKey) return { kind: "not-configured" };

  const result = verifySunUrl(picc, cmac, masterKey);
  if (!result.valid) return { kind: "counterfeit", reason: result.reason };

  const { uid, counter } = result;
  const tagHash = uidToTagHash(uid);

  let tokenId: bigint;
  try {
    tokenId = (await getTokenByTag(tagHash)) as bigint;
  } catch {
    return { kind: "lookup-failed", uid, counter, reason: "Could not query chain." };
  }

  if (tokenId === 0n) return { kind: "authentic-unbound", uid, counter };

  let asset: AssetState;
  try {
    asset = await getAsset(tokenId);
  } catch {
    return { kind: "lookup-failed", uid, counter, reason: "Asset read failed." };
  }

  let metadataHash: `0x${string}` | null = null;
  try {
    metadataHash = await getMetadataHash(tokenId);
  } catch {
    // Non-fatal: the contract may predate the metadataHash getter. Anchor stays null.
  }

  return { kind: "resolved", uid, counter, tokenId, asset, metadataHash };
}

/** Colon-format a 14-hex UID: 04:A2:… */
export function formatUid(uidHex: string): string {
  return (uidHex.match(/.{1,2}/g) ?? []).join(":");
}

/** A product is considered authentic in lifecycle states MINTED..CLAIMED (1–4). */
export function isAuthenticState(state: number): boolean {
  return state >= 1 && state <= 4;
}
