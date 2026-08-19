/**
 * /sitemap.xml for verify.tagit.network (Next generates the file from this).
 *
 * META-T17: entries come from the tagit-services API, NOT a hardcoded list of
 * verdicts. Only tokens the API reports as PUBLIC and ANCHORED are listed —
 * restricted items and unanchored drafts never reach the sitemap, which is
 * the per-asset privacy control SEC-ANVS-001 threat 4 asked for.
 *
 * Source order (see fetchPublicSitemapEntries in @/lib/services):
 *   1. GET {SERVICES_URL}/api/v1/assets/public — the dedicated public list.
 *   2. Until that endpoint ships: the curated candidate ids below are probed
 *      through the detail API and filtered to public+anchored. The candidate
 *      list is ids only — no states, no timestamps, no verdicts; all of that
 *      now comes from the API at request time.
 *
 * A services outage degrades to the home page alone rather than failing the
 * route — a missing sitemap entry is recoverable, a 500 sitemap is not.
 *
 * WHAT IS DELIBERATELY ABSENT (unchanged from the pre-cutover rationale):
 *   • Tap routes (/sun, /01/…) — need a physical NTAG 424 DNA cryptogram.
 *   • /api/* — robots.txt governs fetching; a sitemap requests indexing, and
 *     a JSON document has nothing to index.
 *   • /tag/{uid} — a 307; sitemaps list destinations, never redirects.
 *   • Unminted/restricted ids — they render noindex pages.
 */
import type { MetadataRoute } from "next";
import { fetchPublicSitemapEntries } from "@/lib/services";
import { siteUrl } from "@/lib/site";

/** Regenerate hourly at runtime so new anchored tokens appear without a deploy. */
export const revalidate = 3600;

/**
 * Candidate ids for the probe fallback — IDS ONLY. Everything else about them
 * (visibility, anchor state, lastmod) is resolved from the services API at
 * request time. Kept deliberately small until /api/v1/assets/public ships;
 * do not grow this as a substitute for that endpoint.
 */
const CANDIDATE_TOKEN_IDS = ["1", "5", "18", "19", "20", "35", "52"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let entries: Awaited<ReturnType<typeof fetchPublicSitemapEntries>> = [];
  try {
    entries = await fetchPublicSitemapEntries(CANDIDATE_TOKEN_IDS);
  } catch {
    entries = [];
  }

  return [
    {
      url: siteUrl("/"),
      // The home page is a static token-id lookup form; its content changes
      // only when this app is redeployed.
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...entries.map((entry) => ({
      url: siteUrl(`/asset/${entry.tokenId}`),
      lastModified: entry.lastModified,
      // Lifecycle/metadata transitions are human-paced and rare; "weekly"
      // over-reports slightly, which is the right direction.
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
