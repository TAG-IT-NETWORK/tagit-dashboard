/**
 * A cosmetics item's facts, ready to show to a shopper (TAP-T09).
 *
 * The item record carries them as the `facts` block: what the brand wrote on
 * the template (size, ingredients, how to use, warnings, use within) and what
 * it declared for the batch (lot, made on, best before). This module turns
 * that block into display values and nothing more: labels live in
 * consumer-copy, layout in the components.
 *
 * REQ-S-10: every string here is brand-written. It is shown as plain text —
 * the components render it as a text node, never as markup, and never turn
 * part of it into a link. tagit-services already holds each value to one line
 * of capped plain text; the same test is repeated here so a value that should
 * never have arrived is left off the page instead of being drawn.
 *
 * Pure functions with type-only imports: safe in tests and in any bundle.
 */
import { COPY } from "./consumer-copy";
import type { AssetFactsBlock } from "./services";

/** Display values. Only filled keys are present. */
export interface ProductFactsView {
  size?: string;
  /** The batch (lot) number. */
  batch?: string;
  /** "Jun 1, 2026" */
  madeOn?: string;
  bestBefore?: string;
  /** "12 months of opening" */
  useWithin?: string;
  howToUse?: string;
  warnings?: string;
  ingredients?: string;
}

/** Mirror of tagit-services COSMETICS_FACT_LIMITS; `lot` is the doc's older cap. */
const LIMITS = { size: 60, ingredients: 4000, howToUse: 1500, warnings: 1500, lot: 200 } as const;

/**
 * Control characters and the characters that change text direction. Written as
 * code-point tests so no invisible character has to live in this file.
 */
function hasForbiddenChar(value: string): boolean {
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

/** One line of plain text within the cap, or nothing. */
function plain(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text === "" || text.length > max || hasForbiddenChar(text)) return undefined;
  return text;
}

/**
 * "2026-06-01" → "Jun 1, 2026". The date is a calendar day the brand declared,
 * not a moment in time, so it is formatted in UTC and reads the same for every
 * shopper. Anything that is not a real day gives nothing.
 */
export function formatIsoDay(iso: unknown): string | undefined {
  if (typeof iso !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * The facts to show, or undefined when the record has none worth showing.
 * A restricted or missing record never reaches here with a block: the
 * services API leaves `facts` out for those.
 */
export function productFactsViewOf(
  block: AssetFactsBlock | null | undefined,
): ProductFactsView | undefined {
  if (!block || typeof block !== "object") return undefined;
  const view: ProductFactsView = {};

  const size = plain(block.size, LIMITS.size);
  if (size) view.size = size;
  const batch = plain(block.lot, LIMITS.lot);
  if (batch) view.batch = batch;
  const madeOn = formatIsoDay(block.madeOn);
  if (madeOn) view.madeOn = madeOn;
  const bestBefore = formatIsoDay(block.bestBefore);
  if (bestBefore) view.bestBefore = bestBefore;

  const months = block.useWithinMonths;
  if (typeof months === "number" && Number.isInteger(months) && months >= 1 && months <= 120) {
    view.useWithin = COPY.about.useWithinValue(months);
  }

  const howToUse = plain(block.howToUse, LIMITS.howToUse);
  if (howToUse) view.howToUse = howToUse;
  const warnings = plain(block.warnings, LIMITS.warnings);
  if (warnings) view.warnings = warnings;
  const ingredients = plain(block.ingredients, LIMITS.ingredients);
  if (ingredients) view.ingredients = ingredients;

  return Object.keys(view).length > 0 ? view : undefined;
}
