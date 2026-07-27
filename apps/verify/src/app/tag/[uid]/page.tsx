import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * NFC fallback route — /tag/{uid}
 *
 * WHY THIS IS NINETY FEWER LINES THAN IT WAS
 * ──────────────────────────────────────────
 * This route was a "use client" page that read the chain from the BROWSER and
 * rendered its own verdict card, including a "Owner  0x1234…abcd" row. Three
 * problems, all of which this file exists to remove rather than to relocate:
 *
 *   1. It was the last browser-side caller of the chain transport. As long as any
 *      client component read the chain, the RPC URL had to be a NEXT_PUBLIC_
 *      variable, and a NEXT_PUBLIC_ variable is inlined into the bundle every
 *      visitor downloads. A spend-capped key cannot live there. Deleting the
 *      browser read is what lets @/lib/contract.server be `server-only`, which is
 *      what makes the capped key safe to provision (S0.2).
 *
 *   2. It printed the owner address. /asset/[tokenId] deliberately keeps the owner
 *      out of the server HTML AND out of the RSC flight payload, and
 *      /api/asset/[tokenId] returns a domain-separated commitment instead of the
 *      raw address — both for SEC-ANVS-001 threat 2 (targeted theft: a crawlable
 *      goods → wallet map is a shopping list). This route quietly served what the
 *      other two refused. A privacy rule with an exception is not a rule.
 *
 *   3. It was a SECOND verdict renderer. It had already drifted — its own state
 *      labels ("Not Yet Bound", "Retired") did not match @/lib/states, so the same
 *      token could read differently on two URLs of the same host. It also sat
 *      outside the middleware matcher (/asset/:path*, /api/asset/:path*), so it
 *      had neither the rate limiter nor the 60s Full Route Cache: every hit was an
 *      uncached chain read.
 *
 * WHAT IT DOES NOW. The uid is parsed as a token id and the request is redirected
 * to /asset/{tokenId} — the one server-rendered, cached, rate-limited, crawlable
 * verdict. No chain read happens here at all; the redirect is computed from the
 * URL alone, so an enumeration sweep of this path costs zero RPC calls.
 *
 * This is safe because the chips are programmed with /asset/{id} URLs — see the
 * comment this file replaced. /tag/{uid} was always the fallback.
 *
 * If a real NTAG UID (hex, colon-separated) ever needs resolving here, the lookup
 * is `getTokenByTag(uidToTagHash(uid))` in @/lib/contract.server, called from a
 * server component — NOT from the browser. Until such a chip exists, an
 * unparseable uid renders the static screen below without touching the chain.
 *
 * 307, not 308: reversible. Consolidating ranking signals onto /asset/{id} argues
 * for a permanent redirect, but a 308 is cached hard by browsers and is painful to
 * undo. Revisit when P0.1 makes this host crawlable.
 */

export const metadata: Metadata = {
  title: "NFC tag lookup | TAG IT Verify",
  robots: { index: false, follow: false },
};

/** Digits only, and short enough that a megabyte of them cannot burn CPU before
 *  BigInt() sees it — the same guard the public JSON API applies. */
function parseTokenId(raw: string): string | null {
  const clean = raw.replace(/[:\-\s]/g, "");
  if (!/^\d{1,78}$/.test(clean)) return null;
  return BigInt(clean).toString(); // normalises leading zeros: "050" -> "50"
}

function formatUid(uid: string): string {
  const clean = uid.replace(/[:\-\s]/g, "").toUpperCase();
  return clean.match(/.{1,2}/g)?.join(":") || clean;
}

export default function TagVerifyPage({ params }: { params: { uid: string } }) {
  const tokenId = parseTokenId(params.uid);
  if (tokenId !== null) redirect(`/asset/${tokenId}`);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#000" }}
    >
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4 text-gray-600">?</div>
        <h1 className="text-2xl font-syne font-bold text-white mb-2">Tag Not Found</h1>
        <p className="text-gray-400 text-sm mb-2">
          This NFC tag is not registered on-chain.
        </p>
        <p className="text-gray-600 text-xs font-mono mb-6">{formatUid(params.uid)}</p>
        <a href="/" className="text-[#00D68F] hover:underline text-sm">
          Back to TAG IT Verify
        </a>
      </div>
    </main>
  );
}
