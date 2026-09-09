"use client";

import { useState } from "react";
import { PrivyProvider, usePrivy, useSignMessage, useWallets } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { ratingMessage, reviewDigestBrowser } from "@/lib/ratings";

/** Privy context + the rating form (lazy chunk, see rate-widget.tsx). */
export default function RateCheckout({ tokenId, productName, onClose }: { tokenId: string; productName: string; onClose: () => void }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        appearance: { theme: "dark", accentColor: "#00D68F" },
      }}
    >
      <RateForm tokenId={tokenId} productName={productName} onClose={onClose} />
    </PrivyProvider>
  );
}

function RateForm({ tokenId, productName, onClose }: { tokenId: string; productName: string; onClose: () => void }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
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
      const signed = (await signMessage({ message }, { address: wallet.address })) as { signature?: string } | string;
      const signature = typeof signed === "string" ? signed : signed.signature;
      if (!signature) throw new Error("wallet did not return a signature");
      const res = await fetch(`/api/asset/${tokenId}/rating`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stars, review: review.trim() || null, rater: wallet.address, signature, timestamp }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; code?: string; item?: { average?: number; count?: number } } | null;
      if (!res.ok || !body?.ok) {
        if (res.status === 403) throw new Error("Only the current owner of this item can rate it. Claim it first, then rate.");
        throw new Error(body?.error ?? `could not save the rating (HTTP ${res.status})`);
      }
      setDone(`Thank you — your ${stars}-star rating is on record. ${productName} now averages ${body.item?.average?.toFixed(1) ?? stars} from ${body.item?.count ?? 1} verified owner${(body.item?.count ?? 1) === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#00D68F]/30 p-5" style={{ background: "rgba(0,214,143,0.05)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Rate {productName}</p>
        <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">close</button>
      </div>
      {done ? (
        <p className="mt-3 text-sm text-[#00D68F]">{done}</p>
      ) : !ready ? (
        <p className="mt-3 text-xs text-gray-500">Preparing your wallet…</p>
      ) : !authenticated ? (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-3">Sign in with the email you used to claim this item. Your rating is signed by your wallet, so only real owners can rate.</p>
          <button type="button" onClick={() => login()} className="w-full rounded-2xl bg-[#00D68F] px-5 py-3 text-sm font-bold text-black">Sign in to rate</button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex gap-1" role="radiogroup" aria-label="stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={stars === i} onClick={() => setStars(i)} className={`text-3xl leading-none ${i <= stars ? "text-[#00D68F]" : "text-gray-700"} hover:text-[#00D68F]`}>
                ★
              </button>
            ))}
          </div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value.slice(0, 500))}
            placeholder="Optional: a few words for other owners (500 characters max)"
            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-gray-200 placeholder:text-gray-600"
            rows={3}
          />
          <p className="text-[11px] text-gray-500">Signing with {wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : "your wallet"}. Nothing is sent to the chain; the signature proves ownership.</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="button" disabled={busy || stars < 1 || !wallet} onClick={() => void submit()} className="w-full rounded-2xl bg-[#00D68F] px-5 py-3 text-sm font-bold text-black disabled:opacity-50">
            {busy ? "Signing…" : stars ? `Submit ${stars}-star rating` : "Pick a star rating"}
          </button>
        </div>
      )}
    </div>
  );
}
