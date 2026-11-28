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

// ── Lot and dates ────────────────────────────────────────────────────────────

/**
 * What every item of a run shares, shown on each item's public record: a lot
 * code, the day it was made and its best-before day. All optional. Only for
 * products whose PUBLISHED version is in the cosmetics category
 * (tagit-services refuses them elsewhere, and items are made from that
 * version, not from unpublished edits).
 */
export interface RunFacts {
  lot?: string;
  madeOn?: string;
  bestBefore?: string;
}

export type RunFactField = "lot" | "madeOn" | "bestBefore";
export const RUN_FACT_FIELDS: readonly RunFactField[] = ["lot", "madeOn", "bestBefore"];
export const LOT_MAX = 60;

/** Whether a product's category takes a lot and dates. */
export function takesRunFacts(category: unknown): boolean {
  return typeof category === "string" && category.trim().toLowerCase() === "cosmetics";
}

// The same rule tagit-services holds a lot to: one line of plain text, no
// control, line-break or text-direction characters (and nothing unassigned).
const LOT_FORBIDDEN_RE = /[\p{C}\p{Zl}\p{Zp}]/u;
const isLot = (value: string): boolean =>
  value.length >= 1 &&
  value.length <= LOT_MAX &&
  value === value.trim() &&
  !LOT_FORBIDDEN_RE.test(value);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A checked YYYY-MM-DD day in plain words, e.g. "Dec 1, 2019". */
export function factDayWords(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${date}, ${year}`;
}
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A day that exists on the calendar, 2000 to 2100, as YYYY-MM-DD. */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export type RunFactsResult =
  | { ok: true; facts: RunFacts | null }
  | { ok: false; errors: Partial<Record<RunFactField, string>> };

/**
 * The lot and dates from the form. Empty fields are left out; all empty is
 * "none" (null). Anything that is not text counts as empty.
 */
export function parseRunFacts(get: (field: RunFactField) => unknown): RunFactsResult {
  const read = (field: RunFactField): string => {
    const value = get(field);
    return typeof value === "string" ? value.trim() : "";
  };
  const lot = read("lot");
  const madeOn = read("madeOn");
  const bestBefore = read("bestBefore");
  const errors: Partial<Record<RunFactField, string>> = {};
  if (lot !== "" && !isLot(lot)) {
    errors.lot = `Use up to ${LOT_MAX} characters on one line, with no hidden characters.`;
  }
  if (madeOn !== "" && !isCalendarDay(madeOn)) errors.madeOn = "Choose a real date.";
  if (bestBefore !== "" && !isCalendarDay(bestBefore)) errors.bestBefore = "Choose a real date.";
  if (
    !errors.madeOn &&
    !errors.bestBefore &&
    madeOn !== "" &&
    bestBefore !== "" &&
    bestBefore < madeOn
  ) {
    errors.bestBefore = "Best before cannot be earlier than the day it was made.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const facts: RunFacts = {
    ...(lot !== "" ? { lot } : {}),
    ...(madeOn !== "" ? { madeOn } : {}),
    ...(bestBefore !== "" ? { bestBefore } : {}),
  };
  return { ok: true, facts: Object.keys(facts).length > 0 ? facts : null };
}

/** A run's lot and dates as tagit-services stored them: checked again, or null. */
export function readRunFacts(value: unknown): RunFacts | null {
  if (!isRecord(value)) return null;
  const facts: RunFacts = {};
  if (typeof value.lot === "string" && isLot(value.lot)) {
    facts.lot = value.lot;
  }
  if (isCalendarDay(value.madeOn)) facts.madeOn = value.madeOn;
  if (isCalendarDay(value.bestBefore)) facts.bestBefore = value.bestBefore;
  return Object.keys(facts).length > 0 ? facts : null;
}

export interface RunBody {
  templateId: string;
  quantity: number;
  facts?: RunFacts;
}

/** What is sent to set a run up. Built from checked values, nothing else. */
export function bodyForRun(
  productId: string,
  quantity: number,
  facts: RunFacts | null = null,
): RunBody {
  return {
    templateId: productId,
    quantity,
    ...(facts !== null
      ? {
          facts: {
            ...(facts.lot !== undefined ? { lot: facts.lot } : {}),
            ...(facts.madeOn !== undefined ? { madeOn: facts.madeOn } : {}),
            ...(facts.bestBefore !== undefined ? { bestBefore: facts.bestBefore } : {}),
          },
        }
      : {}),
  };
}

export type RunState = "waiting" | "making" | "made" | "failed";

export interface ItemRun {
  id: string;
  /** How many items the run holds. */
  size: number;
  state: RunState;
  /** How many of them exist so far. */
  made: number;
  /** The lot and dates the run was set up with, or null. */
  facts: RunFacts | null;
}

/** One line of a product's run history. */
export interface RunSummary {
  id: string;
  size: number;
  state: RunState;
  /** The day it was set up, e.g. "Nov 27, 2026", or null. */
  day: string | null;
  /** Who set it up, or null. */
  by: string | null;
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
  const state = runState(batch.state);
  if (size === null || state === undefined) return null;
  const progress = isRecord(body.progress) ? body.progress : {};
  const counted = wholeNumber(progress.minted, 0, size) ?? 0;
  return {
    id: runId,
    size,
    state,
    made: state === "made" ? size : counted,
    facts: readRunFacts(batch.facts),
  };
}

export const RUNS_SHOWN = 50;

function runState(value: unknown): RunState | undefined {
  // Own keys only: "constructor" is not a state.
  return typeof value === "string" && Object.hasOwn(STATES, value) ? STATES[value] : undefined;
}

/**
 * A product's runs, newest first as tagit-services sends them, or null when
 * the list could not be read. A row filed under another product is dropped.
 */
export function parseRuns(
  status: number,
  body: unknown,
  productId: string,
  day: (value: unknown) => string | null,
): RunSummary[] | null {
  if (status !== 200 || !isRecord(body) || body.ok !== true || !Array.isArray(body.batches)) {
    return null;
  }
  const runs: RunSummary[] = [];
  const seen = new Set<string>();
  for (const raw of body.batches.slice(0, RUNS_SHOWN)) {
    if (!isRecord(raw) || raw.templateId !== productId) continue;
    const id = parseRunId(raw.id);
    const size = wholeNumber(raw.quantity, 1, MAX_ITEMS_PER_RUN);
    const state = runState(raw.state);
    if (id === null || size === null || state === undefined || seen.has(id)) continue;
    seen.add(id);
    const by = typeof raw.actor === "string" ? raw.actor.trim().slice(0, 120) : "";
    runs.push({ id, size, state, day: day(raw.createdAt), by: by.includes("@") ? by : null });
  }
  return runs;
}

const RUN_STATE_WORDS: Record<RunState, string> = {
  waiting: "Not started",
  making: "Being made",
  made: "Made",
  failed: "Not made",
};

export function runStateWords(state: RunState): string {
  return RUN_STATE_WORDS[state];
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
