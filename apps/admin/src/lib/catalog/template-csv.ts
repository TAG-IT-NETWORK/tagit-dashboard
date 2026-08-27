/**
 * CSV-safe rendering of user-controlled strings (META-T33 Items export).
 *
 * Template/item names, SKUs etc. are untrusted free text (REQ-S-11): a value
 * like `=HYPERLINK(...)` must not execute when the export is opened in a
 * spreadsheet. Mirrors the neutralization stance of the services batch
 * export (formula-leading cells get a leading apostrophe) plus RFC-4180
 * quoting.
 */

import type { TemplateItemRow } from "./template-types";

const FORMULA_LEAD = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** Neutralize + quote one cell. Always safe to embed between commas. */
export function csvEscapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (s.length > 0 && FORMULA_LEAD.has(s[0])) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const ITEMS_CSV_HEADER = [
  "tokenId",
  "name",
  "serial",
  "lifecycle",
  "templateVersion",
  "anchorStatus",
  "anchoredVersion",
  "latestVersion",
  "verifyUrl",
] as const;

/** Items-table export: one line per enumerated row, CRLF-joined per RFC 4180. */
export function buildItemsCsv(rows: TemplateItemRow[], verifyBaseUrl: string): string {
  const lines = [ITEMS_CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvEscapeCell(row.tokenId),
        csvEscapeCell(row.name),
        csvEscapeCell(row.serial),
        csvEscapeCell(row.lifecycle),
        csvEscapeCell(row.templateVersion),
        csvEscapeCell(row.anchorStatus),
        csvEscapeCell(row.anchoredVersion),
        csvEscapeCell(row.latestVersion),
        csvEscapeCell(`${verifyBaseUrl}/asset/${row.tokenId}`),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}
