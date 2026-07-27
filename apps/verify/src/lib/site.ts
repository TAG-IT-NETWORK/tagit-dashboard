/**
 * Public identity of verify.tagit.network: its canonical origin, and the exact
 * set of asset pages this host volunteers to crawlers.
 *
 * Both live here rather than inline in app/robots.ts and app/sitemap.ts because
 * they are policy, not plumbing. The origin is asserted by three separate
 * surfaces (canonical link tags, robots.txt's Sitemap: line, sitemap.xml's
 * <loc> entries) and they must not be able to drift apart; the token allowlist
 * is a security decision with a written rationale that has to survive contact
 * with whoever edits it next.
 */

/**
 * THE canonical origin. Hardcoded on purpose — no env var.
 *
 * This follows the same reasoning as CONTRACT_ADDRESS in ./contract.ts: the one
 * time an address on this project was made env-configurable, a wrong value got
 * set in Vercel and shipped silently. The failure mode here is worse than a
 * wrong contract, because it is invisible. A canonical tag or a <loc> pointing
 * at the wrong host does not error — it quietly tells every search engine that
 * the real page lives somewhere else, which is a *stronger* de-indexing signal
 * than having no canonical at all.
 *
 * This is also what `metadataBase` in app/layout.tsx is set to. Without
 * metadataBase, Next resolves the relative `alternates.canonical` values in
 * app/asset/[tokenId]/page.tsx against a fallback origin — `VERCEL_URL` if
 * present, else http://localhost:3000. On a production Vercel deploy VERCEL_URL
 * is the per-deployment hostname (verify-<hash>-<scope>.vercel.app), NOT the
 * production alias, so every asset page would have canonicalised itself onto a
 * throwaway hostname. That is the precise shape of "architecturally correct and
 * completely invisible" this whole task exists to fix, so metadataBase is not
 * optional decoration.
 */
export const SITE_ORIGIN = "https://verify.tagit.network";

/** Absolute URL on this host. Used by sitemap.ts so no <loc> is ever relative. */
export function siteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}

export interface ShowcaseToken {
  /** Decimal token id, as it appears in the /asset/{tokenId} path. */
  tokenId: number;
  /** TAGITCore lifecycle state code, verified on-chain — see header note. */
  state: number;
  /** Human label for `state`, mirroring @/lib/states. Documentation only. */
  stateName: string;
  /**
   * The token's on-chain `timestamp` field at verification time — the moment of
   * its last lifecycle transition, i.e. the last time this page's verdict
   * actually changed. Used verbatim as <lastmod>.
   */
  lastModified: string;
  /** Why this id earned a slot in a deliberately small list. */
  note: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHOWCASE_TOKENS — a DELIBERATE ALLOWLIST. This is not an oversight, and it is
 * not a stub that someone forgot to finish.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TAGITCore.totalSupply() is 52 and ids 1–52 are minted. This list has five
 * entries. That gap is the entire point.
 *
 * WHY NOT ENUMERATE ALL OF THEM
 * ─────────────────────────────
 * SEC-ANVS-001 threat 4 (registry enumeration): iterating token ids dumps the
 * asset registry. Publishing every id in a sitemap does not merely permit that
 * — it hands a crawler the complete index and asks it to fetch each one. The
 * control for threat 4 is a per-asset privacy flag, and that flag DOES NOT
 * EXIST YET.
 *
 * Right now every minted id is demo/testnet stock, so a full dump would leak
 * nothing today. The reason to refuse anyway is that a sitemap is a habit, not
 * a one-off: `for (let i = 1; i <= totalSupply; i++)` is code that keeps
 * working perfectly after the first real customer goods are minted, and on that
 * day it silently becomes a privacy breach with no diff to review and no error
 * to notice. Shipping the curated shape first means the pattern that reaches
 * production is already the safe one.
 *
 * Note that refusing to *advertise* an id is not the same as hiding it. Every
 * /asset/{id} URL is public and returns a real verdict to anyone who asks, as
 * it must — a verifier you have to be allowlisted to query is not a verifier.
 * The claim being made here is narrower and is the only one a sitemap can
 * honestly make: these are the pages we are asking search engines to index.
 * Unminted ids additionally carry `robots: { index: false }` from
 * generateMetadata(), which is what keeps a curious crawler from wandering the
 * unbounded space of ids above totalSupply.
 *
 * HOW TO FLIP TO FULL ENUMERATION LATER — one line, one precondition
 * ─────────────────────────────────────────────────────────────────
 * When the per-asset privacy flag ships, app/sitemap.ts changes from mapping
 * over this constant to mapping over "ids where publiclyListed === true". The
 * precondition is the flag existing, NOT someone deciding the list looks short.
 * Do not widen this array as a substitute for building the flag.
 *
 * WHY THESE FIVE
 * ──────────────
 * A curated set is only worth crawling if it is genuinely illustrative, so each
 * entry demonstrates a DIFFERENT lifecycle state and therefore a different
 * rendered verdict. Between them they cover both hero tones and all three
 * verdict headlines the page can produce ("Authentic" for states 1–4,
 * "Flagged" for 5, "Retired" for 6). Token 5 additionally resolves real product
 * metadata from IPFS, so at least one indexed page shows the fully-populated
 * passport rather than a bare state record.
 *
 * State 2 (BOUND) is knowingly omitted to keep the list at five: it renders
 * identically to the other "Authentic" states and adds no new output shape.
 *
 * VERIFIED ON-CHAIN, NOT ASSUMED — Base Sepolia block 44707803, contract
 * 0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D. Re-check any entry with:
 *
 *   cast call 0x3aDc7EFDb58Ae85483eFf5D4966D916185f31d1D \
 *     "getAsset(uint256)(address,uint64,uint8,uint8,uint16)" <tokenId> \
 *     --rpc-url https://sepolia.base.org
 *
 * The second return value is `timestamp` (→ lastModified) and the third is
 * `state`. If a token has since transitioned, update `state`/`lastModified`
 * here, or drop the id — a <lastmod> that never matches the page's actual
 * verdict trains crawlers to ignore the field.
 */
export const SHOWCASE_TOKENS: readonly ShowcaseToken[] = [
  {
    tokenId: 18,
    state: 1,
    stateName: "MINTED",
    lastModified: "2026-05-13T23:46:48.000Z",
    note: "Digital twin exists, no NFC tag bound yet — the earliest state with a real record.",
  },
  {
    tokenId: 52,
    state: 3,
    stateName: "ACTIVATED",
    lastModified: "2026-07-18T01:27:48.000Z",
    note: "QA-passed and in distribution. The only state that renders the 'tap to buy' island.",
  },
  {
    tokenId: 5,
    state: 4,
    stateName: "CLAIMED",
    lastModified: "2026-05-31T01:25:50.000Z",
    note: "Consumer-owned AND the one token with real IPFS product metadata (PDRN Capsule Cream 100) — the fully-populated passport.",
  },
  {
    tokenId: 35,
    state: 5,
    stateName: "FLAGGED",
    lastModified: "2026-06-06T19:01:04.000Z",
    note: "Lost/stolen/recall investigation. Renders the 'Flagged' warn verdict, not 'Authentic'.",
  },
  {
    tokenId: 1,
    state: 6,
    stateName: "RECYCLED",
    lastModified: "2026-05-26T16:19:34.000Z",
    note: "Terminal end-of-life state. Renders the 'Retired' warn verdict.",
  },
];
