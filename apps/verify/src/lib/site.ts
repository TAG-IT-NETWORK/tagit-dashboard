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

/*
 * META-T17: the SHOWCASE_TOKENS allowlist (hardcoded states + timestamps) is
 * GONE. sitemap.ts now derives its entries from the tagit-services API — only
 * tokens the API reports as public AND anchored are listed, which is the
 * per-asset privacy control (SEC-ANVS-001 threat 4) the old curated list was
 * standing in for. See fetchPublicSitemapEntries in @/lib/services.
 */
