"use client";

import { getBuyConfigForToken } from "@/lib/contract";
import { BuyWidget } from "@/components/buy-widget";

/**
 * Client island for /asset/[tokenId].
 *
 * Everything here is deliberately OUTSIDE the server-rendered, crawlable payload.
 * It now holds exactly one thing: the "tap to buy" widget, gated on a state code
 * the server already resolved. It performs NO chain read.
 *
 * ─── PRIVACY: WHY THE OWNER ADDRESS IS NOWHERE ON THIS PAGE ───────────────────
 * SEC-ANVS-001 threat 2 (targeted theft): a public, crawlable HTML page that
 * links a physical object to a wallet address hands an attacker a shopping list.
 * "This serial number is a $12k watch, it lives at this address, and that address
 * holds these other assets" is a complete target dossier assembled from public
 * pages, and unlike a leaked database it is indexed, permanent and searchable.
 *
 * This component used to fetch the owner from the browser and render a "Current
 * holder" row. That kept the address out of the server HTML and the RSC flight
 * payload — but it still published it to anyone who loaded the page with JS, so
 * the page was refusing at the front door and serving at the back. It also made
 * this the only reason the browser needed a chain transport at all.
 *
 * The row is gone, and the rule is now uniform across every surface of this host:
 *
 *   1. The owner address MUST NOT appear in server-rendered HTML.
 *   2. The owner address MUST NOT be passed as a prop from the server component.
 *      Props to client components are serialised into the RSC flight payload that
 *      ships inside the same HTML document.
 *   3. The owner address MUST NOT be fetched here either.
 *
 * GET /api/asset/[tokenId] holds the same line from the other direction: it
 * returns a domain-separated `ownerCommitment` rather than the raw address, so a
 * caller who already has a candidate can still check it, and a scraper cannot
 * build a goods → wallet map in one pass. If you need "is 0xABC the holder?",
 * that endpoint answers it. If you want to render the address, the answer is no.
 *
 * KEEPING THIS FILE CHAIN-FREE IS LOAD-BEARING. @/lib/contract.server is marked
 * `server-only`; importing it from here is a build error, which is what stops the
 * spend-capped BASE_SEPOLIA_RPC_URL from being inlined into the browser bundle.
 * @/lib/contract (no suffix) is the chain-free half and is safe to import.
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
      <BuyWidget
        tokenId={tokenId}
        productName={productName}
        priceUsdc={getBuyConfigForToken(tokenId).priceUsdc}
      />
    </div>
  );
}
