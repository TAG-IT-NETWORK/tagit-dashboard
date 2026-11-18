/**
 * Pure helpers for the "Activate & list" step (station + asset page).
 * Mirrors services catalog/activate.ts ActivateResult.
 */

export interface ActivateOutcome {
  ok: boolean;
  txHash: string | null;
  explorerUrl: string | null;
  activated: string[];
  alreadyActive: string[];
  skipped: Array<{ tokenId: string; state: number; reason: string }>;
  listed: string[];
  alreadyListed: string[];
  listErrors: Array<{ tokenId: string; error: string }>;
  error: string | null;
}

const ACTIVATABLE = new Set(["bound", "anchored"]);

/** Token ids the station may send: bound (or bound + anchored) rows, numeric order. */
export function activatableTokenIds(
  tokens: ReadonlyArray<{ tokenId: string; lifecycle: string }>,
): string[] {
  return tokens
    .filter((t) => ACTIVATABLE.has(t.lifecycle))
    .map((t) => t.tokenId)
    .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
}

/** Registry states in which an item is past activation. */
const PAST_ACTIVATION = new Set(["ACTIVATED", "CLAIMED", "FLAGGED", "RECYCLED"]);

/**
 * How many items are bound and, as far as the catalog knows, not yet activated
 * on the registry (TAP-T19). This is what the station's one-line offer counts,
 * so it stops offering items that are already on sale.
 *
 * It is not what the panel SENDS: that stays activatableTokenIds(), every
 * bound item, because pressing the button again is also how an item that was
 * activated without a price gets listed later. An item whose registry state
 * is unknown counts as waiting: offering one too many costs a click, hiding
 * one that waits costs a sale.
 */
export function awaitingActivation(
  tokens: ReadonlyArray<{ lifecycle: string; chainState?: string | null }>,
): number {
  return tokens.filter(
    (t) => ACTIVATABLE.has(t.lifecycle) && !PAST_ACTIVATION.has(t.chainState ?? ""),
  ).length;
}

/**
 * When the station shows the "Activate & list" panel (TAP-T19).
 *
 * It used to appear only once EVERY token of the batch was bound, so a batch
 * with one chip left over could not put its finished items on sale. Now:
 *
 *   - as soon as at least one token is bound and not yet activated
 *     (awaitingActivation), and
 *   - as before, when nothing is left to bind, and
 *   - once the operator has opened it, it stays (`shownBefore`): activating
 *     the bound part leaves nothing to activate, and the panel's report of
 *     what it just did must not vanish with it.
 */
export function showActivatePanel(input: {
  loading: boolean;
  /** Tokens still waiting for a tag. */
  pending: number;
  /** Tokens that are bound and still wait for activation (awaitingActivation). */
  activatable: number;
  shownBefore: boolean;
}): boolean {
  if (input.loading) return false;
  return input.pending === 0 || input.activatable > 0 || input.shownBefore;
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Tolerant parse of the upstream body. */
export function parseActivateOutcome(body: unknown): ActivateOutcome {
  const b = (body ?? {}) as Record<string, unknown>;
  const skipped = Array.isArray(b.skipped)
    ? (b.skipped as Array<Record<string, unknown>>)
        .filter((s) => typeof s?.tokenId === "string")
        .map((s) => ({
          tokenId: s.tokenId as string,
          state: typeof s.state === "number" ? s.state : -1,
          reason: typeof s.reason === "string" ? s.reason : "skipped",
        }))
    : [];
  const listErrors = Array.isArray(b.listErrors)
    ? (b.listErrors as Array<Record<string, unknown>>)
        .filter((e) => typeof e?.tokenId === "string")
        .map((e) => ({
          tokenId: e.tokenId as string,
          error: typeof e.error === "string" ? e.error : "failed",
        }))
    : [];
  return {
    ok: b.ok === true,
    txHash: typeof b.txHash === "string" ? b.txHash : null,
    explorerUrl: typeof b.explorerUrl === "string" ? b.explorerUrl : null,
    activated: stringList(b.activated),
    alreadyActive: stringList(b.alreadyActive),
    skipped,
    listed: stringList(b.listed),
    alreadyListed: stringList(b.alreadyListed),
    listErrors,
    error: typeof b.error === "string" ? b.error : null,
  };
}

/** Human summary lines, most important first. */
export function describeOutcome(o: ActivateOutcome, priceUsdc?: string | null): string[] {
  const lines: string[] = [];
  if (o.activated.length > 0)
    lines.push(`${o.activated.length} activated (#${o.activated.join(", #")})`);
  if (o.alreadyActive.length > 0) lines.push(`${o.alreadyActive.length} already active`);
  if (o.listed.length > 0)
    lines.push(`${o.listed.length} listed${priceUsdc ? ` at $${priceUsdc}` : ""}`);
  if (o.alreadyListed.length > 0) lines.push(`${o.alreadyListed.length} already listed`);
  for (const s of o.skipped) lines.push(`#${s.tokenId} skipped: ${s.reason}`);
  for (const e of o.listErrors) lines.push(`#${e.tokenId} not listed: ${e.error}`);
  if (lines.length === 0) lines.push(o.ok ? "Nothing to do." : (o.error ?? "Failed."));
  return lines;
}

/** Blank = activate only. Otherwise a positive decimal with ≤ 6 decimals. */
export function validatePriceInput(raw: string): {
  priceUsdc: string | null;
  error: string | null;
} {
  const s = raw.trim();
  if (s === "") return { priceUsdc: null, error: null };
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(s))
    return { priceUsdc: null, error: "enter a USDC amount like 23.33 (max 6 decimals)" };
  if (Number(s) <= 0) return { priceUsdc: null, error: "price must be greater than zero" };
  return { priceUsdc: s, error: null };
}
