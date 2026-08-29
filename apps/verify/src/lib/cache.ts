/**
 * Cost containment for verify.tagit.network.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Every route on this host used to be `export const dynamic = "force-dynamic"`.
 * Nothing was cached, so every crawler hit was a full serverless invocation plus
 * a live JSON-RPC read. That is exactly the shape that produced the Vercel
 * 20M-request overbilling incident on this project. Now that /asset/[tokenId] is
 * server-rendered (and therefore actually worth crawling), an unbounded read path
 * would recreate it at a much higher hit rate.
 *
 * THE CORRECTNESS BOUNDARY — READ BEFORE YOU "OPTIMISE" ANYTHING
 * ─────────────────────────────────────────────────────────────
 * There are two categories of route here and they are NOT interchangeable.
 *
 *   1. TAP ROUTES — /sun, /01/[...segments], /api/verify, /api/dpp/[...segments]
 *
 *      These verify an NTAG 424 DNA SUN cryptogram. The chip rewrites `picc` and
 *      `cmac` on every physical tap and the decrypted PICC carries a MONOTONIC
 *      TAP COUNTER. The counter is the entire anti-replay mechanism: a verdict is
 *      only meaningful for the exact tap that produced it.
 *
 *      Caching a tap verdict breaks the security model. A cached 200 "authentic"
 *      keyed on ?picc=…&cmac=… would let an attacker who captured one legitimate
 *      tap URL replay it and receive a fresh-looking "authentic" from the CDN
 *      without the request ever reaching the verifier — the counter would never
 *      be re-evaluated. That converts a one-shot captured cryptogram into an
 *      unlimited authenticity oracle.
 *
 *      Their existing `dynamic = "force-dynamic"` declarations and
 *      "always re-verify; never cache" comments are CORRECT. Do not add TTLs,
 *      `revalidate`, `s-maxage`, or middleware cache headers to those paths.
 *      If you are here because tap routes look "uncached and expensive": that is
 *      intentional and it is the price of the security property.
 *
 *   2. TOKEN-ID READS — /asset/[tokenId] (and any future /api/asset/[tokenId])
 *
 *      Pure on-chain state lookups keyed only by a public token id. No secret,
 *      no nonce, no counter, no cryptographic freshness requirement — the answer
 *      is a function of the token id and the chain head. Lifecycle transitions
 *      (MINTED → BOUND → ACTIVATED → CLAIMED) are human-paced and rare, so a
 *      short shared cache is both safe and the single highest-leverage cost
 *      control on this host. This is the ONLY cacheable surface.
 *
 * PRIMARY CONTROL. The Full Route Cache on /asset/[tokenId] is the primary cost
 * control: it collapses N bot hits on the same token into one origin render per
 * TTL. The rate limiter in src/middleware.ts is defence-in-depth only (see the
 * honesty note in that file), and the real hard ceiling is a spend-capped RPC
 * key, which is human-provisioned (task S0.2) and cannot be enforced here.
 *
 * WHERE THE WIRE HEADER COMES FROM — AND WHY NOT FROM MIDDLEWARE
 * ─────────────────────────────────────────────────────────────
 * `CHAIN_READ_TTL_SECONDS` feeds `export const revalidate` in
 * src/app/asset/[tokenId]/page.tsx. Next turns that into
 * `Cache-Control: s-maxage=60, stale-while-revalidate` on the wire, and it does
 * so ONLY for a cacheable 200 render.
 *
 * That status-awareness is the whole point. Middleware runs before the handler
 * and cannot see the status it decorates, so a hand-built `public, s-maxage=60,
 * stale-while-revalidate=300` set there also lands on 4xx and 5xx — measured: a
 * 500 from an SSR throw went out carrying it, and RFC 9111 §4.2.1 lets a shared
 * cache store and stale-serve that for up to 360s. Do not reintroduce a
 * hand-built cache header for this route from middleware, `next.config.js`
 * `headers()`, or anywhere else that cannot branch on the response status.
 */

/** Lifecycle state changes are human-paced; 60s of staleness is invisible to a
 *  reader and collapses a crawl burst into a single origin render per token.
 *  Consumed by `export const revalidate` in src/app/asset/[tokenId]/page.tsx. */
export const CHAIN_READ_TTL_SECONDS = 60;

/**
 * `no-store` for anything that must be re-evaluated on every request — the tap
 * routes. Exported so the intent is explicit and greppable rather than implied
 * by the absence of a cache header. Safe to set unconditionally: refusing to
 * store a response is never wrong for a given status, which is exactly why this
 * one may be asserted from middleware and a positive TTL may not.
 */
export function neverCacheControl(): string {
  return "no-store, no-cache, must-revalidate";
}

/**
 * Path predicate for the cacheable surface. Middleware and any future route
 * helper share this so the cacheable set is defined exactly once and cannot
 * drift into covering a tap route by accident.
 *
 * Matches:  /asset/<tokenId>   /api/asset/<tokenId>
 * Excludes: /sun  /01/…  /api/verify  /api/dpp/…  (tap routes — never cached)
 * Excludes: /mcp — see isRateLimitedPath below. It is POST JSON-RPC and is NOT
 *           cacheable by anything; being rate-limited is not the same property
 *           as being cacheable, which is why these are two predicates and not
 *           one with a widened regex.
 */
export function isCacheableReadPath(pathname: string): boolean {
  return /^\/(api\/)?asset\/[^/]+\/?$/.test(pathname);
}

/** The MCP Streamable HTTP endpoint. One constant so the middleware matcher,
 *  this predicate and robots.txt cannot drift apart. */
export const MCP_PATH = "/mcp";

/**
 * Paths the per-IP limiter guards.
 *
 * A SUPERSET of the cacheable surface, and that asymmetry is the point. /mcp
 * cannot be cached — shared caches do not store POST responses — so for that
 * path the limiter is not defence-in-depth behind a cache, it is the ONLY
 * request-side control there is. That makes rate limiting it more important
 * than rate limiting the routes that already have a cache in front of them,
 * not less.
 *
 * The tap routes remain excluded here for the reason given in src/middleware.ts:
 * a 429 on a physical tap is a broken product. Someone standing in a shop
 * tapping a chip must always reach the verifier.
 */
export function isRateLimitedPath(pathname: string): boolean {
  if (isCacheableReadPath(pathname)) return true;
  // The provenance-timeline read (DASH-T37-SUSPENSE-ISR). Public token-id
  // surface like the verdict read — and its origin cost on a cache miss is an
  // eth_getLogs history scan (up to MAX_LOG_REQUESTS RPC calls, see
  // @/lib/lifecycle), the most expensive read on this host — so it shares the
  // per-IP "asset" budget. Already inside the middleware matcher via
  // /api/asset/:path*; this predicate is what actually arms the limiter.
  if (/^\/api\/asset\/[^/]+\/provenance\/?$/.test(pathname)) return true;
  return pathname === MCP_PATH || pathname === `${MCP_PATH}/`;
}
