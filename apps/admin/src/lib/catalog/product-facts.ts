/**
 * Product facts for shoppers (TAP-T09) — pure console logic: no fetch, no
 * React. Mirrors tagit-services src/catalog/product-facts.ts and the caps in
 * src/metadata/schema.ts, READ from the services source.
 *
 * A cosmetics product can carry two kinds of fact:
 *   on the template — size, ingredients, how to use, warnings, use within
 *   on the batch    — lot, made on, best before
 *
 * The server is the enforcement point. What is here gives the person typing
 * an answer straight away, and builds the request body.
 */

import type { TemplateDto, TemplateVersionDto } from "./template-types";

/** Mirror of services COSMETICS_FACT_LIMITS and BATCH_LOT_MAX. */
export const FACT_LIMITS = {
  size: 60,
  ingredients: 4000,
  howToUse: 1500,
  warnings: 1500,
  useWithinMonthsMin: 1,
  useWithinMonthsMax: 120,
  lot: 60,
} as const;

/** product_templates.facts as the API returns it. Only filled keys are present. */
export interface TemplateFacts {
  size?: string;
  ingredients?: string;
  howToUse?: string;
  warnings?: string;
  useWithinMonths?: number;
}

/** batches.facts as the API returns it. Dates are YYYY-MM-DD. */
export interface BatchFacts {
  lot?: string;
  madeOn?: string;
  bestBefore?: string;
}

// ──────────────────────────────────────────────
// Which products take facts
// ──────────────────────────────────────────────

/**
 * Facts are for the cosmetics category, however the brand capitalised it —
 * the same case-blind match services uses to pick the doc's ext schema.
 */
export function takesProductFacts(category: string | null | undefined): boolean {
  return typeof category === "string" && category.trim().toLowerCase() === "cosmetics";
}

/**
 * Whether the API behind this console knows about facts at all: a services
 * build with the `facts` column returns the key (null when unset) on every
 * template. Without it the fields stay hidden, so the console can be
 * deployed before services without offering a save that would be refused.
 */
export function factsSupported(template: Pick<TemplateDto, "facts">): boolean {
  return template.facts !== undefined;
}

/**
 * The category the next batch's items will be minted with: the latest
 * PUBLISHED snapshot's, or the working copy's for a template that was never
 * published. Mirror of services resolveTemplateFields (batch.ts) — services
 * refuses batch facts unless THIS category is cosmetics.
 */
export function mintCategory(
  template: Pick<TemplateDto, "category">,
  versions: ReadonlyArray<Pick<TemplateVersionDto, "version" | "snapshot">>,
): string | null {
  const latest = versions.reduce<Pick<TemplateVersionDto, "version" | "snapshot"> | null>(
    (best, v) => (best === null || v.version > best.version ? v : best),
    null,
  );
  if (latest === null) return template.category ?? null;
  const category = latest.snapshot.category;
  return typeof category === "string" ? category : null;
}

// ──────────────────────────────────────────────
// Text handling (mirror of services plainText + foldWhitespace)
// ──────────────────────────────────────────────

/** Fold line breaks, tabs and runs of spaces into single spaces, as services does. */
export function foldFactText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * Control characters and the characters that change text direction. Written
 * as code-point tests rather than a regular expression so no invisible
 * character has to live in this file.
 */
export function hasForbiddenFactChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (
      c <= 0x1f ||
      (c >= 0x7f && c <= 0x9f) ||
      c === 0x2028 ||
      c === 0x2029 ||
      (c >= 0x202a && c <= 0x202e) ||
      (c >= 0x2066 && c <= 0x2069)
    ) {
      return true;
    }
  }
  return false;
}

function checkText(folded: string, max: number): string | null {
  if (folded.length > max) {
    return `Keep this to ${max.toLocaleString("en-US")} characters (now ${folded.length.toLocaleString("en-US")}).`;
  }
  if (hasForbiddenFactChar(folded)) {
    return "This contains a hidden control character. Retype the text instead of pasting it.";
  }
  return null;
}

// ──────────────────────────────────────────────
// Template facts form
// ──────────────────────────────────────────────

/** The editor's form state: every field a string, empty when unset. */
export interface TemplateFactsDraft {
  size: string;
  ingredients: string;
  howToUse: string;
  warnings: string;
  useWithinMonths: string;
}

export type TemplateFactField = keyof TemplateFactsDraft;

export function templateFactsDraft(facts: TemplateFacts | null | undefined): TemplateFactsDraft {
  return {
    size: facts?.size ?? "",
    ingredients: facts?.ingredients ?? "",
    howToUse: facts?.howToUse ?? "",
    warnings: facts?.warnings ?? "",
    useWithinMonths:
      typeof facts?.useWithinMonths === "number" ? String(facts.useWithinMonths) : "",
  };
}

export interface TemplateFactsRead {
  /** The value to send: only filled keys, or null when nothing is filled in. */
  facts: TemplateFacts | null;
  /** Per-field messages. Empty when the form can be saved. */
  errors: Partial<Record<TemplateFactField, string>>;
}

const TEMPLATE_TEXT_FIELDS = [
  ["size", FACT_LIMITS.size],
  ["ingredients", FACT_LIMITS.ingredients],
  ["howToUse", FACT_LIMITS.howToUse],
  ["warnings", FACT_LIMITS.warnings],
] as const;

/** Turn the form into the request value, with the same rules services applies. */
export function readTemplateFactsDraft(draft: TemplateFactsDraft): TemplateFactsRead {
  const facts: TemplateFacts = {};
  const errors: Partial<Record<TemplateFactField, string>> = {};

  for (const [field, max] of TEMPLATE_TEXT_FIELDS) {
    const folded = foldFactText(draft[field]);
    if (folded === "") continue;
    const error = checkText(folded, max);
    if (error) errors[field] = error;
    else facts[field] = folded;
  }

  const months = draft.useWithinMonths.trim();
  if (months !== "") {
    const value = /^\d{1,3}$/.test(months) ? Number(months) : Number.NaN;
    if (
      Number.isInteger(value) &&
      value >= FACT_LIMITS.useWithinMonthsMin &&
      value <= FACT_LIMITS.useWithinMonthsMax
    ) {
      facts.useWithinMonths = value;
    } else {
      errors.useWithinMonths = `Enter a whole number of months, ${FACT_LIMITS.useWithinMonthsMin} to ${FACT_LIMITS.useWithinMonthsMax}.`;
    }
  }

  return { facts: Object.keys(facts).length > 0 ? facts : null, errors };
}

// ──────────────────────────────────────────────
// Batch facts form
// ──────────────────────────────────────────────

export interface BatchFactsDraft {
  lot: string;
  madeOn: string;
  bestBefore: string;
}

export type BatchFactField = keyof BatchFactsDraft;

export const EMPTY_BATCH_FACTS_DRAFT: BatchFactsDraft = { lot: "", madeOn: "", bestBefore: "" };

/** A date that exists on the calendar, 2000 to 2100. Mirror of services isCalendarDate. */
export function isCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export interface BatchFactsRead {
  facts: BatchFacts | null;
  errors: Partial<Record<BatchFactField, string>>;
}

const DATE_ERROR = "Enter a real date between 2000 and 2100.";

export function readBatchFactsDraft(draft: BatchFactsDraft): BatchFactsRead {
  const facts: BatchFacts = {};
  const errors: Partial<Record<BatchFactField, string>> = {};

  const lot = foldFactText(draft.lot);
  if (lot !== "") {
    const error = checkText(lot, FACT_LIMITS.lot);
    if (error) errors.lot = error;
    else facts.lot = lot;
  }

  const madeOn = draft.madeOn.trim();
  if (madeOn !== "") {
    if (isCalendarDate(madeOn)) facts.madeOn = madeOn;
    else errors.madeOn = DATE_ERROR;
  }
  const bestBefore = draft.bestBefore.trim();
  if (bestBefore !== "") {
    if (isCalendarDate(bestBefore)) facts.bestBefore = bestBefore;
    else errors.bestBefore = DATE_ERROR;
  }
  // ISO dates order the same as strings.
  if (facts.madeOn && facts.bestBefore && facts.bestBefore < facts.madeOn) {
    errors.bestBefore = "Best before cannot be earlier than the made-on date.";
  }

  return { facts: Object.keys(facts).length > 0 ? facts : null, errors };
}

/**
 * The proxy's own read of a `facts` value from a request body: the three
 * known keys as strings, nothing else. Anything malformed is an error for the
 * caller rather than something to forward. Returns null for "no facts".
 */
export function parseBatchFactsBody(
  raw: unknown,
): { ok: true; facts: BatchFacts | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, facts: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "facts must be an object" };
  }
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (key !== "lot" && key !== "madeOn" && key !== "bestBefore") {
      return { ok: false, error: `facts.${key} is not a known field` };
    }
  }
  const draft: BatchFactsDraft = { ...EMPTY_BATCH_FACTS_DRAFT };
  for (const key of ["lot", "madeOn", "bestBefore"] as const) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") return { ok: false, error: `facts.${key} must be text` };
    draft[key] = value;
  }
  const read = readBatchFactsDraft(draft);
  const firstError = (["lot", "madeOn", "bestBefore"] as const)
    .map((key) => (read.errors[key] ? `facts.${key}: ${read.errors[key]}` : null))
    .find((message) => message !== null);
  if (firstError) return { ok: false, error: firstError };
  return { ok: true, facts: read.facts };
}

/** "Lot L2406A · Made on 2026-06-01 · Best before 2028-06-01", or null. */
export function describeBatchFacts(facts: BatchFacts | null | undefined): string | null {
  if (!facts) return null;
  const parts = [
    facts.lot ? `Lot ${facts.lot}` : null,
    facts.madeOn ? `Made on ${facts.madeOn}` : null,
    facts.bestBefore ? `Best before ${facts.bestBefore}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
