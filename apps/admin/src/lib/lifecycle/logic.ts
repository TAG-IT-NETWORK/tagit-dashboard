import type { CatalogRole } from "@/lib/catalog/template-logic";
import { canMutateCatalog, canPublishCatalog } from "@/lib/catalog/template-logic";

/**
 * Lifecycle control model for the asset page (pure, tested).
 *
 * On-chain: NONE → MINTED → BOUND → ACTIVATED → CLAIMED, with FLAGGED as a
 * side state (BOUND/ACTIVATED/CLAIMED → FLAGGED, resolve restores the exact
 * pre-flag state after a 2-of-N RESOLVER quorum) and RECYCLED terminal from
 * any live state. Every write goes through the services relayer.
 */

export const STATE_NAMES = ["NONE", "MINTED", "BOUND", "ACTIVATED", "CLAIMED", "FLAGGED", "RECYCLED"] as const;
export const FORWARD_STATES = [1, 2, 3, 4] as const;
export const ST = { NONE: 0, MINTED: 1, BOUND: 2, ACTIVATED: 3, CLAIMED: 4, FLAGGED: 5, RECYCLED: 6 } as const;

export function stateLabel(code: number | null | undefined): string {
  return code === null || code === undefined ? "—" : (STATE_NAMES[code] ?? `STATE_${code}`);
}

export type SaleState = "not_for_sale" | "listed" | "sold" | "unknown";

export interface LifecycleStatus {
  tokenId: string;
  state: number;
  stateName: string;
  owner: string;
  saleState: SaleState;
  relayer: string | null;
  preFlagState: number | null;
  preFlagStateName: string | null;
  approvals: number | null;
  quorum: number;
  recipient: string | null;
  quorumReached: boolean | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function parseLifecycleStatus(body: unknown): LifecycleStatus | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const state = num(b.state);
  const tokenId = str(b.tokenId);
  const owner = str(b.owner);
  if (state === null || tokenId === null || owner === null) return null;
  const sale = str(b.saleState);
  return {
    tokenId,
    state,
    stateName: str(b.stateName) ?? stateLabel(state),
    owner,
    saleState: sale === "listed" || sale === "sold" || sale === "not_for_sale" ? sale : "unknown",
    relayer: str(b.relayer),
    preFlagState: num(b.preFlagState),
    preFlagStateName: str(b.preFlagStateName),
    approvals: num(b.approvals),
    quorum: num(b.quorum) ?? 2,
    recipient: str(b.recipient),
    quorumReached: typeof b.quorumReached === "boolean" ? b.quorumReached : null,
  };
}

export type ActionKind =
  | "bind"
  | "activate"
  | "list"
  | "update-price"
  | "delist"
  | "settle"
  | "flag"
  | "resolve"
  | "void-remint"
  | "recycle";

export interface LifecycleAction {
  kind: ActionKind;
  label: string;
  /** operator = catalog mutation tier (editor/admin roles); admin = irreversible / ownership. */
  tier: "operator" | "admin";
  group: "forward" | "sale" | "exception";
  irreversible: boolean;
  needsReason: boolean;
  needsPrice: boolean;
  needsAddress: boolean;
  hint: string;
}

const A = (
  kind: ActionKind,
  label: string,
  tier: "operator" | "admin",
  group: LifecycleAction["group"],
  hint: string,
  opts: Partial<Pick<LifecycleAction, "irreversible" | "needsReason" | "needsPrice" | "needsAddress">> = {},
): LifecycleAction => ({
  kind,
  label,
  tier,
  group,
  hint,
  irreversible: opts.irreversible ?? false,
  needsReason: opts.needsReason ?? false,
  needsPrice: opts.needsPrice ?? false,
  needsAddress: opts.needsAddress ?? false,
});

/** Actions that make sense for the current on-chain state (+ listing state). */
export function availableActions(state: number | null, saleState: SaleState | null): LifecycleAction[] {
  if (state === null) return [];
  const listed = saleState === "listed";
  const flag = A("flag", "Flag", "operator", "exception", "Lost, stolen or recalled: freezes the asset (FLAGGED) and pulls it from sale.", { needsReason: true });
  const recycle = A("recycle", "Recycle", "admin", "exception", "End of life: retires the token for good.", { irreversible: true, needsReason: true });
  const voidRemint = A("void-remint", "Void & remint", "admin", "exception", "Chip destroyed or wrong item: recycle this token and mint a fresh one for the same product.", { irreversible: true });
  switch (state) {
    case ST.MINTED:
      return [A("bind", "Bind chip", "operator", "forward", "Tap an SDM-programmed chip on the reader (station) or use the modal."), recycle];
    case ST.BOUND:
      return [A("activate", "Activate", "operator", "forward", "QA passed: BOUND → ACTIVATED through the relayer."), flag, voidRemint, recycle];
    case ST.ACTIVATED:
      return [
        listed
          ? A("update-price", "Update price", "operator", "sale", "Change the listed USDC price.", { needsPrice: true })
          : A("list", "List for sale", "operator", "sale", "List at a USDC price; the verify page and the apps can then buy it.", { needsPrice: true }),
        ...(listed ? [A("delist", "Delist", "operator", "sale", "Take it off sale (stays ACTIVATED).", { needsReason: true })] : []),
        A("settle", "Settle to wallet", "admin", "sale", "Claim it to a customer wallet without payment (demo / manual sale). Needs a listing.", { irreversible: true, needsAddress: true }),
        flag,
        voidRemint,
        recycle,
      ];
    case ST.CLAIMED:
      return [flag, recycle];
    case ST.FLAGGED:
      return [
        A("resolve", "Resolve", "admin", "exception", "Restore the pre-flag state. The relayer casts one approval; a second RESOLVER wallet must approve before the final resolve.", { needsReason: true }),
        recycle,
      ];
    default:
      return [];
  }
}

export function canRun(action: LifecycleAction, role: CatalogRole | null): boolean {
  return action.tier === "admin" ? canPublishCatalog(role) : canMutateCatalog(role);
}

export function validateAddress(raw: string): { address: string | null; error: string | null } {
  const s = raw.trim();
  if (s === "") return { address: null, error: "enter a wallet address" };
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return { address: null, error: "must be a 0x… address (40 hex chars)" };
  return { address: s, error: null };
}

export interface Outcome {
  ok: boolean;
  lines: string[];
  explorerUrl: string | null;
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Human summary of a relayer response, per action. */
export function summarizeOutcome(kind: ActionKind, body: unknown, httpOk: boolean): Outcome {
  const b = (body ?? {}) as Record<string, unknown>;
  const ok = b.ok === true && httpOk;
  const explorerUrl = str(b.explorerUrl);
  const lines: string[] = [];
  const err = str(b.error);
  switch (kind) {
    case "flag": {
      const flagged = list(b.flagged);
      const already = list(b.alreadyFlagged);
      const delisted = list(b.delisted);
      if (flagged.length) lines.push(`Flagged #${flagged.join(", #")}`);
      if (already.length) lines.push("Already flagged");
      if (delisted.length) lines.push("Removed from sale");
      for (const s of Array.isArray(b.skipped) ? (b.skipped as Array<Record<string, unknown>>) : []) {
        if (typeof s?.reason === "string") lines.push(`Skipped: ${s.reason}`);
      }
      break;
    }
    case "recycle": {
      if (b.alreadyRecycled === true) lines.push("Already recycled");
      else if (ok) lines.push(`${str(b.previousState) ?? "?"} → RECYCLED${b.delisted === true ? " (removed from sale)" : ""}`);
      break;
    }
    case "resolve": {
      const approvals = num(b.approvals);
      const quorum = num(b.quorum) ?? 2;
      if (b.resolved === true) lines.push(`Resolved: back to ${str(b.restoredState) ?? "pre-flag state"}${str(b.recipient) ? ` for ${str(b.recipient)}` : ""}`);
      else if (ok) lines.push(`Approvals ${approvals ?? 0}/${quorum}${str(b.note) ? ` — ${str(b.note)}` : ""}`);
      break;
    }
    case "activate":
    case "list": {
      const activated = list(b.activated);
      const listed = list(b.listed);
      if (activated.length) lines.push("Activated");
      if (list(b.alreadyActive).length && !activated.length) lines.push("Already active");
      if (listed.length) lines.push("Listed for sale");
      if (list(b.alreadyListed).length) lines.push("Already listed");
      for (const e of Array.isArray(b.listErrors) ? (b.listErrors as Array<Record<string, unknown>>) : []) {
        if (typeof e?.error === "string") lines.push(`Not listed: ${e.error}`);
      }
      for (const s of Array.isArray(b.skipped) ? (b.skipped as Array<Record<string, unknown>>) : []) {
        if (typeof s?.reason === "string") lines.push(`Skipped: ${s.reason}`);
      }
      break;
    }
    case "update-price":
    case "delist": {
      const status = str(b.listingStatus);
      const price = str(b.priceUsdc6);
      if (status) lines.push(`Listing ${status}${price && status === "listed" ? ` at ${(Number(price) / 1e6).toFixed(2)} USDC` : ""}${num(b.version) !== null ? ` (v${num(b.version)})` : ""}`);
      break;
    }
    case "settle": {
      if (ok) lines.push(`Claimed by ${str(b.newOwner) ?? "the wallet"}`);
      break;
    }
    default:
      break;
  }
  if (!ok) lines.push(err ?? "Failed");
  else if (lines.length === 0) lines.push("Done");
  return { ok, lines, explorerUrl };
}
