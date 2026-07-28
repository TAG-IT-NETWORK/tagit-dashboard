/**
 * Neutralisation of supplier-supplied ("untrusted") text before it is handed to
 * a machine reader.
 *
 * THREAT (SEC-ANVS-001 P1.3). Every product field we serve — name, brand,
 * description, sku, origin, size, image — originates off-chain from whoever
 * minted the token. Anyone who can mint can write arbitrary bytes there. Two
 * distinct abuses follow:
 *
 *   1. PROMPT INJECTION. An AI agent that reads /api/asset/<id> and passes the
 *      product name into a model sees supplier text in the same channel as its
 *      own instructions. Stripping bytes cannot solve that — only the
 *      `untrusted` envelope and its `_warning` can, by keeping the provenance
 *      boundary explicit. This file does NOT claim to stop prompt injection.
 *
 *   2. TERMINAL / RENDERER SPOOFING — which this file DOES stop. A field
 *      containing ANSI CSI sequences repaints a curl-to-terminal reader's
 *      screen (colour, cursor movement, erase-line) and can overwrite a
 *      "COUNTERFEIT" verdict that was already printed above it. Bidi overrides
 *      (U+202E and friends) visually reverse a run of text so a displayed brand
 *      or origin reads as something other than the bytes it contains — the same
 *      trick as the Trojan Source source-code attack. Zero-width characters
 *      defeat string equality, letting two visually identical brand names be
 *      different values. C0 controls smuggle newlines into log lines, which is
 *      how a log-injection forgery of a second, fake verdict record starts.
 *      INVISIBLE CARRIERS — the Unicode TAG block (U+E0000–E007F), word joiner,
 *      soft hyphen, Hangul filler — are the same class of problem: they render
 *      as nothing, so a field that a human reviewer reads as "Nike" can carry an
 *      arbitrary hidden payload that a model consuming this JSON still sees.
 *      Stripping them does not make the field trustworthy (see 1); it makes what
 *      a reviewer sees the same as what a consumer gets.
 *
 * The transform is deliberately lossy: for a verification API, dropping bytes we
 * cannot render unambiguously beats faithfully reproducing an attacker's
 * control codes.
 *
 * IMPLEMENTATION NOTE — why a hand-rolled scanner and not a regex. Writing the
 * character classes as regex literals puts the very bytes we are removing into
 * the source of the remover, and a control character that survives an editor or
 * tooling round-trip into THIS file is precisely the failure this module exists
 * to prevent (it happened once while writing it). Every
 * boundary below is written as a numeric codepoint so the file itself contains
 * no character it is meant to remove, and so the rule set is greppable.
 *
 * Placed in @/lib rather than inline in the route so the DPP endpoint
 * (src/app/api/dpp/[...segments]/route.ts), which serves the same
 * supplier-supplied fields inside a Verifiable Credential, can adopt it without
 * a second implementation drifting out of sync.
 */

const CP = {
  TAB: 0x09,
  LF: 0x0a,
  CR: 0x0d,
  ESC: 0x1b,
  BEL: 0x07,
  C0_MAX: 0x1f,
  DEL: 0x7f,
  C1_MAX: 0x9f,
  SOFT_HYPHEN: 0x00ad, // invisible unless a renderer breaks the line there
  MONGOLIAN_VOWEL_SEP: 0x180e, // zero-width in modern Unicode
  ZERO_WIDTH_MIN: 0x200b, // ZWSP, ZWNJ, ZWJ, LRM, RLM
  ZERO_WIDTH_MAX: 0x200f,
  BIDI_OVERRIDE_MIN: 0x202a, // LRE, RLE, PDF, LRO, RLO
  BIDI_OVERRIDE_MAX: 0x202e,
  INVISIBLE_OP_MIN: 0x2060, // WORD JOINER + INVISIBLE TIMES/SEPARATOR/PLUS
  INVISIBLE_OP_MAX: 0x2064,
  BIDI_ISOLATE_MIN: 0x2066, // LRI, RLI, FSI, PDI
  BIDI_ISOLATE_MAX: 0x2069,
  HANGUL_FILLER: 0x3164, // renders as blank, is NOT whitespace
  BOM: 0xfeff, // ZWNBSP when it appears mid-string
  HALFWIDTH_HANGUL_FILLER: 0xffa0,
  // Unicode TAG block. Every codepoint here is invisible in every renderer, and
  // the block is the standard carrier for "ASCII smuggling": ordinary text is
  // re-encoded one tag character per ASCII byte, so a product name can carry a
  // complete instruction payload that a human reviewer — and a `grep` for
  // suspicious words — cannot see, while a model reading the JSON still gets it.
  // Deprecated for language tagging since Unicode 5.1 and unused in product copy,
  // so dropping the whole block costs nothing legitimate.
  TAG_MIN: 0xe0000,
  TAG_MAX: 0xe007f,
} as const;

/** Per-field ceilings. A verification record is not a CMS: very long free text
 *  is either a mistake or an attempt to flood a downstream context window. */
export const MAX_SHORT_FIELD = 200;
export const MAX_DESCRIPTION = 1000;
export const MAX_URL = 512;

/**
 * NOT dropped, deliberately: variation selectors (U+FE00–FE0F). They are also an
 * invisible smuggling channel, but VS16 is load-bearing for ordinary emoji
 * rendering and a product name may legitimately contain one. The `untrusted`
 * envelope, not this list, is what protects a model from what it reads.
 *
 * U+2028/U+2029 are not listed either: they are JS `\s`, so the whitespace
 * collapse below already turns them into a single space.
 */
function isDroppedCodepoint(cp: number): boolean {
  if (cp <= CP.C0_MAX) return true; // C0 (TAB/LF/CR are handled before this)
  if (cp >= CP.DEL && cp <= CP.C1_MAX) return true; // DEL + C1
  if (cp === CP.SOFT_HYPHEN) return true;
  if (cp === CP.MONGOLIAN_VOWEL_SEP) return true;
  if (cp >= CP.ZERO_WIDTH_MIN && cp <= CP.ZERO_WIDTH_MAX) return true;
  if (cp >= CP.BIDI_OVERRIDE_MIN && cp <= CP.BIDI_OVERRIDE_MAX) return true;
  if (cp >= CP.INVISIBLE_OP_MIN && cp <= CP.INVISIBLE_OP_MAX) return true;
  if (cp >= CP.BIDI_ISOLATE_MIN && cp <= CP.BIDI_ISOLATE_MAX) return true;
  if (cp === CP.HANGUL_FILLER || cp === CP.HALFWIDTH_HANGUL_FILLER) return true;
  if (cp === CP.BOM) return true;
  if (cp >= CP.TAG_MIN && cp <= CP.TAG_MAX) return true;
  return false;
}

/**
 * Consume one escape sequence starting at `i` (which must point at ESC) and
 * return the index just past it. Recognises the three forms that carry a
 * payload a terminal will act on:
 *   CSI  ESC [ <params> <final 0x40-0x7E>   colour / cursor / erase
 *   OSC  ESC ] <text> (BEL | ESC \)         window title, hyperlink smuggling
 *   two-character escapes                   ESC c full reset, ESC 7/8 cursor
 *
 * Dropping the WHOLE sequence matters: removing only the ESC would leave the
 * readable remainder ("[31mAUTHENTIC") behind as literal text.
 */
function skipEscapeSequence(input: string, i: number): number {
  const next = input.charCodeAt(i + 1);
  if (Number.isNaN(next)) return i + 1; // trailing lone ESC

  // CSI: parameter bytes 0x30-0x3F, intermediate 0x20-0x2F, final 0x40-0x7E.
  if (next === 0x5b /* [ */) {
    let j = i + 2;
    while (j < input.length) {
      const c = input.charCodeAt(j);
      if (c >= 0x40 && c <= 0x7e) return j + 1;
      j++;
    }
    return input.length; // unterminated CSI: drop the rest
  }

  // OSC: runs until BEL or the ESC \ string terminator.
  if (next === 0x5d /* ] */) {
    let j = i + 2;
    while (j < input.length) {
      const c = input.charCodeAt(j);
      if (c === CP.BEL) return j + 1;
      if (c === CP.ESC && input.charCodeAt(j + 1) === 0x5c /* \ */) return j + 2;
      j++;
    }
    return input.length; // unterminated OSC: drop the rest
  }

  return i + 2; // ESC + one more byte
}

/**
 * Strip escape sequences, control characters, zero-width characters and bidi
 * overrides; collapse runs of whitespace; trim; truncate.
 *
 * TAB/LF/CR become a single space rather than vanishing, so "line one\nline
 * two" does not fuse into "line oneline two".
 *
 * Returns null for anything that is not a non-empty string after cleaning, so a
 * field that was pure control bytes disappears instead of surfacing as "".
 */
export function sanitizeUntrustedText(value: unknown, maxLength = MAX_SHORT_FIELD): string | null {
  if (typeof value !== "string") return null;

  let out = "";
  let i = 0;
  while (i < value.length) {
    const cp = value.codePointAt(i)!;
    const width = cp > 0xffff ? 2 : 1;

    if (cp === CP.ESC) {
      i = skipEscapeSequence(value, i);
      continue;
    }
    if (cp === CP.TAB || cp === CP.LF || cp === CP.CR) {
      out += " ";
      i += width;
      continue;
    }
    if (isDroppedCodepoint(cp)) {
      i += width;
      continue;
    }
    out += String.fromCodePoint(cp);
    i += width;
  }

  const cleaned = out.replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Schemes we are willing to echo back. `javascript:`, `data:`, `vbscript:` and
 *  `file:` are the ones that turn an echoed image URL into a client-side
 *  exploit or an SSRF pivot in whatever consumes this JSON. */
const ALLOWED_URL_SCHEMES = new Set(["https:", "http:", "ipfs:"]);

/**
 * Same cleaning as text, plus a scheme allowlist. This validates the URL STRING
 * only — we never dereference it here, and neither should a caller without its
 * own SSRF guard (see safeMetaSource in @/lib/dpp for the version used when
 * this server does fetch).
 */
export function sanitizeUntrustedUrl(value: unknown, maxLength = MAX_URL): string | null {
  const text = sanitizeUntrustedText(value, maxLength);
  if (!text) return null;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }
  if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) return null;
  return text;
}
