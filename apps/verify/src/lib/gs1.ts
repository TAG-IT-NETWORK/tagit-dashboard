/**
 * GS1 Digital Link — minimal parser + builder for the TAG IT DPP carrier.
 *
 * A GS1 Digital Link URL encodes product identity in the URL PATH as
 * alternating Application-Identifier (AI) / value segments, primary key first:
 *
 *     https://id.tagit.network/01/{GTIN-14}/21/{serial}
 *     └ host ────────────────┘ └─ AI 01 ─┘ └─ AI 21 ─┘
 *
 * The TAG IT chip personalizes that path as static bytes and lets the NTAG 424
 * DNA SUN feature overwrite ONLY the query params (?picc=&cmac=) on each tap —
 * so identity (path) and proof-of-presence (query) never collide. See
 * docs/DPP-001 (tagit-hardware) for the full carrier spec.
 *
 * We implement just the AIs a DPP needs:
 *   01  GTIN   (primary key, 14 digits canonical)
 *   21  serial (item-level unique instance)
 *   10  batch/lot
 *   22  CPV (consumer product variant)
 * Lower-cardinality attributes live in the query string per the GS1 spec; we
 * don't model those here (the chip's query is reserved for SUN).
 *
 * Ref: GS1 Digital Link URI Syntax v1.4.x — https://ref.gs1.org/standards/digital-link/uri-syntax/
 */

export interface Gs1Link {
  /** GTIN normalized to 14 digits, or null if absent/invalid. */
  gtin: string | null;
  /** Whether the GTIN's mod-10 check digit is valid. */
  gtinValid: boolean;
  /** AI 21 serial (item-level), if present. */
  serial: string | null;
  /** AI 10 batch/lot, if present. */
  batch: string | null;
  /** AI 22 consumer product variant, if present. */
  cpv: string | null;
  /** All recognized AI/value pairs, keyed by numeric AI. */
  ais: Record<string, string>;
}

/** Recognized primary key / qualifier AIs for the DPP carrier. */
const KNOWN_AIS = new Set(["01", "21", "10", "22"]);

/**
 * Compute the GS1 mod-10 check digit for a 14-digit GTIN string.
 * The rightmost DATA digit (index 12) is weighted x3, alternating x1/x3 leftward.
 */
function gtinCheckDigit(gtin14: string): number {
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = gtin14.charCodeAt(i) - 48;
    const weight = (13 - i) % 2 === 1 ? 3 : 1; // i=12 -> 3 (rightmost data digit)
    sum += d * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** Normalize an 8/12/13/14-digit GTIN to 14 digits (left zero-pad). */
export function normalizeGtin(raw: string): string | null {
  if (!/^\d{8}$|^\d{12,14}$/.test(raw)) return null;
  return raw.padStart(14, "0");
}

/** Validate a normalized 14-digit GTIN's check digit. */
export function isValidGtin(gtin14: string): boolean {
  if (!/^\d{14}$/.test(gtin14)) return false;
  return gtinCheckDigit(gtin14) === gtin14.charCodeAt(13) - 48;
}

/**
 * Parse a sequence of GS1 Digital Link path segments into structured identity.
 * Accepts segments WITH or WITHOUT a leading "01" AI:
 *   ["01","09506000134376","21","SN1"]  → full AI/value sequence
 *   ["09506000134376","21","SN1"]       → implicit leading 01 (route-prefixed)
 */
export function parseGs1Path(segments: string[]): Gs1Link {
  // Next.js App Router already URL-decodes params.segments, so we must NOT
  // decode again (a serial containing a literal %XX would be corrupted).

  // If the first segment isn't a known AI, assume it's the GTIN value of an
  // implicit primary key 01 (the catch-all route already consumed "/01").
  const pairs: [string, string][] = [];
  let seq = segments;
  if (seq.length > 0 && !KNOWN_AIS.has(seq[0])) {
    seq = ["01", ...seq];
  }
  for (let i = 0; i + 1 < seq.length; i += 2) {
    pairs.push([seq[i], seq[i + 1]]);
  }

  const ais: Record<string, string> = {};
  for (const [ai, value] of pairs) {
    if (KNOWN_AIS.has(ai)) ais[ai] = value;
  }

  const gtinNorm = ais["01"] ? normalizeGtin(ais["01"]) : null;
  return {
    gtin: gtinNorm,
    gtinValid: gtinNorm ? isValidGtin(gtinNorm) : false,
    serial: ais["21"] ?? null,
    batch: ais["10"] ?? null,
    cpv: ais["22"] ?? null,
    ais,
  };
}

/** Build the canonical GS1 Digital Link path for a GTIN (+ optional serial). */
export function buildGs1Path(opts: { gtin: string; serial?: string; batch?: string }): string {
  const gtin = normalizeGtin(opts.gtin);
  if (!gtin) throw new Error(`invalid GTIN: ${opts.gtin}`);
  let path = `/01/${gtin}`;
  if (opts.batch) path += `/10/${encodeURIComponent(opts.batch)}`;
  if (opts.serial) path += `/21/${encodeURIComponent(opts.serial)}`;
  return path;
}
