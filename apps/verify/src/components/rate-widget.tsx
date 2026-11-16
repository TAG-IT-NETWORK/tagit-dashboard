"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { COPY } from "@/lib/consumer-copy";

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
      onClick={() => setOpen(true)}
      className="flex min-h-[48px] w-full items-center justify-center rounded-[14px] border border-line-strong bg-white px-4 text-[15px] font-semibold leading-[22px] text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {COPY.reviews.write}
    </button>
  );
}
