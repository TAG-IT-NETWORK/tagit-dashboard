/**
 * /robots.txt for verify.tagit.network (Next generates the file from this).
 *
 * WHY THIS FILE EXISTS — AND WHAT IT DOES NOT FIX
 * ──────────────────────────────────────────────
 * Until now this host had no public/ directory and no robots.txt: /robots.txt
 * 404'd. Absence of robots.txt means crawling is default-ALLOWED, so nothing was
 * ever blocked. The host returns zero results on an exact-string search for a
 * different reason entirely — NOTHING LINKS TO IT. Zero <a href> anchors point
 * here across all 30 pages of the www.tagit.network sitemap, and crawlers reach
 * pages by following links.
 *
 * So be honest about what shipping this buys: the `Sitemap:` line below is the
 * one mechanism here that creates an inbound discovery path where no link
 * exists. The allow/disallow rules are hygiene, not discovery. This file makes
 * the host *crawlable on purpose*; getting it *crawled* still needs the sitemap
 * submitted in Search Console and, ideally, real links from www.
 *
 * WHY THIS LIVES ON THIS HOST AND NOT ON www — THE CROSS-HOST RULE
 * ───────────────────────────────────────────────────────────────
 * A sitemap may only list URLs under its own host. Adding verify.tagit.network
 * URLs to www.tagit.network/sitemap.xml DOES NOT WORK: cross-host entries are
 * ignored unless every host involved is verified together in one Search Console
 * property set. verify.tagit.network is a distinct origin and therefore needs
 * its OWN robots.txt declaring its OWN sitemap. That is why this file is in
 * apps/verify and not in the tagit-website repo. Do not "consolidate" it there.
 */
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Routes that are crawl-reachable but must not be crawled.
 *
 * NOT A SECRECY MEASURE — every one of these is already unreachable to a bot.
 * /sun, /01/…, /api/verify and /api/dpp/… all require a `picc`+`cmac` SUN
 * cryptogram produced by physically tapping an NTAG 424 DNA chip. No crawler
 * can fabricate one, so no crawler can ever obtain a verdict from them. Nothing
 * is being hidden here and nothing here is load-bearing for security.
 *
 * THE REASON IS COST, AND IT IS A REAL ONE. These routes are all
 * `export const dynamic = "force-dynamic"` and are deliberately excluded from
 * the middleware cache matcher (see the boundary note in @/lib/cache.ts — a
 * cached tap verdict would turn one captured cryptogram into an unlimited
 * authenticity oracle, so they must never be cached). A bot walking them
 * therefore burns an uncached serverless invocation and an uncached JSON-RPC
 * read *per hit*, and is handed a 400 for its trouble. That is the exact
 * request shape behind this project's Vercel overbilling incident: unbounded
 * uncacheable requests against a live RPC endpoint.
 *
 * DO NOT "FIX" THIS by deleting these lines because the routes look harmless,
 * and DO NOT fix it by making the tap routes cacheable instead. Both moves have
 * been considered and rejected; the second one breaks the anti-replay property.
 *
 * /api/buy is disallowed on the same cost logic plus one more: it is a POST
 * settlement proxy into tagit-services that moves ownership on-chain. There is
 * no version of a crawler touching it that is useful to anyone.
 */
const TAP_GATED_AND_WRITE_ROUTES = [
  "/sun", // legacy SUN carrier — needs ?picc=&cmac=
  "/01/", // GS1 Digital Link resolver — same cryptogram requirement
  "/api/verify", // SUN attestation JSON — the moat; never agent-reachable
  "/api/dpp/", // DPP verifiable credential — tap-gated like /api/verify
  "/api/buy", // POST settlement proxy — write path, never crawlable
];

/**
 * The crawlable surface: the home page, the SSR verdict pages, and the free
 * public JSON read.
 *
 * /api/asset/ is ALLOWED even though JSON is not itself indexable content. It
 * is the assertion half of this host (see the docstring on
 * app/api/asset/[tokenId]/route.ts): keyless, CORS-open, cacheable public
 * chain data, built specifically so agents and answer engines can call it.
 * Blocking it in robots.txt while advertising it as an open API would be
 * incoherent. It is allowed here but deliberately NOT listed in sitemap.xml —
 * a sitemap is a request to *index*, and there is nothing to index in a JSON
 * document.
 */
const CRAWLABLE = ["/", "/asset/", "/api/asset/"];

/**
 * AI crawlers, named explicitly.
 *
 * BE CLEAR THAT THIS UNLOCKS NOTHING. Every agent below already receives 200s
 * under `User-agent: *` — the wildcard group grants them exactly these rules,
 * and this host has never blocked them. Enumerating them changes no bot's
 * behaviour by a single request.
 *
 * The value is governance, not access. TAG IT's product thesis is that an AI
 * shopping agent, a marketplace fraud filter or a customs system should be able
 * to ask "what is the on-chain state of token 50?" and get a straight answer.
 * Leaving that to the default means it holds only until someone pastes in a
 * boilerplate AI-blocking robots.txt and silently severs it. Naming these
 * agents makes the permission an explicit, reviewable, greppable decision that
 * a future edit has to argue with rather than a side effect of omission.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  /**
   * Preview deployments must not be indexed.
   *
   * robots.ts is served by every deployment of this app, including Vercel
   * preview builds on *.vercel.app. A preview that says "crawl me" is a
   * duplicate of production on a different origin — the classic way a staging
   * host outranks, or cannibalises, the real one. Production is the only
   * deployment that advertises anything.
   *
   * EVALUATED AT BUILD TIME, NOT PER REQUEST — this trips people up. This route
   * has no dynamic inputs, so Next prerenders it as a static file (confirmed in
   * the build output: `○ /robots.txt`). `process.env.VERCEL_ENV` is therefore
   * read once by `next build`, and the resulting bytes are what every request
   * gets. That is correct on Vercel, where VERCEL_ENV is a build-time variable
   * set per deployment.
   *
   * The consequence is that `VERCEL_ENV=preview next start` against a
   * production build does NOT reproduce this branch — the file was already
   * baked. Verify it the way it actually works instead:
   *
   *   VERCEL_ENV=preview npx next build && cat .next/server/app/robots.txt.body
   *   → "User-Agent: *  /  Disallow: /"      (measured)
   *
   * If you test it the wrong way, see the full allow rules, and conclude this
   * block is dead code — it is not. Do not delete it.
   *
   * Fails safe: VERCEL_ENV is unset outside Vercel (local `next build`, CI),
   * which takes the production branch. That is intentional, so the rules below
   * are the ones exercised by the normal curl gate.
   */
  if (process.env.VERCEL_ENV === "preview") {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: CRAWLABLE,
        disallow: TAP_GATED_AND_WRITE_ROUTES,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: CRAWLABLE,
        disallow: TAP_GATED_AND_WRITE_ROUTES,
      })),
    ],
    // The load-bearing line: the only inbound discovery path this host has
    // until something actually links to it. Must be absolute, and must be on
    // this origin — see the cross-host rule in the header.
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
