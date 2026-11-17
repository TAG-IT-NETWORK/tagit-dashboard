/**
 * Cost containment at the edge for the token-id read path.
 *
 * SCOPE — deliberately narrow. The limiter covers /asset/<tokenId> and
 * /api/asset/<tokenId> (pure on-chain state lookups with no cryptographic
 * freshness requirement) plus /mcp.
 *
 * WHY /mcp IS HERE AND WHY ITS BUDGET IS DIFFERENT. It is the one path on this
 * host where the limiter is the ONLY request-side control rather than
 * defence-in-depth. /mcp is POST JSON-RPC, shared caches do not store POST
 * responses, so the 60s edge cache that absorbs bursts on /api/asset does not
 * and cannot apply — every single request reaches the origin and spends at
 * least the two chain reads a verdict costs. It therefore gets its own tighter
 * budget (MCP_RATE_LIMIT) in its own counter bucket, so agent traffic and
 * browser traffic cannot 429 each other. See @/lib/rate-limit.
 *
 * The SUN tap routes (/sun, /01/…, /api/verify, /api/dpp/…) are matched for ONE
 * thing only: the device id that lets a phone reopen its own check for a few
 * minutes (TAP-T10, see `withTapDevice` below and @/lib/tap-device-cookie).
 * They return before the limiter is ever reached, and MUST STAY THAT WAY:
 *   • Caching them would let a captured cryptogram be replayed against a cached
 *     "authentic" verdict without the monotonic tap counter ever being
 *     re-checked. See the boundary note in src/lib/cache.ts.
 *   • Rate-limiting them is also wrong: a 429 on a physical tap is a broken
 *     product. Someone standing in a shop tapping a chip must always reach the
 *     verifier.
 *
 * WHAT THIS ACTUALLY BUYS US — be honest about the ordering:
 *   1. The PRIMARY control is the route's own Full Route Cache (`revalidate` +
 *      `generateStaticParams` in src/app/asset/[tokenId]/page.tsx), which makes
 *      Next emit `s-maxage=60, stale-while-revalidate` and collapses a crawl
 *      burst on one token into one origin render + one RPC read per TTL. That
 *      header is NOT set here — see the note at the bottom of this file for why
 *      a status-blind middleware must not assert cacheability.
 *   2. The per-IP limiter is defence-in-depth ONLY. Its default store is an
 *      in-process Map, which is per-instance and therefore bounds nothing
 *      globally on serverless — the same non-protection that
 *      tagit-services/api/index.ts:33 already provides. Set
 *      RATE_LIMIT_STORE_URL + RATE_LIMIT_STORE_TOKEN to swap in a shared counter
 *      with no code change (src/lib/rate-limit.ts).
 *   3. The real hard ceiling is a spend-capped RPC key. That is human-
 *      provisioned (task S0.2) and cannot be enforced from this repo. If you are
 *      relying on this file to prevent an overbilling incident, you are relying
 *      on the wrong layer.
 */
import { NextResponse, type NextRequest } from "next/server";
import { MCP_PATH, isRateLimitedPath, isTapPath, neverCacheControl } from "@/lib/cache";
import {
  MCP_RATE_LIMIT,
  READ_RATE_LIMIT,
  READ_RATE_WINDOW_SECONDS,
  clientKey,
  createRateLimitStore,
} from "@/lib/rate-limit";
import {
  TAP_DEVICE_HEADER,
  TAP_DEVICE_MAX_AGE_SECONDS,
  isTapDeviceId,
  newTapDeviceId,
  tapDeviceCookieName,
} from "@/lib/tap-device-cookie";

export const config = {
  // Token-id reads and /mcp. See the scope note above before widening this.
  //
  // `:path*` and not `:tokenId`: Next compiles matcher patterns with its own
  // `_next/data/…json` suffix handling bolted on, and a bare single named
  // segment gets swallowed by it — `/asset/:tokenId` compiles to a regex that
  // matches `/asset` and NOT `/asset/50`, so the middleware silently never runs.
  // Verified against .next/server/middleware-manifest.json; if you edit this,
  // re-check the compiled `regexp` there rather than assuming.
  //
  // /mcp is a single exact path, so it is listed literally. It is asserted by
  // scripts/test-mcp.ts, which floods the endpoint and requires a 429 — an
  // unmatched middleware would leave the only control on the only uncacheable
  // path silently absent, which is exactly the failure the `:tokenId` trap above
  // produced once already.
  //
  // The last four are the tap routes, matched only for the device id (see
  // `withTapDevice`). /sun and /api/verify are exact paths; /01 and /api/dpp
  // take the rest of the path. src/lib/__tests__/middleware-matcher.test.ts
  // keeps this list and `isTapPath` saying the same thing.
  matcher: [
    "/asset/:path*",
    "/api/asset/:path*",
    "/mcp",
    "/sun",
    "/01/:path*",
    "/api/verify",
    "/api/dpp/:path*",
  ],
};

/**
 * A tap route: pass the request on with the device id, and do nothing else.
 *
 * The id is read from the cookie, or made new when there is none (or when
 * what the cookie holds is not an id). It is handed to the route in a request
 * header — set here, so whatever a client sent under that name is replaced —
 * and written back as a cookie on the response, which renews it for another
 * 15 minutes. A page rendered by the App Router cannot set a cookie itself
 * once it has started sending, which is why this happens here.
 *
 * A HEAD request is answered here and goes no further. It asks for no page,
 * so nobody would see a result, yet running the route would open the link
 * and leave the person who then follows it looking at "expired". Link
 * checkers and some preview tools send HEAD before, or instead of, GET.
 *
 * No limiter and no cache header that allows storing: see the top of this file.
 */
function withTapDevice(request: NextRequest): NextResponse {
  if (request.method === "HEAD") {
    return new NextResponse(null, {
      status: 200,
      headers: { "cache-control": neverCacheControl() },
    });
  }

  const secure = request.nextUrl.protocol === "https:";
  const cookie = tapDeviceCookieName(secure);
  const held = request.cookies.get(cookie)?.value;
  const id = isTapDeviceId(held) ? held : newTapDeviceId();

  const headers = new Headers(request.headers);
  headers.set(TAP_DEVICE_HEADER, id);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(cookie, id, {
    httpOnly: true,
    secure,
    // Lax, not Strict: a shopper who comes back to the page from a sign-in or
    // a checkout on another site must still be the same phone.
    sameSite: "lax",
    path: "/",
    maxAge: TAP_DEVICE_MAX_AGE_SECONDS,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Tap routes leave here, before the limiter: they are never rate-limited.
  if (isTapPath(pathname)) return withTapDevice(request);

  // Belt-and-braces: the matcher already restricts us, but re-assert the
  // predicate so a future matcher edit can't silently start rate-limiting a tap
  // route (a 429 on a physical tap is a broken product).
  if (!isRateLimitedPath(pathname)) return NextResponse.next();

  const isMcp = pathname === MCP_PATH || pathname === `${MCP_PATH}/`;
  const limit = isMcp ? MCP_RATE_LIMIT : READ_RATE_LIMIT;

  const decision = await createRateLimitStore().hit(
    clientKey(request.headers, isMcp ? "mcp" : "asset"),
    limit,
    READ_RATE_WINDOW_SECONDS,
  );

  if (!decision.allowed) {
    // `no-store` on the 429 is load-bearing: a cached 429 at the edge would lock
    // every other client out of this token for the whole TTL, turning a
    // best-effort limiter into a self-inflicted outage.
    //
    // /mcp gets a JSON-RPC error object rather than the plain-text body: its
    // callers are MCP clients that parse every response as JSON, and handing
    // them prose turns a retryable 429 into an unexplained transport crash.
    const body = isMcp
      ? JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: `Too many requests: this public MCP endpoint allows ${limit} calls per ${READ_RATE_WINDOW_SECONDS}s per IP. Retry in ${decision.resetSeconds}s.`,
          },
        })
      : "Too many requests. This is a public read endpoint; please slow down.";

    return new NextResponse(body, {
      status: 429,
      headers: {
        "content-type": isMcp ? "application/json" : "text/plain; charset=utf-8",
        "cache-control": neverCacheControl(),
        "retry-after": String(decision.resetSeconds),
        ...(isMcp ? { "access-control-allow-origin": "*" } : {}),
        ...rateLimitHeaders(limit, decision.remaining, decision.resetSeconds),
      },
    });
  }

  const response = NextResponse.next();
  // DO NOT set `cache-control` here. Middleware runs BEFORE the handler and
  // cannot see the status it is about to decorate, so any header set on
  // `NextResponse.next()` lands on 4xx/5xx exactly as it lands on 200. Setting
  // `public, s-maxage=60, stale-while-revalidate=300` here meant a render throw
  // (e.g. a malformed NEXT_PUBLIC_PRIVY_APP_ID makes PrivyProvider throw during
  // SSR of an ACTIVATED asset — measured: HTTP 500 carrying that exact header)
  // was handed to shared caches as storable and stale-servable for up to 360s.
  // RFC 9111 §4.2.1 permits a shared cache to store a 500 that carries explicit
  // freshness, so a one-second blip became a six-minute outage of a
  // verification page on any CDN that takes the header at face value.
  //
  // The route's own `revalidate` + `generateStaticParams` (src/app/asset/
  // [tokenId]/page.tsx) already emit `s-maxage=60, stale-while-revalidate` and,
  // unlike middleware, Next emits it ONLY for a cacheable 200 render. That is
  // the status-aware version of the same directive, so it is the one that ships.
  // Verified with curl: 200 → `s-maxage=60, stale-while-revalidate`; the 429
  // below → `no-store`.
  for (const [k, v] of Object.entries(
    rateLimitHeaders(limit, decision.remaining, decision.resetSeconds),
  )) {
    response.headers.set(k, v);
  }
  return response;
}

function rateLimitHeaders(
  limit: number,
  remaining: number,
  resetSeconds: number,
): Record<string, string> {
  return {
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": String(resetSeconds),
  };
}
