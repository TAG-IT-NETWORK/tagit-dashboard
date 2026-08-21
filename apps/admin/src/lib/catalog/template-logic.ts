/**
 * Pure /catalog template logic (META-T33) — no fetch, no React, fully
 * unit-tested. Runs identically in server components, route handlers and the
 * browser.
 */

import type {
  TemplateAttribute,
  TemplateDto,
  TemplateStatus,
  TemplateVersionDto,
} from "./template-types";

/** Mirror of tagit-services TEMPLATE_ID_RE (template-router.ts). */
export const TEMPLATE_ID_RE = /^tpl_[0-9A-Za-z]{1,64}$/;
/** Mirror of tagit-services PROPAGATE_JOB_ID_RE (template-router.ts). */
export const PROPAGATE_JOB_ID_RE = /^pjob_[0-9A-Za-z]{1,64}$/;

// ──────────────────────────────────────────────
// Role seam (REQ-S-16 / SHARED actor contract)
// ──────────────────────────────────────────────

export type CatalogRole = "admin" | "editor" | "viewer";

/**
 * Write gate for the catalog surface: viewers are read-only. META-T32 landed
 * the admin session + roster roles, so `null` now means "unauthenticated or
 * not enrolled in admin_users" and FAILS CLOSED (pre-T32 it kept writes
 * enabled to avoid dead-locking the console before any session existed).
 * Publishing is stricter still — admin only, see canPublishCatalog.
 */
export function canMutateCatalog(role: CatalogRole | null): boolean {
  return role === "editor" || role === "admin";
}

/**
 * Publish gate (META-T32 role map: publish/prices are admin-level). Editors
 * (dashboard `operator` role) may edit drafts, media and overrides; only
 * admins may snapshot a working copy into a live template version.
 */
export function canPublishCatalog(role: CatalogRole | null): boolean {
  return role === "admin";
}

// ──────────────────────────────────────────────
// Status chip
// ──────────────────────────────────────────────

export interface StatusStyle {
  label: string;
  /** Tailwind classes for the chip (theme tokens only, light/dark safe). */
  className: string;
}

const STATUS_STYLES: Record<TemplateStatus, StatusStyle> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  published: { label: "Published", className: "bg-green-500/15 text-green-500" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground line-through" },
};

export function templateStatusStyle(status: string): StatusStyle {
  return (
    STATUS_STYLES[status as TemplateStatus] ?? {
      label: status,
      className: "bg-muted text-muted-foreground",
    }
  );
}

// ──────────────────────────────────────────────
// Money formatting (string/bigint math only — mirrors services src/lib/currency.ts)
// ──────────────────────────────────────────────

/** Mirror of services CURRENCY_EXPONENTS (subset used for display). */
export const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  CNY: 2,
  HKD: 2,
  SGD: 2,
};

function minorToDecimalString(amount: bigint, exponent: number): string {
  const digits = amount.toString();
  if (exponent === 0) return digits;
  const padded = digits.padStart(exponent + 1, "0");
  const cut = padded.length - exponent;
  return `${padded.slice(0, cut)}.${padded.slice(cut)}`;
}

/**
 * "22500000" (usdc-6 minor units, serializeTemplate shape) → "$22.50".
 * Mirrors services formatUsdcDisplay: round half-up to cents. Returns null
 * for null/malformed input.
 */
export function formatUsdc6Display(priceUsdc6: string | null | undefined): string | null {
  if (priceUsdc6 === null || priceUsdc6 === undefined) return null;
  if (!/^\d{1,30}$/.test(priceUsdc6)) return null;
  const cents = (BigInt(priceUsdc6) + 5000n) / 10000n;
  return `$${minorToDecimalString(cents, 2)}`;
}

/**
 * "22500000" → "22.5" — usdc-6 minor units back to the decimal-string input
 * format parseUsdcString accepts (trailing zeros trimmed, integer amounts
 * lose the dot). Null/malformed → "" (empty input field).
 */
export function usdc6ToDecimalInput(priceUsdc6: string | null | undefined): string {
  if (priceUsdc6 === null || priceUsdc6 === undefined || !/^\d{1,30}$/.test(priceUsdc6)) return "";
  const raw = minorToDecimalString(BigInt(priceUsdc6), 6);
  const [whole, fraction = ""] = raw.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed === "" ? whole : `${whole}.${trimmed}`;
}

/** MSRP minor units + ISO code → "1 200.00 USD"-style display (null when unset). */
export function formatMsrpDisplay(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (amount === null || amount === undefined || !currency) return null;
  if (!Number.isInteger(amount) || amount < 0) return null;
  const exponent = CURRENCY_EXPONENTS[currency];
  if (exponent === undefined) return null;
  return `${minorToDecimalString(BigInt(amount), exponent)} ${currency}`;
}

// ──────────────────────────────────────────────
// Working-copy vs published-snapshot drift
// ──────────────────────────────────────────────

/**
 * Client-side mirror of services buildTemplateSnapshot()
 * (src/catalog/template-snapshot.ts) — maps the working copy onto the exact
 * shape stored in template_versions.snapshot so the two can be deep-compared.
 */
export function workingCopySnapshot(t: TemplateDto): Record<string, unknown> {
  return {
    name: t.name,
    brand: t.brand,
    model: t.model,
    sku: t.sku,
    category: t.category,
    origin: t.origin,
    description: t.description,
    attributes: t.attributes,
    priceUsdc6: t.priceUsdc6,
    msrpAmount: t.msrpAmount,
    msrpCurrency: t.msrpCurrency,
    slug: t.slug,
  };
}

export function deepJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepJsonEqual(v, b[i]));
  }
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    return (
      ak.length === bk.length &&
      ak.every(
        (k) =>
          k in (b as Record<string, unknown>) &&
          deepJsonEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return false;
}

export interface PublishState {
  /** Highest published snapshot version (0 = never published). */
  latestVersion: number;
  /** Working copy differs from the latest published snapshot (fork drift). */
  workingDirty: boolean;
  /**
   * Items-drift signal for the Items tab banner:
   *  - "none"   — never published: nothing to drift against.
   *  - "info"   — one published version; items adopted since publish are
   *               current, but propagation state is unknowable over the
   *               shipped HTTP surface (no per-item template linkage).
   *  - "behind" — a REPUBLISH happened (≥2 versions): every item adopted
   *               before the latest publish renders an older snapshot until
   *               an explicit propagate runs.
   */
  itemsDrift: "none" | "info" | "behind";
}

export function computePublishState(
  template: TemplateDto,
  versions: TemplateVersionDto[],
): PublishState {
  const latestVersion = versions.reduce((max, v) => Math.max(max, v.version), 0);
  const latest = versions.find((v) => v.version === latestVersion);
  const workingDirty =
    latest !== undefined && !deepJsonEqual(workingCopySnapshot(template), latest.snapshot);
  const itemsDrift = latestVersion === 0 ? "none" : latestVersion >= 2 ? "behind" : "info";
  return { latestVersion, workingDirty, itemsDrift };
}

// ──────────────────────────────────────────────
// Token-id input parsing (Items tab / propagate subset)
// ──────────────────────────────────────────────

/** Mirror of the services adopt/propagate tokenIds cap (template-router.ts). */
export const MAX_TOKEN_IDS = 1000;
const MAX_RANGE_SPAN = MAX_TOKEN_IDS;

export interface TokenIdParse {
  ids: string[];
  errors: string[];
}

/**
 * Parse a free-text token-id list: ids separated by whitespace/commas/
 * semicolons, with inclusive ranges like "100-120". Dedupes (first
 * occurrence wins), caps at MAX_TOKEN_IDS, rejects malformed chunks with
 * per-chunk errors instead of throwing.
 */
export function parseTokenIdInput(text: string): TokenIdParse {
  const ids: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  const push = (id: string): boolean => {
    // Normalize "007" → "7" so dedupe and the services BigInt parse agree.
    const normalized = BigInt(id).toString();
    if (seen.has(normalized)) return true;
    if (ids.length >= MAX_TOKEN_IDS) {
      errors.push(`more than ${MAX_TOKEN_IDS} ids — truncated`);
      return false;
    }
    seen.add(normalized);
    ids.push(normalized);
    return true;
  };

  outer: for (const chunk of text.split(/[\s,;]+/)) {
    if (chunk === "") continue;
    if (/^\d+$/.test(chunk)) {
      if (!push(chunk)) break;
      continue;
    }
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(chunk);
    if (range) {
      const start = BigInt(range[1]);
      const end = BigInt(range[2]);
      if (end < start) {
        errors.push(`'${chunk}': range end before start`);
        continue;
      }
      if (end - start + 1n > BigInt(MAX_RANGE_SPAN)) {
        errors.push(`'${chunk}': range spans more than ${MAX_RANGE_SPAN} ids`);
        continue;
      }
      for (let v = start; v <= end; v++) {
        if (!push(v.toString())) break outer;
      }
      continue;
    }
    errors.push(`'${chunk}' is not a token id or range`);
  }

  return { ids, errors };
}

// ──────────────────────────────────────────────
// Snapshot diff (Publish rail) — line diff, no deps
// ──────────────────────────────────────────────

export interface DiffLine {
  type: "same" | "add" | "del";
  /** Line text on the older side ('del'/'same'). */
  left?: string;
  /** Line text on the newer side ('add'/'same'). */
  right?: string;
}

function stableStringify(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (typeof v === "object" && v !== null) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = sortKeys((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(value), null, 2);
}

const MAX_DIFF_LINES = 400;

/**
 * Line diff between two JSON values (older → newer), via classic LCS on the
 * pretty-printed, key-sorted lines. Snapshots are small (≤ a few hundred
 * lines by the services field caps); inputs beyond MAX_DIFF_LINES fall back
 * to a plain del-all/add-all listing rather than an O(n²) table.
 */
export function buildJsonDiff(older: unknown, newer: unknown): DiffLine[] {
  const a = stableStringify(older).split("\n");
  const b = stableStringify(newer).split("\n");

  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    return [
      ...a.map<DiffLine>((line) => ({ type: "del", left: line })),
      ...b.map<DiffLine>((line) => ({ type: "add", right: line })),
    ];
  }

  // LCS length table.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", left: a[i], right: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", left: a[i] });
      i++;
    } else {
      out.push({ type: "add", right: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", left: a[i++] });
  while (j < m) out.push({ type: "add", right: b[j++] });
  return out;
}

/** True when the diff contains any non-'same' line. */
export function diffHasChanges(diff: DiffLine[]): boolean {
  return diff.some((l) => l.type !== "same");
}

// ──────────────────────────────────────────────
// Template media convention (Media tab)
// ──────────────────────────────────────────────

/**
 * product_templates has NO media column (services schema) and snapshot media
 * would leak into doc bytes anyway. The Media tab therefore persists uploads
 * as reserved attribute rows — attributes DO flow into rendered docs and fit
 * the services caps (trait_type/value ≤ 200 chars):
 *
 *   { trait_type: "media:hero",    value: "<variant url>" }
 *   { trait_type: "media:gallery", value: "<variant url>" }
 *
 * The Details tab hides media:* rows (they are Media-tab managed); the
 * /catalog table thumb reads the first media:hero.
 */
export const MEDIA_ATTR_PREFIX = "media:";
/** Services freeText cap for attribute values (templates.ts). */
export const ATTR_VALUE_MAX = 200;
/** Services cap on the attributes array (templates.ts). */
export const MAX_ATTRIBUTES = 64;

export interface TemplateMediaRef {
  role: "hero" | "gallery";
  url: string;
}

export function isMediaAttribute(attr: TemplateAttribute): boolean {
  return attr.trait_type.startsWith(MEDIA_ATTR_PREFIX);
}

export function mediaListFromAttributes(
  attributes: TemplateAttribute[] | null | undefined,
): TemplateMediaRef[] {
  if (!attributes) return [];
  return attributes
    .filter(isMediaAttribute)
    .map((a) => ({
      role: a.trait_type === "media:hero" ? ("hero" as const) : ("gallery" as const),
      url: a.value,
    }))
    .filter((m) => m.url.length > 0);
}

export type MediaMergeResult =
  | { ok: true; attributes: TemplateAttribute[] }
  | { ok: false; error: string };

/**
 * Replace all media:* attribute rows with `media` (hero first), preserving
 * every non-media attribute in order. Enforces the services caps up front so
 * the user gets instant feedback instead of a 400.
 */
export function mergeMediaIntoAttributes(
  attributes: TemplateAttribute[] | null | undefined,
  media: TemplateMediaRef[],
): MediaMergeResult {
  for (const m of media) {
    if (m.url.length === 0 || m.url.length > ATTR_VALUE_MAX) {
      return { ok: false, error: `media url must be 1–${ATTR_VALUE_MAX} chars` };
    }
  }
  const kept = (attributes ?? []).filter((a) => !isMediaAttribute(a));
  const heroFirst = [...media].sort((a, b) =>
    a.role === b.role ? 0 : a.role === "hero" ? -1 : 1,
  );
  const next = [
    ...kept,
    ...heroFirst.map((m) => ({ trait_type: `${MEDIA_ATTR_PREFIX}${m.role}`, value: m.url })),
  ];
  if (next.length > MAX_ATTRIBUTES) {
    return { ok: false, error: `attributes cap is ${MAX_ATTRIBUTES} rows (services limit)` };
  }
  return { ok: true, attributes: next };
}

/** Thumb for the /catalog table: first media:hero, else first media:*. */
export function templateThumbUrl(attributes: TemplateAttribute[] | null | undefined): string | null {
  const media = mediaListFromAttributes(attributes);
  return media.find((m) => m.role === "hero")?.url ?? media[0]?.url ?? null;
}
