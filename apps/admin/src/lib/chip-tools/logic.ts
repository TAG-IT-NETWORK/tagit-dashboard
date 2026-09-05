import type { NdefRecordDTO, ReadNdefResult, SunDecodeDTO } from "@/lib/nfc-bridge-protocol";

/** Pure helpers for the Chip Tools page (unit-tested). */

export interface UrlValidation {
  url: string | null;
  error: string | null;
}

/**
 * Accept only absolute https URLs. `allowQuery` false rejects a query string —
 * the SDM base URL must be bare because the chip appends ?picc=&cmac= itself.
 */
export function validateHttpsUrl(input: string, options: { allowQuery?: boolean } = {}): UrlValidation {
  const raw = input.trim();
  if (!raw) return { url: null, error: "enter a URL" };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: null, error: "not a valid absolute URL" };
  }
  if (parsed.protocol !== "https:") return { url: null, error: "must start with https://" };
  if (!options.allowQuery && (parsed.search || parsed.hash)) {
    return { url: null, error: "no query string or #fragment — the chip appends its own ?picc=&cmac=" };
  }
  return { url: parsed.toString(), error: null };
}

/** A single URI record — what write-ndef gets for a plain URL. */
export function buildUrlRecords(url: string): NdefRecordDTO[] {
  return [{ recordType: "url", data: url }];
}

export interface DecodedChip {
  records: NdefRecordDTO[];
  sun: SunDecodeDTO | null;
  sunError: string | null;
  /** First URL record, if any. */
  url: string | null;
}

/** Tolerant view over a read-ndef result. */
export function decodeReadResult(result: unknown): DecodedChip {
  const env = result as Partial<ReadNdefResult> | null;
  const records = Array.isArray(env?.records)
    ? (env!.records as NdefRecordDTO[]).filter((r) => r && typeof r.recordType === "string" && typeof r.data === "string")
    : [];
  const sun = env?.sun && typeof env.sun === "object" ? (env.sun as SunDecodeDTO) : null;
  return {
    records,
    sun,
    sunError: typeof env?.sunError === "string" ? env.sunError : null,
    url: records.find((r) => r.recordType === "url")?.data ?? null,
  };
}

/** Bytes a URL record costs on the chip (NLEN + header + type + id code + body without the https:// prefix). */
export function estimateUrlBytes(url: string): number {
  const body = url.startsWith("https://www.") ? url.slice(12) : url.startsWith("https://") ? url.slice(8) : url;
  return 2 + 3 + 1 + 1 + Buffer.byteLength(body, "utf8");
}
