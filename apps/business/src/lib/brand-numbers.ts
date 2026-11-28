import { hasRole, type Role } from "@/lib/access";

/**
 * Sales and tap numbers for a brand (TAP-T18). PURE logic, unit-tested
 * without a server: who may download, and how untrusted answers are read.
 *
 * - Everyone on the brand's team sees the numbers and the sales list.
 * - Only a Manager may download the sales file ({@link canExportSales}),
 *   decided on the server. The API checks it again against the roster.
 * - Nothing here is about a buyer or a shopper: the API sends an item, a
 *   price, how it was paid, when and how it stands, and for taps only counts.
 *   Anything else in an answer is dropped, not shown.
 */

/** Download the sales file: Managers only. */
export function canExportSales(role: Role | null): boolean {
  return hasRole(role, "admin");
}

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000_000
    ? value
    : null;

const ITEM_RE = /^[1-9]\d{0,29}$/;
const HIDDEN_RE = /[\p{C}\p{Zl}\p{Zp}]/gu;

/** A product name as text to show: no hidden characters, not endless. Null when empty. */
function shownName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(HIDDEN_RE, "").trim().slice(0, 120);
  return name.length > 0 ? name : null;
}

// ── taps ─────────────────────────────────────────────────────────────────────

export interface TapNumbers {
  taps7: number;
  taps30: number;
  usedLinks7: number;
  usedLinks30: number;
  topItems: Array<{ item: string; name: string | null; taps: number }>;
  topCountries: Array<{ country: string; taps: number }>;
  /** True when the brand had more taps than one summary counts. */
  capped: boolean;
}

/** The brand's tap numbers as tagit-services sends them, or null. */
export function parseTapNumbers(status: number, body: unknown): TapNumbers | null {
  if (status !== 200 || typeof body !== "object" || body === null) return null;
  const answer = body as { ok?: unknown; taps?: unknown };
  if (answer.ok !== true || typeof answer.taps !== "object" || answer.taps === null) return null;
  const taps = answer.taps as Record<string, unknown>;
  const [taps7, taps30, usedLinks7, usedLinks30] = [
    count(taps.taps7),
    count(taps.taps30),
    count(taps.usedLinks7),
    count(taps.usedLinks30),
  ];
  if (taps7 === null || taps30 === null || usedLinks7 === null || usedLinks30 === null) return null;

  const topItems: TapNumbers["topItems"] = [];
  for (const raw of Array.isArray(taps.topItems) ? taps.topItems.slice(0, 20) : []) {
    if (topItems.length === 5) break;
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as { tokenId?: unknown; name?: unknown; taps?: unknown };
    const n = count(row.taps);
    if (typeof row.tokenId !== "string" || !ITEM_RE.test(row.tokenId) || n === null || n === 0) {
      continue;
    }
    topItems.push({ item: row.tokenId, name: shownName(row.name), taps: n });
  }
  const topCountries: TapNumbers["topCountries"] = [];
  for (const raw of Array.isArray(taps.topCountries) ? taps.topCountries.slice(0, 20) : []) {
    if (topCountries.length === 5) break;
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as { country?: unknown; taps?: unknown };
    const n = count(row.taps);
    if (
      typeof row.country !== "string" ||
      !/^[A-Z]{2}$/.test(row.country) ||
      n === null ||
      n === 0
    ) {
      continue;
    }
    topCountries.push({ country: row.country, taps: n });
  }
  return {
    taps7,
    taps30,
    usedLinks7,
    usedLinks30,
    topItems,
    topCountries,
    capped: taps.capped === true,
  };
}

/** "Germany" for "DE". The code itself when the name is not known. */
export function countryWords(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "Unknown";
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

// ── sales ────────────────────────────────────────────────────────────────────

export type SaleState = "sold" | "processing" | "refund_due" | "refunded" | "problem";
export type SaleMethod = "crypto" | "card";

export interface BrandSale {
  key: string;
  item: string;
  name: string | null;
  /** "33.33" */
  price: string;
  method: SaleMethod;
  state: SaleState;
  /** ISO 8601, as sent. */
  at: string;
}

export interface SalesPage {
  sales: BrandSale[];
  /** Where the next, older page starts; null on the last one. */
  next: string | null;
}

const STATE_WORDS: Record<SaleState, string> = {
  sold: "Sold",
  processing: "Processing",
  refund_due: "Refund due",
  refunded: "Refunded",
  problem: "Needs attention",
};
const METHOD_WORDS: Record<SaleMethod, string> = { card: "Card", crypto: "Crypto" };

export function saleStateWords(state: SaleState): string {
  return STATE_WORDS[state];
}
export function saleMethodWords(method: SaleMethod): string {
  return METHOD_WORDS[method];
}

const PRICE_RE = /^\d{1,9}\.\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/** A time the API sent, checked: ISO 8601 with a zone, and a real date. */
export function parseSaleTime(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40 || !ISO_RE.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

/** One page of the brand's sales as tagit-services sends it, or null. */
export function parseSales(status: number, body: unknown): SalesPage | null {
  if (status !== 200 || typeof body !== "object" || body === null) return null;
  const answer = body as { ok?: unknown; sales?: unknown; next?: unknown };
  if (answer.ok !== true || !Array.isArray(answer.sales)) return null;
  const sales: BrandSale[] = [];
  for (const raw of answer.sales.slice(0, 100)) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const at = parseSaleTime(row.at);
    if (
      typeof row.tokenId !== "string" ||
      !ITEM_RE.test(row.tokenId) ||
      typeof row.price !== "string" ||
      !PRICE_RE.test(row.price) ||
      typeof row.method !== "string" ||
      !Object.hasOwn(METHOD_WORDS, row.method) ||
      typeof row.state !== "string" ||
      !Object.hasOwn(STATE_WORDS, row.state) ||
      at === null
    ) {
      continue;
    }
    sales.push({
      key:
        typeof row.id === "string" && /^[a-z0-9]{1,40}$/.test(row.id)
          ? row.id
          : `${at}-${row.tokenId}`,
      item: row.tokenId,
      name: shownName(row.name),
      price: row.price,
      method: row.method as SaleMethod,
      state: row.state as SaleState,
      at,
    });
  }
  return { sales, next: parseSaleTime(answer.next) };
}

/** "Nov 27, 2026, 8:09 AM UTC" */
export function saleTimeWords(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "Date not known";
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(time)} UTC`;
}

/** "$1,234.50" from "1234.50". */
export function priceWords(price: string): string {
  if (!PRICE_RE.test(price)) return "";
  const [whole, cents] = price.split(".") as [string, string];
  return `$${BigInt(whole).toLocaleString("en-US")}.${cents}`;
}

/**
 * The sales file as text, or null. It must look like the file the API
 * writes: its header line first. Anything else (an error page, JSON) is not
 * handed to the browser as a download.
 */
export const SALES_FILE_HEADER =
  '"Date (UTC)","Item number","Product","Price (USD)","Paid by","Status"';
export const SALES_FILE_MAX_BYTES = 2_000_000;

export function parseSalesFile(status: number, text: unknown): string | null {
  if (status !== 200 || typeof text !== "string") return null;
  if (text.length > SALES_FILE_MAX_BYTES) return null;
  if (text !== SALES_FILE_HEADER && !text.startsWith(`${SALES_FILE_HEADER}\n`)) return null;
  return text;
}
