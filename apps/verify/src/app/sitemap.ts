/**
 * /sitemap.xml for verify.tagit.network (Next generates the file from this).
 *
 * This is the inbound discovery path. Nothing on the public internet links to
 * this host — zero <a href> anchors across all 30 pages of the www sitemap — so
 * a crawler has no way to walk here. Declaring this sitemap in robots.txt and
 * submitting it in Search Console is what replaces the missing links.
 *
 * CURATED, NOT ENUMERATED — read the rationale on SHOWCASE_TOKENS in
 * @/lib/site before adding ids. The short version: totalSupply() is 52, this
 * lists 5, and that gap is a deliberate control for SEC-ANVS-001 threat 4
 * (registry enumeration) whose real mitigation — a per-asset privacy flag — is
 * not built yet. Do not replace this with a loop over totalSupply().
 *
 * WHAT IS DELIBERATELY ABSENT
 * ───────────────────────────
 *   • Tap routes (/sun, /01/…). They need a physical NTAG 424 DNA cryptogram;
 *     a crawler fetching one gets a 400 and burns an uncached RPC read. They
 *     are Disallow:'d in robots.ts for that same cost reason.
 *   • /api/* — including /api/asset/{id}, which robots.ts explicitly ALLOWS.
 *     Allowing and listing are different asks: robots.txt governs fetching, a
 *     sitemap requests *indexing*, and a JSON document has nothing to index.
 *     The API is for agents that call it directly, not for a search index.
 *   • /tag/{uid} — a 307 to /asset/{id}. Sitemaps should list destinations,
 *     never redirects.
 *   • Unminted ids. They render a truthful "No Record" page that also carries
 *     `robots: { index: false }` from generateMetadata(); listing an id we
 *     simultaneously ask not to index is a self-contradicting sitemap.
 *
 * NO CHAIN READ HAPPENS HERE, ON PURPOSE. It is tempting to fetch each token's
 * live state at build time to derive <lastmod>. That would make `next build`
 * depend on a reachable RPC endpoint, and @/lib/contract.server throws in
 * production when BASE_SEPOLIA_RPC_URL is unset — a throw deliberately placed
 * at call time precisely so the build does NOT require the capped key. Reading
 * the chain from this file would convert that documented property into a build
 * failure. The verified timestamps are therefore checked in as data in
 * @/lib/site, alongside the cast command to re-verify them.
 */
import type { MetadataRoute } from "next";
import { SHOWCASE_TOKENS, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl("/"),
      // The home page is a static token-id lookup form; its content changes
      // only when this app is redeployed.
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...SHOWCASE_TOKENS.map((token) => ({
      url: siteUrl(`/asset/${token.tokenId}`),
      // The token's last on-chain lifecycle transition — literally the last
      // time this page's verdict changed. See @/lib/site.
      lastModified: new Date(token.lastModified),
      // Lifecycle transitions are human-paced and rare: a claimed or recycled
      // asset may never change again. "weekly" over-reports slightly, which is
      // the right direction — it keeps the verdict fresh in the index without
      // claiming the daily churn of a news page.
      changeFrequency: "weekly" as const,
      // Below the home page, equal to each other. These are five siblings
      // demonstrating five lifecycle states; ranking them against one another
      // would assert a preference that does not exist.
      priority: 0.8,
    })),
  ];
}
