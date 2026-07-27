"use client";

import { useEffect, useState } from "react";
import { getAsset, getBuyConfigForToken } from "@/lib/contract";
import { BuyWidget } from "@/components/buy-widget";

/**
 * Client island for /asset/[tokenId].
 *
 * Everything here is deliberately OUTSIDE the server-rendered, crawlable payload.
 *
 * ─── PRIVACY: WHY THE OWNER ADDRESS IS FETCHED HERE AND NOT PASSED IN ─────────
 * SEC-ANVS-001 threat 2 (targeted theft): a public, crawlable HTML page that
 * links a physical object to a wallet address hands an attacker a shopping list.
 * "This serial number is a $12k watch, it lives at this address, and that address
 * holds these other assets" is a complete target dossier assembled from public
 * pages, and unlike a leaked database it is indexed, permanent and searchable.
 *
 * The page used to be "use client", so the owner was never in the HTML — the
 * privacy property was accidental. Server-rendering the verdict removes that
 * accident, so the constraint is now explicit and enforced by structure:
 *
 *   1. The owner address MUST NOT appear in server-rendered HTML.
 *   2. The owner address MUST NOT be passed as a prop from the server component.
 *      Props to client components are serialised into the RSC flight payload that
 *      ships inside the same HTML document — passing it down would leak it just
 *      as thoroughly as rendering it, only less visibly. That is why this
 *      component takes only `tokenId` and does its own read in the browser.
 *
 * The extra browser-side RPC read is the deliberate price of (2). It is bounded
 * by human traffic: crawlers and answer engines do not execute this code, which
 * is precisely the point.
 *
 * If you are here to "simplify" by hoisting the owner into the server component:
 * don't. Omitting the owner entirely is an acceptable change; server-rendering it
 * is not.
 */

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function AssetClientIsland({
  tokenId,
  stateCode,
  productName,
}: {
  tokenId: string;
  stateCode: number;
  productName: string;
}) {
  const [owner, setOwner] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAsset(BigInt(tokenId))
      .then((asset) => {
        if (!cancelled && asset.owner && asset.owner !== ZERO_ADDRESS) setOwner(asset.owner);
      })
      .catch(() => {
        // Owner display is a progressive enhancement. The verdict is already in
        // the server HTML, so a failed read here degrades to "no owner row"
        // rather than to a broken or misleading page.
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  const showBuy = stateCode === 3; // ACTIVATED — in distribution, claimable

  return (
    <>
      {owner && (
        <div
          className="rounded-2xl border border-white/10 p-5 mb-5"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-500 text-sm whitespace-nowrap">Current holder</span>
            <span className="text-white text-sm font-mono text-right break-all">
              {truncateAddress(owner)}
            </span>
          </div>
        </div>
      )}

      {showBuy && (
        <div className="mb-5">
          <BuyWidget
            tokenId={tokenId}
            productName={productName}
            priceUsdc={getBuyConfigForToken(tokenId).priceUsdc}
          />
        </div>
      )}
    </>
  );
}
