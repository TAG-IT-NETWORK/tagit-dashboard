"use client";

import { useCallback, useMemo, useState } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData, type Hex } from "viem";
import { COPY } from "@/lib/consumer-copy";
import { isPurchasable, type CanonicalPrice } from "@/lib/price";

// Base Sepolia test USDC (6 decimals).
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const BASE_SEPOLIA = 84532;
// When set, the buyer pays USDC (verified on-chain) before claiming. Off by
// default so the gasless demo keeps working until we flip this on.
const PAYMENT_ENABLED = process.env.NEXT_PUBLIC_SALE_REQUIRE_PAYMENT === "true";

const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/**
 * "Tap to buy" button.
 *
 * PRICE DISCIPLINE (META-T17): the ONLY price this component knows is the
 * canonical server price handed down by BuyWidget, and it re-fetches that
 * price immediately before charging — a listing that was updated or delisted
 * between page load and tap is caught before any USDC moves. Payment amounts
 * are integer USDC-6 units straight from `priceUsdc6` (no floats).
 *
 * A 409 LISTING_STALE from settle (owner changed off-platform; services
 * auto-delists) surfaces as "just sold or taken off sale" and triggers a
 * price refetch, which hides the widget.
 *
 * WORDS (TAP-T08): everything the shopper reads comes from @/lib/consumer-copy.
 * No wallet address is shown — not the seller's and not the buyer's own — and
 * a failure never repeats the upstream error text.
 */

type Phase = "idle" | "paying" | "settling" | "done" | "error";

interface BuyButtonProps {
  tokenId: string;
  productName: string;
  price: CanonicalPrice;
  /** Live re-read of the canonical price (also updates the widget's state). */
  refetchPrice: () => Promise<CanonicalPrice | null>;
}

/** usdc6 → "$22.00" (fallback when the API omitted `display`). */
function formatUsdc6(priceUsdc6: string): string {
  const padded = priceUsdc6.padStart(7, "0");
  return `$${padded.slice(0, -6)}.${padded.slice(-6, -4)}`;
}

export function BuyButton({ tokenId, productName, price, refetchPrice }: BuyButtonProps) {
  const { ready, authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ explorerUrl?: string } | null>(null);

  const display = price.display ?? (price.priceUsdc6 ? formatUsdc6(price.priceUsdc6) : "—");

  const buyerWallet = useMemo(() => {
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    return embedded?.address ?? user?.wallet?.address ?? null;
  }, [wallets, user]);

  const buy = useCallback(async () => {
    if (!buyerWallet) {
      setError(COPY.buy.notReady);
      setPhase("error");
      return;
    }
    setError(null);
    try {
      // 0. Re-read the canonical price IMMEDIATELY before payment. The page
      //    may be minutes old; the charge must reflect the listing right now.
      const fresh = await refetchPrice();
      if (!isPurchasable(fresh)) {
        setError(COPY.buy.justSold);
        setPhase("error");
        return;
      }

      // 1. Payment leg (when enabled): buyer pays USDC to the listing's payTo.
      //    Gas is sponsored by Privy, so the buyer needs USDC but no ETH.
      let paymentTxHash: Hex | undefined;
      if (PAYMENT_ENABLED) {
        setPhase("paying");
        const data = encodeFunctionData({
          abi: erc20TransferAbi,
          functionName: "transfer",
          args: [fresh.purchase!.payTo as `0x${string}`, BigInt(fresh.priceUsdc6!)],
        });
        try {
          const { hash } = await sendTransaction(
            { to: USDC_ADDRESS, data, value: 0, chainId: BASE_SEPOLIA },
            { address: buyerWallet, sponsor: true },
          );
          paymentTxHash = hash;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Most common cause: the fresh demo wallet has no test funds yet.
          setError(
            /insufficient|balance|funds/i.test(msg) ? COPY.buy.noFunds : COPY.buy.paymentFailed,
          );
          setPhase("error");
          return;
        }
      }

      // 2. Settle: backend verifies the payment (if any) and flips ownership.
      setPhase("settling");
      const res = await fetch("/api/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tokenId,
          buyerWallet,
          paymentTxHash,
          priceUsdc: Number(fresh.priceUsdc6) / 1e6,
        }),
      });
      const data = await res.json();
      if (res.status === 409 || data?.code === "LISTING_STALE") {
        setError(COPY.buy.justSold);
        setPhase("error");
        void refetchPrice(); // widget hides itself once the delist lands
        return;
      }
      if (!res.ok || !data.ok) {
        setError(COPY.buy.failed);
        setPhase("error");
        return;
      }
      setResult({ explorerUrl: data.explorerUrl });
      setPhase("done");
    } catch {
      setError(COPY.buy.failed);
      setPhase("error");
    }
  }, [buyerWallet, tokenId, refetchPrice, sendTransaction]);

  const primaryBtn =
    "flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-brand px-4 text-[17px] font-semibold leading-6 text-white hover:bg-brand-strong disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  const note = "text-center text-[13px] leading-[18px] text-muted";

  // Success — the buyer is now the registered owner.
  if (phase === "done" && result) {
    return (
      <div
        role="status"
        className="flex flex-col gap-1 rounded-2xl border border-ok-line bg-ok-bg p-4"
      >
        <p className="text-lg font-bold leading-6 text-ok">{COPY.buy.successTitle}</p>
        <p className="text-sm leading-5 text-body">{COPY.buy.successBody(productName)}</p>
        {result.explorerUrl && (
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center self-start text-[13px] font-semibold leading-[18px] text-brand-link underline underline-offset-2"
          >
            {COPY.buy.viewRecord}
          </a>
        )}
      </div>
    );
  }

  const working = phase === "paying" || phase === "settling";
  const label = COPY.buy.button(display);

  return (
    <div className="flex flex-col gap-2">
      {!ready ? (
        <button type="button" disabled aria-busy="true" className={primaryBtn}>
          {label}
        </button>
      ) : !authenticated ? (
        <button type="button" onClick={login} className={primaryBtn}>
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={buy}
          disabled={working || !buyerWallet}
          aria-busy={working || !buyerWallet}
          className={primaryBtn}
        >
          {phase === "paying"
            ? COPY.buy.paying
            : phase === "settling"
              ? COPY.buy.registering
              : !buyerWallet
                ? COPY.buy.preparing
                : label}
        </button>
      )}

      {phase === "error" && error ? (
        <p role="alert" className="text-center text-sm leading-5 text-bad">
          {error}
        </p>
      ) : (
        <p className={note}>
          {ready && !authenticated ? `${COPY.buy.signInNote} ` : ""}
          {COPY.buy.demoNote}
        </p>
      )}
    </div>
  );
}
