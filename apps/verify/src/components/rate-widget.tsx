"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * "Own this item? Rate it" — the wallet stack (Privy) loads only when the
 * visitor asks to rate, so the tap page stays light. The actual proof is
 * server-side: the signed message must come from the token's on-chain owner.
 */
const RateCheckout = dynamic(() => import("./rate-checkout"), {
  ssr: false,
  loading: () => <p className="text-center text-xs text-gray-500">Loading your wallet…</p>,
});

export function RateWidget({ tokenId, productName }: { tokenId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) return null;
  return (
    <div className="mb-5 animate-fadeUp" style={{ animationDelay: "0.35s" }}>
      {open ? (
        <RateCheckout tokenId={tokenId} productName={productName} onClose={() => setOpen(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-[#00D68F]/40 px-5 py-3 text-sm text-[#00D68F] hover:bg-[#00D68F]/10"
        >
          Own this item? Rate it as a verified owner
        </button>
      )}
    </div>
  );
}
