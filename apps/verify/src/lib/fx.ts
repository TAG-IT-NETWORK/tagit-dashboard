/**
 * THE renderer for the price.fx approximation block (META-T37). Pure and
 * environment-agnostic — no server-only import, no network — so the unit
 * suite can drive it directly.
 *
 * CONTRACT WITH tagit-services: `fx.approx` arrives PRE-FORMATTED, with the
 * currency's exponent already applied by the server — EUR as "66.54", JPY as
 * "12366" with no decimal part. This module therefore never re-formats the
 * digits (no toFixed, no Intl number formatting of the value): it either
 * renders the string AS-IS behind a currency symbol, or refuses to render at
 * all. Re-formatting would silently assert a precision the server did not
 * produce; refusing keeps a malformed upstream value from ever appearing as a
 * price with our name on it.
 *
 * The refusal rule is the invariant the unit test pins: a rendered fx price
 * NEVER carries more fraction digits than the currency allows.
 */
import type { AssetPriceFx } from "./services";

/** ISO-4217-shaped code: exactly three ASCII letters. */
const CURRENCY_CODE_RE = /^[A-Za-z]{3}$/;

/** Plain non-negative decimal, optional fraction part. No signs, no exponent,
 *  no grouping — the services formatter emits nothing else. */
const APPROX_RE = /^\d+(\.\d+)?$/;

/**
 * Fraction digits the currency's minor unit allows (EUR -> 2, JPY -> 0,
 * KWD -> 3), or null when the code is not something Intl can resolve. Null
 * means "cannot verify the precision", and the renderer refuses rather than
 * guessing 2.
 */
export function currencyFractionDigits(currency: string): number | null {
  if (!CURRENCY_CODE_RE.test(currency)) return null;
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits;
    return typeof digits === "number" ? digits : null;
  } catch {
    return null;
  }
}

/**
 * Render `approx` behind the currency's symbol WITHOUT re-formatting the
 * digits: Intl formats a placeholder zero to learn the symbol and its
 * placement for this currency, then the numeric run is replaced verbatim with
 * the server's string. "66.54" + EUR -> "€66.54"; "12366" + JPY -> "¥12366";
 * codes with no narrow symbol fall back to "CHF 66.54"-style output.
 */
function renderAmount(currency: string, approx: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    let out = "";
    let numberEmitted = false;
    for (const part of parts) {
      if (part.type === "currency" || part.type === "literal") {
        out += part.value;
      } else if (!numberEmitted) {
        out += approx;
        numberEmitted = true;
      }
      // Remaining numeric parts of the placeholder (decimal/fraction) are
      // dropped — the server's string is the whole number.
    }
    return numberEmitted ? out : `${currency.toUpperCase()} ${approx}`;
  } catch {
    return `${currency.toUpperCase()} ${approx}`;
  }
}

export interface FxApproxRender {
  /** e.g. "≈ €66.54" — the ≈ marker is part of the rendered text on purpose. */
  text: string;
  /** Spells the approximation out for assistive tech, where "≈" is unreliable. */
  ariaLabel: string;
}

/**
 * Render an fx block, or return null when it must not be shown.
 *
 * Refuses (returns null) when:
 *   - the block is absent,
 *   - the currency code is malformed or unresolvable (precision unverifiable),
 *   - `approx` is not a plain decimal string,
 *   - `approx` carries MORE fraction digits than the currency's minor unit
 *     allows — the served value contradicts the "exponent already applied"
 *     contract, and rendering it would show a price with impossible precision.
 *
 * Fewer fraction digits than the maximum are fine ("66.5", "12366").
 */
export function formatFxApprox(fx: AssetPriceFx | null | undefined): FxApproxRender | null {
  if (!fx) return null;
  const { currency, approx } = fx;
  if (!APPROX_RE.test(approx)) return null;

  const maxDigits = currencyFractionDigits(currency);
  if (maxDigits === null) return null;

  const fraction = approx.split(".")[1] ?? "";
  if (fraction.length > maxDigits) return null;

  const code = currency.toUpperCase();
  return {
    text: `≈ ${renderAmount(code, approx)}`,
    ariaLabel: `Approximately ${approx} ${code}, converted amount — approximate, not the charged price`,
  };
}
