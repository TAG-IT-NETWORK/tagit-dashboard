import { hasRole, type Role } from "@/lib/access";

/**
 * A brand makes items itself (TAP-T17). PURE logic, unit-tested without a
 * server: who may do it, what is sent, and how untrusted answers are read.
 *
 * Making items cannot be undone and costs a network fee, so:
 * - only a Manager may do it, decided on the server ({@link canMakeItems});
 * - it takes two steps. First a run of 1 to 100 items is set up (a record,
 *   nothing made yet), then the Manager confirms it. A run can be started
 *   once; a second click starts nothing more;
 * - a run is shown, and started, only when tagit-services says it belongs to
 *   the product on the page, which was itself loaded under the brand.
 */

/** Make items: Managers only, like publishing. */
export function canMakeItems(role: Role | null): boolean {
  return hasRole(role, "admin");
}

/** The most items one run can hold (the registry's own limit). */
export const MAX_ITEMS_PER_RUN = 100;

/** A whole number from 1 to 100 as typed, or null. No signs, spaces or decimals. */
export function parseQuantity(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,2}$/.test(value)) return null;
  const quantity = Number(value);
  return quantity <= MAX_ITEMS_PER_RUN ? quantity : null;
}

const RUN_ID_RE = /^bat_[0-9A-Za-z]{1,64}$/;

/** A run id exactly as tagit-services makes them, or null. */
export function parseRunId(value: unknown): string | null {
  return typeof value === "string" && RUN_ID_RE.test(value) ? value : null;
}

/** What is sent to set a run up. Built from two checked values, nothing else. */
export function bodyForRun(
  productId: string,
  quantity: number,
): { templateId: string; quantity: number } {
  return { templateId: productId, quantity };
}

export type RunState = "waiting" | "making" | "made" | "failed";

export interface ItemRun {
  id: string;
  /** How many items the run holds. */
  size: number;
  state: RunState;
  /** How many of them exist so far. */
  made: number;
}

const STATES: Record<string, RunState> = {
  validated: "waiting",
  minting: "making",
  minted: "made",
  mint_failed: "failed",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function wholeNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

/**
 * A run as tagit-services describes it, or null. Shown only when it is the
 * run asked for AND it is filed under the product on the page: a run of
 * another product is not shown, whatever else the answer holds.
 */
export function parseRun(
  status: number,
  body: unknown,
  runId: string,
  productId: string,
): ItemRun | null {
  if (status !== 200 || !isRecord(body) || body.ok !== true || !isRecord(body.batch)) return null;
  const batch = body.batch;
  if (batch.id !== runId || batch.templateId !== productId) return null;
  const size = wholeNumber(batch.size, 1, MAX_ITEMS_PER_RUN);
  // Own keys only: "constructor" is not a state.
  const state =
    typeof batch.state === "string" && Object.hasOwn(STATES, batch.state)
      ? STATES[batch.state]
      : undefined;
  if (size === null || state === undefined) return null;
  const progress = isRecord(body.progress) ? body.progress : {};
  const counted = wholeNumber(progress.minted, 0, size) ?? 0;
  return { id: runId, size, state, made: state === "made" ? size : counted };
}

/**
 * The id of a run just set up, or null. Taken only when the answer is for
 * this product, of the size asked, and not started.
 */
export function parseCreatedRun(
  status: number,
  body: unknown,
  productId: string,
  quantity: number,
): string | null {
  if (status !== 201 || !isRecord(body) || body.ok !== true || !isRecord(body.batch)) return null;
  const batch = body.batch;
  const id = parseRunId(batch.id);
  if (id === null || batch.templateId !== productId) return null;
  if (batch.size !== quantity || batch.state !== "validated") return null;
  return id;
}

export type StartResult =
  | { kind: "started" }
  | { kind: "limit"; limit: number; remaining: number }
  | { kind: "no-wallet" }
  | { kind: "not-ready" }
  | { kind: "off" }
  | { kind: "failed" };

/** What tagit-services said when asked to start a run. Anything unclear is "failed". */
export function parseStart(status: number, body: unknown, runId: string): StartResult {
  if (!isRecord(body)) return { kind: "failed" };
  if ((status === 200 || status === 202) && body.ok === true && body.batchId === runId) {
    return { kind: "started" };
  }
  const code = body.error;
  if (status === 409 && code === "BRAND_DAILY_LIMIT" && isRecord(body.details)) {
    const limit = wholeNumber(body.details.limit, 1, 1_000_000);
    const remaining = wholeNumber(body.details.remaining, 0, 1_000_000);
    if (limit !== null && remaining !== null) return { kind: "limit", limit, remaining };
  }
  if (status === 409 && code === "BRAND_MINT_WALLET_MISSING") return { kind: "no-wallet" };
  if (status === 409 && (code === "TEMPLATE_NOT_PUBLISHED" || code === "TEMPLATE_INCOMPLETE")) {
    return { kind: "not-ready" };
  }
  if (status === 403 && code === "BRAND_MINT_OFF") return { kind: "off" };
  return { kind: "failed" };
}

/** Why a run did not start, in plain words. Never the server's own text. */
export function startProblem(
  result: Exclude<StartResult, { kind: "started" }>,
  size: number,
): string {
  switch (result.kind) {
    case "limit":
      return result.remaining === 0
        ? `Your brand has reached its limit of ${result.limit} items in 24 hours. Nothing was made. Try again later.`
        : `Your brand can make ${result.remaining} more ${result.remaining === 1 ? "item" : "items"} right now (the limit is ${result.limit} in 24 hours), and this run has ${size}. Nothing was made. Set up a smaller run.`;
    case "no-wallet":
      return "Your brand is not fully set up to receive items yet. Nothing was made. Ask TAG IT to finish your brand's setup.";
    case "not-ready":
      return "This product has to be published, with every detail filled in, before items can be made. Nothing was made.";
    case "off":
      return "Making items is not switched on yet. Nothing was made. Ask TAG IT to make these items for you.";
    case "failed":
      return "That could not be started just now. Nothing was made. Try again in a moment.";
  }
}
