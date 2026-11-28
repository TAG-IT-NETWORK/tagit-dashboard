/**
 * Shared tap-resolution pipeline used by BOTH the legacy /sun route and the
 * GS1 Digital Link resolver (/01/...). Server-only: it touches the SDM master
 * key and the chain RPC. Never import from a client component.
 *
 * Pipeline:  picc+cmac  →  verify SUN crypto  →  decrypt UID  →  on-chain twin
 *            →  open the link (once)  →  item state.
 *
 * The UID recovered from the encrypted PICC blob is the trust anchor for the
 * on-chain lookup (keccak256(UID) → tagId → tokenId). The GS1 GTIN+serial in
 * the URL path is the standards-compliant *identity* layer rendered alongside;
 * it does not (yet) drive resolution, so no on-chain GTIN map is required.
 *
 * ONE-TIME LINKS (TAP-T10). A tag writes a counter into every link it makes.
 * Once a tap has led to an item, the link is opened with the one-time store
 * (@/lib/tap-link), and only a link that is fresh, or is being reopened by the
 * phone that opened it, goes on to a result. This step lives HERE, inside the
 * one function every tap route calls, so no route can show a result without
 * it. There is no option to skip it.
 */
import { verifySunUrl } from "./sdm";
import { uidToTagHash } from "./contract";
import { getAsset, getMetadataHash, getTokenByTag } from "./contract.server";
import { openTapLink, type TapLinkUse } from "./tap-link";
import type { TapSpan, TapTimer } from "./tap-timing";

export interface AssetState {
  owner: string;
  timestamp: bigint;
  state: number;
  flags: number;
  reserved: number;
}

/**
 * How a link that led to a result stands with the one-time store: opened for
 * the first time, or opened again by the phone that opened it first.
 */
export type TapLinkState = { kind: "fresh" } | { kind: "again"; secondsAgo: number };

export type TapResolution =
  | { kind: "bad-params" }
  | { kind: "not-configured" }
  | { kind: "counterfeit"; reason: string }
  | { kind: "authentic-unbound"; uid: string; counter: number }
  | { kind: "lookup-failed"; uid: string; counter: number; reason: string }
  /** The tag is real, but this link was already opened. No result is shown for it. */
  | { kind: "link-used"; uid: string; counter: number }
  /** The one-time store did not answer. Nothing may be said about the product. */
  | { kind: "link-unchecked"; uid: string; counter: number }
  | {
      kind: "resolved";
      uid: string;
      counter: number;
      tokenId: bigint;
      asset: AssetState;
      metadataHash: `0x${string}` | null;
      link: TapLinkState;
    };

/** The link state a tap may go on with, or null for any answer that is not one. */
function passingLink(answer: TapLinkUse | undefined): TapLinkState | null {
  if (answer?.kind === "fresh") return { kind: "fresh" };
  if (
    answer?.kind === "again" &&
    typeof answer.secondsAgo === "number" &&
    Number.isFinite(answer.secondsAgo) &&
    answer.secondsAgo >= 0
  ) {
    return { kind: "again", secondsAgo: answer.secondsAgo };
  }
  return null;
}

/** Load and validate the 16-byte SDM master key from the Vercel env. */
export function getMasterKey(): Buffer | null {
  const hex = process.env.SDM_MASTER_KEY?.trim();
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

/**
 * What a caller may watch while a tap resolves. Observers only: none of them
 * can change the result.
 */
export interface TapObservers {
  /**
   * Fires once the tag's code has been decoded and has passed its check — the
   * tag is genuine. It fires synchronously, before `resolveTap` first yields,
   * so a caller knows it by the time the call returns its promise.
   */
  onTagRead?: () => void;
  /**
   * Fires once the tag has resolved to an item AND its link may be shown — so
   * a caller can start its own lookup (the item record from tagit-services)
   * while the item-state and record-hash reads are still out. It does not fire
   * for a link that was already used or could not be checked: there is nothing
   * to look up for those.
   */
  onTokenId?: (tokenId: bigint) => void;
  /** Records how long each step took — see @/lib/tap-timing. */
  timer?: TapTimer;
}

/** What `resolveTap` is told about the request, besides the tap itself. */
export interface TapContext extends TapObservers {
  /**
   * The requesting device, as @/lib/tap-device gives it (a hash, never the
   * id). It is what lets the same phone open its own link again for a few
   * minutes. Leave it out and the link is still opened, once, with no second
   * look for anyone.
   */
  device?: string | null;
  /** The shopper's country (see @/lib/tap-country), or null. Counted, never checked. */
  country?: string | null;
}

/**
 * Verify a SUN tap and resolve its on-chain digital twin. Pure data (no JSX) so
 * every surface (HTML page, JSON-LD VC endpoint) renders from one source.
 */
export async function resolveTap(
  picc?: string,
  cmac?: string,
  context: TapContext = {},
): Promise<TapResolution> {
  const { onTagRead, onTokenId, timer, device = null, country = null } = context;
  if (!picc || !cmac) return { kind: "bad-params" };

  const masterKey = getMasterKey();
  if (!masterKey) return { kind: "not-configured" };

  const timed = <T>(span: TapSpan, step: () => Promise<T>): Promise<T> =>
    timer ? timer.time(span, step) : step();

  const result = timer
    ? timer.timeSync("sdm", () => verifySunUrl(picc, cmac, masterKey))
    : verifySunUrl(picc, cmac, masterKey);
  // A code that fails its check stops here: nothing is looked up and no link
  // is opened, so a made-up link can never use up a real one.
  if (!result.valid) return { kind: "counterfeit", reason: result.reason };
  onTagRead?.();

  const { uid, counter } = result;
  const tagHash = uidToTagHash(uid);

  let tokenId: bigint;
  try {
    tokenId = (await timed("tag", () => getTokenByTag(tagHash))) as bigint;
  } catch {
    return { kind: "lookup-failed", uid, counter, reason: "Could not query chain." };
  }

  if (tokenId === 0n) return { kind: "authentic-unbound", uid, counter };

  // Open the link and read the item at the same time: the first goes to
  // tagit-services, the second to the chain. `openTapLink` never rejects; it
  // answers "unavailable" instead, and that is never treated as a pass.
  const opening = timed("link", () =>
    openTapLink({
      tagHash,
      tokenId: tokenId.toString(),
      counter,
      device,
      ...(country ? { country } : {}),
    }),
  );
  // Asset + anchor are independent reads — one round-trip instead of two.
  const reads = timed("chain", () =>
    Promise.allSettled([getAsset(tokenId), getMetadataHash(tokenId)]),
  );

  // Only two answers let a tap go on: "fresh", and "again" with a real age.
  // Everything else stops here — "used" as a used link, and anything this
  // code does not recognise (no answer, a thrown error, an unknown shape) as
  // "not checked". The list is of what may pass, not of what may not.
  const answer: TapLinkUse | undefined = await opening.catch(() => undefined);
  if (answer?.kind === "used") return { kind: "link-used", uid, counter };
  const link = passingLink(answer);
  if (!link) return { kind: "link-unchecked", uid, counter };
  // Only now may the caller ask for the item record. That also keeps the
  // requests to tagit-services one after another (see @/lib/tap-lookups).
  onTokenId?.(tokenId);

  const [assetRead, hashRead] = await reads;
  if (assetRead.status === "rejected") {
    return { kind: "lookup-failed", uid, counter, reason: "Asset read failed." };
  }
  const asset: AssetState = assetRead.value;
  // Non-fatal: the contract may predate the metadataHash getter. Anchor stays null.
  const metadataHash: `0x${string}` | null =
    hashRead.status === "fulfilled" ? hashRead.value : null;

  return { kind: "resolved", uid, counter, tokenId, asset, metadataHash, link };
}

/** Colon-format a 14-hex UID: 04:A2:… */
export function formatUid(uidHex: string): string {
  return (uidHex.match(/.{1,2}/g) ?? []).join(":");
}

/** A product is considered authentic in lifecycle states MINTED..CLAIMED (1–4). */
export function isAuthenticState(state: number): boolean {
  return state >= 1 && state <= 4;
}
