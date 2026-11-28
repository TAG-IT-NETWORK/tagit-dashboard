import "server-only";

/**
 * Where the shopper is, as far as a brand is ever told (TAP-T18): the
 * country, two letters, as our host works it out for the request. Null when
 * the host sent none or something that is not a country code.
 *
 * This is the ONLY thing about the shopper that goes with a tap into the
 * brand's numbers. The IP address it was worked out from is never read here,
 * never sent on and never stored.
 */
export const TAP_COUNTRY_HEADER = "x-vercel-ip-country";

export function tapCountryOf(headers: Pick<Headers, "get">): string | null {
  const code = headers.get(TAP_COUNTRY_HEADER)?.trim().toUpperCase() ?? "";
  // "XX" is the host's word for "unknown".
  if (!/^[A-Z]{2}$/.test(code) || code === "XX") return null;
  return code;
}
