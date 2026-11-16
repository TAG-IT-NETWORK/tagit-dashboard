import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TapResult } from "@/components/tap-result";
import { COPY } from "@/lib/consumer-copy";
import { shownTagId } from "@/lib/tap-view";

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
 * Nothing was looked up, so that screen does not say the tag is unknown: it
 * says the link cannot be checked on its own and asks for a tap (TAP-T08).
 *
 * 307, not 308: reversible. Consolidating ranking signals onto /asset/{id} argues
 * for a permanent redirect, but a 308 is cached hard by browsers and is painful to
 * undo. Revisit when P0.1 makes this host crawlable.
 */

export const metadata: Metadata = {
  title: "Product check | TAG IT Verify",
  robots: { index: false, follow: false },
};

/** Digits only, and short enough that a megabyte of them cannot burn CPU before
 *  BigInt() sees it — the same guard the public JSON API applies. */
function parseTokenId(raw: string): string | null {
  const clean = raw.replace(/[:\-\s]/g, "");
  if (!/^\d{1,78}$/.test(clean)) return null;
  return BigInt(clean).toString(); // normalises leading zeros: "050" -> "50"
}

export default async function TagVerifyPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const tokenId = parseTokenId(uid);
  if (tokenId !== null) redirect(`/asset/${tokenId}`);

  // Only something shaped like a tag ID is shown back, and only in the drawer.
  const tagId = shownTagId(uid);
  return (
    <TapResult
      state="linkIncomplete"
      technical={
        tagId ? { rows: [{ label: COPY.technical.tagId, value: tagId }], links: [] } : undefined
      }
    />
  );
}
