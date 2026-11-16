"use client";

import { useState } from "react";
import { PrivyProvider, usePrivy, useSignMessage, useWallets } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";

import { COPY } from "@/lib/consumer-copy";
import { ratingMessage, reviewDigestBrowser } from "@/lib/ratings-shared";

const PRIMARY =
  "flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-brand px-4 text-[17px] font-semibold leading-6 text-white hover:bg-brand-strong disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** Sign-in context + the review form (lazy chunk, see rate-widget.tsx). */
export default function RateCheckout({
  tokenId,
  productName,
  onClose,
}: {
  tokenId: string;
  productName: string;
  onClose: () => void;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        appearance: { theme: "light", accentColor: "#0b72d9" },
      }}
    >
      <RateForm tokenId={tokenId} productName={productName} onClose={onClose} />
    </PrivyProvider>
  );
}

function RateForm({
  tokenId,
  productName,
  onClose,
}: {
  tokenId: string;
  productName: string;
  onClose: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];

  const submit = async () => {
    if (!wallet || stars < 1) return;
    setBusy(true);
    setError(null);
    try {
      const timestamp = Date.now();
      const digest = await reviewDigestBrowser(review);
      const message = ratingMessage(tokenId, stars, digest, timestamp);
      const signed = (await signMessage({ message }, { address: wallet.address })) as
        | { signature?: string }
        | string;
      const signature = typeof signed === "string" ? signed : signed.signature;
      if (!signature) throw new Error("no signature");
      const res = await fetch(`/api/asset/${tokenId}/rating`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stars,
          review: review.trim() || null,
          rater: wallet.address,
          signature,
          timestamp,
        }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !body?.ok) {
        // The server's own wording can name internals; the shopper gets ours.
        setError(res.status === 403 ? COPY.reviews.notOwner : COPY.reviews.failed);
        return;
      }
      setDone(true);
    } catch {
      setError(COPY.reviews.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[15px] font-semibold leading-[22px]">
          {COPY.reviews.formTitle(productName)}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-brand-link underline underline-offset-2"
        >
          {COPY.reviews.close}
        </button>
      </div>
      {done ? (
        <p role="status" className="text-[15px] leading-[22px] text-ok">
          {COPY.reviews.thanks}
        </p>
      ) : !ready ? (
        <p className="text-sm leading-5 text-muted">{COPY.reviews.preparing}</p>
      ) : !authenticated ? (
        <>
          <p className="text-sm leading-5 text-body">{COPY.reviews.signInBody}</p>
          <button type="button" onClick={() => login()} className={PRIMARY}>
            {COPY.reviews.signIn}
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-1" role="radiogroup" aria-label={COPY.reviews.starsGroup}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={stars === i}
                aria-label={COPY.reviews.starOption(i)}
                onClick={() => setStars(i)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg text-3xl leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${i <= stars ? "text-[#b45309]" : "text-line-field"}`}
              >
                <span aria-hidden="true">★</span>
              </button>
            ))}
          </div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value.slice(0, 500))}
            placeholder={COPY.reviews.placeholder}
            aria-label={COPY.reviews.placeholder}
            className="w-full rounded-xl border border-line-field bg-white p-3 text-[15px] leading-[22px] text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            rows={3}
          />
          <p className="text-[13px] leading-[18px] text-muted">{COPY.reviews.ownerNote}</p>
          {error && (
            <p role="alert" className="text-sm leading-5 text-bad">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy || stars < 1 || !wallet}
            onClick={() => void submit()}
            className={PRIMARY}
          >
            {busy
              ? COPY.reviews.sending
              : stars
                ? COPY.reviews.send(stars)
                : COPY.reviews.pickStars}
          </button>
        </>
      )}
    </div>
  );
}
