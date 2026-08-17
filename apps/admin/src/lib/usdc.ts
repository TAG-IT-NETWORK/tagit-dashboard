/**
 * Client-side mirror of tagit-services' parseUsdcString validation
 * (src/lib/currency.ts). The REGEX IS COPIED VERBATIM from the server — the
 * server remains the enforcement point (PRICE_TOO_PRECISE → 400); this mirror
 * only gives the mint form instant feedback with identical accept/reject
 * behavior: a plain decimal string, up to 12 integer digits, at most 6
 * decimals, no signs / exponents / leading zeros.
 */
export const USDC_STRING_RE = /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/;

export function isValidUsdcString(s: string): boolean {
  return USDC_STRING_RE.test(s);
}

/**
 * Mirror of the server's parse: "22.5" → "22500000" (usdc-6 minor units, as a
 * string — no floats anywhere). Returns null for anything the regex rejects.
 */
export function usdcStringToUnits(s: string): string | null {
  const match = USDC_STRING_RE.exec(s);
  if (!match) return null;
  const whole = match[1] as string;
  const fraction = (match[2] ?? ".").slice(1).padEnd(6, "0");
  return BigInt(whole + fraction).toString();
}
