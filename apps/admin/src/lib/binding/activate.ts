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
export function activatableTokenIds(tokens: ReadonlyArray<{ tokenId: string; lifecycle: string }>): string[] {
  return tokens
    .filter((t) => ACTIVATABLE.has(t.lifecycle))
    .map((t) => t.tokenId)
    .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
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
        .map((e) => ({ tokenId: e.tokenId as string, error: typeof e.error === "string" ? e.error : "failed" }))
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
  if (o.activated.length > 0) lines.push(`${o.activated.length} activated (#${o.activated.join(", #")})`);
  if (o.alreadyActive.length > 0) lines.push(`${o.alreadyActive.length} already active`);
  if (o.listed.length > 0) lines.push(`${o.listed.length} listed${priceUsdc ? ` at $${priceUsdc}` : ""}`);
  if (o.alreadyListed.length > 0) lines.push(`${o.alreadyListed.length} already listed`);
  for (const s of o.skipped) lines.push(`#${s.tokenId} skipped: ${s.reason}`);
  for (const e of o.listErrors) lines.push(`#${e.tokenId} not listed: ${e.error}`);
  if (lines.length === 0) lines.push(o.ok ? "Nothing to do." : (o.error ?? "Failed."));
  return lines;
}

/** Blank = activate only. Otherwise a positive decimal with ≤ 6 decimals. */
export function validatePriceInput(raw: string): { priceUsdc: string | null; error: string | null } {
  const s = raw.trim();
  if (s === "") return { priceUsdc: null, error: null };
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(s)) return { priceUsdc: null, error: "enter a USDC amount like 23.33 (max 6 decimals)" };
  if (Number(s) <= 0) return { priceUsdc: null, error: "price must be greater than zero" };
  return { priceUsdc: s, error: null };
}
