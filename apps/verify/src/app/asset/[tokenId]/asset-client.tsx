"use client";

import { BuyWidget } from "@/components/buy-widget";

/**
 * Client island for /asset/[tokenId].
 *
 * Everything here is deliberately OUTSIDE the server-rendered, crawlable
 * payload. It holds exactly one thing: the "tap to buy" widget, gated on a
 * state code the server already resolved. It performs NO chain read, and —
 * since META-T17 — it carries NO price either: the widget fetches the
 * canonical price from the server (GET /api/asset/[tokenId]/price) and hides
 * itself when there is no live listing.
 *
 * ─── PRIVACY: WHY THE OWNER ADDRESS IS NOWHERE ON THIS PAGE ─────────────────
 * SEC-ANVS-001 threat 2 (targeted theft): a public, crawlable HTML page that
 * links a physical object to a wallet address hands an attacker a shopping
 * list. The rule is uniform across every surface of this host:
 *
 *   1. The owner address MUST NOT appear in server-rendered HTML.
 *   2. The owner address MUST NOT be passed as a prop from the server
 *      component (props serialize into the RSC flight payload).
 *   3. The owner address MUST NOT be fetched here either.
 *
 * GET /api/asset/[tokenId] returns a domain-separated `ownerCommitment`
 * instead — a caller with a candidate address can check it; a scraper cannot
 * build a goods → wallet map in one pass.
 */

export function AssetClientIsland({
  tokenId,
  stateCode,
  productName,
}: {
  tokenId: string;
  stateCode: number;
  productName: string;
}) {
  const showBuy = stateCode === 3; // ACTIVATED — in distribution, claimable

  if (!showBuy) return null;

  return (
    <div className="mb-5">
      <BuyWidget tokenId={tokenId} productName={productName} />
    </div>
  );
}
