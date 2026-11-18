/**
 * Single-asset bind — pure logic behind the "Bind a single asset" card on the
 * Binding Station landing (/station).
 *
 * Why it exists: the batch station only ever lists tokens that belong to a
 * template batch. A token minted on its own (Assets → New) has no batch, so it
 * never appeared anywhere a chip could be bound through the relayer. The
 * services rail already binds any minted token (POST /api/v1/bind
 * { tokenId, tagUid } → bindTag via the relayer → catalog mirror + first
 * publish + anchor request); this module drives that rail for ONE token.
 *
 * Security posture is IDENTICAL to the batch station (REQ-S-21, WB-01):
 *   1. chip must report NTAG 424 DNA,
 *   2. SUN read through the bridge must parse and match the card UID,
 *   3. server SUN verify must answer verified:true — unreachable fails CLOSED,
 *      CMAC_INVALID is a hard tamper stop,
 *   4. only then the relayer bind.
 * Any failure returns before step 4: a chip that fails SUN is never bound.
 */

import { CHIP_SPECS } from "@/lib/nfc-bridge-protocol";
import { sunCheckViaBridge, type SunFailKind } from "@/lib/binding/station";

/** Token ids are uint256 decimals — bounded so a pasted blob is rejected early. */
export const TOKEN_ID_RE = /^[0-9]{1,78}$/;

/** Normalize a typed/queried token id ("#59", " 59 ") → "59", or null when invalid. */
export function parseTokenIdInput(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^#/, "");
  if (!TOKEN_ID_RE.test(trimmed)) return null;
  // Canonical decimal (no leading zeros) so "059" and "59" are the same token.
  return BigInt(trimmed).toString();
}

/** Lifecycle state code for MINTED (TAGITCore.State). */
const STATE_MINTED = 1;

export interface SingleAssetInfo {
  tokenId: string;
  name: string | null;
  lifecycle: string | null;
  bindable: boolean;
  /** Why it cannot be bound (null when bindable). */
  reason: string | null;
}

/**
 * Read GET /api/catalog-proxy/assets/:tokenId into the fields the card needs.
 * Bindable ⇔ the catalog knows the token, it is MINTED and carries no tag.
 */
export function readSingleAsset(tokenId: string, status: number, body: unknown): SingleAssetInfo {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" && b.name.trim() !== "" ? b.name : null;
  const lifecycle =
    typeof b.lifecycleState === "string" && b.lifecycleState !== "" ? b.lifecycleState : null;
  const base = { tokenId, name, lifecycle };

  if (status === 404) {
    return { ...base, bindable: false, reason: `Asset #${tokenId} is not in the catalog.` };
  }
  if (status < 200 || status >= 300) {
    const err = typeof b.error === "string" ? b.error : `HTTP ${status || "network"}`;
    return { ...base, bindable: false, reason: `Could not load asset #${tokenId} (${err}).` };
  }
  if (typeof b.tagHash === "string" && b.tagHash !== "" && !/^0x0*$/.test(b.tagHash)) {
    return { ...base, bindable: false, reason: `Asset #${tokenId} already has a chip.` };
  }
  const minted =
    b.stateCode === STATE_MINTED || (lifecycle !== null && lifecycle.toLowerCase() === "minted");
  if (!minted) {
    return {
      ...base,
      bindable: false,
      reason: `Asset #${tokenId} is ${lifecycle ?? "not in the MINTED state"} — only minted assets take a chip.`,
    };
  }
  return { ...base, bindable: true, reason: null };
}

export interface ProxyResult {
  ok: boolean;
  /** 0 = network failure (no HTTP response). */
  status: number;
  body: Record<string, unknown> | null;
}

export type PostJson = (path: string, payload: unknown) => Promise<ProxyResult>;

export type SingleBindOutcome =
  | {
      ok: false;
      stage: "sun";
      kind: SunFailKind;
      message: string;
      /** Factory-fresh chip — the card offers "Program SDM and retry". */
      blank?: boolean;
    }
  | { ok: false; stage: "bind"; message: string; cmacVerified: boolean }
  | { ok: true; txHash: string | null; cmacVerified: boolean };

function upstreamError(body: Record<string, unknown> | null, fallback: string): string {
  return typeof body?.error === "string" ? body.error : fallback;
}

/**
 * Verify-then-bind for one token. Mirrors BindingStation.runTapPipeline step
 * for step; see the module header for the ordering guarantee.
 */
export async function verifyThenBind(input: {
  tokenId: string;
  uid: string;
  chip: string;
  readNdef: (req: { type: "read-ndef" }) => Promise<unknown>;
  postJson: PostJson;
}): Promise<SingleBindOutcome> {
  const { tokenId, uid, chip, readNdef, postJson } = input;

  if (chip !== "NTAG424DNA") {
    const label = CHIP_SPECS[chip as keyof typeof CHIP_SPECS]?.label ?? chip;
    return {
      ok: false,
      stage: "sun",
      kind: "tamper",
      message: `Chip reports as ${label}, not NTAG 424 DNA`,
    };
  }

  const evaluation = await sunCheckViaBridge(readNdef, uid);
  if (!evaluation.ok) {
    return {
      ok: false,
      stage: "sun",
      kind: evaluation.kind,
      message: evaluation.message,
      ...(evaluation.blank === true ? { blank: true } : {}),
    };
  }

  const verifyRes = await postJson("/api/catalog-proxy/binding/verify", {
    tokenId,
    nfcPayload: {
      uid: evaluation.sun.uidHex,
      cmac: evaluation.sun.cmacHex,
      counter: evaluation.sun.counter,
    },
  });
  if (verifyRes.status === 0) {
    return {
      ok: false,
      stage: "sun",
      kind: "unreadable",
      message: "SUN verify service unreachable — binding blocked (fail closed)",
    };
  }
  if (verifyRes.body?.reason === "CMAC_INVALID") {
    return {
      ok: false,
      stage: "sun",
      kind: "tamper",
      message:
        "CMAC invalid — the chip's SDM MAC failed cryptographic verification. Do not bind or attach this chip.",
    };
  }
  if (!verifyRes.ok || verifyRes.body?.verified !== true) {
    return {
      ok: false,
      stage: "sun",
      kind: "tamper",
      message: upstreamError(verifyRes.body, "SUN verification failed"),
    };
  }
  const cmacVerified = verifyRes.body?.cmacVerified === true;

  const bindRes = await postJson("/api/catalog-proxy/binding/bind", { tokenId, tagUid: uid });
  if (!bindRes.ok || bindRes.body?.ok !== true) {
    return {
      ok: false,
      stage: "bind",
      message: upstreamError(bindRes.body, `bind failed (${bindRes.status || "network"})`),
      cmacVerified,
    };
  }
  return {
    ok: true,
    txHash: typeof bindRes.body.txHash === "string" ? bindRes.body.txHash : null,
    cmacVerified,
  };
}
