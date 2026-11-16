"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { COPY } from "@/lib/consumer-copy";

import { NEEDS_SCRIPT, SECONDARY_BUTTON } from "./shared";

/**
 * "Own it? Write a review" — the sign-in stack (Privy) loads only when the
 * visitor asks to review, so the tap page stays light. The actual proof is
 * server-side: the signed message must come from the item's registered owner.
 */
const RateCheckout = dynamic(() => import("./rate-checkout"), {
  ssr: false,
  loading: () => (
    <p className="text-center text-[13px] leading-[18px] text-muted">{COPY.reviews.loading}</p>
  ),
});

export function RateWidget({ tokenId, productName }: { tokenId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) return null;
  return open ? (
    <RateCheckout tokenId={tokenId} productName={productName} onClose={() => setOpen(false)} />
  ) : (
    <button
      type="button"
      {...NEEDS_SCRIPT}
      onClick={() => setOpen(true)}
      className={SECONDARY_BUTTON}
    >
      {COPY.reviews.write}
    </button>
  );
}
