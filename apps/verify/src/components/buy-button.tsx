"use client";

import { useCallback, useMemo, useState } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData, type Hex } from "viem";
import { isPurchasable, type CanonicalPrice } from "@/lib/price";

// Base Sepolia test USDC (6 decimals).
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const BASE_SEPOLIA = 84532;
// When set, the buyer pays USDC (verified on-chain) before claiming. Off by
// default so the gasless demo keeps working until we flip this on.
const PAYMENT_ENABLED = process.env.NEXT_PUBLIC_SALE_REQUIRE_PAYMENT === "true";
const CIRCLE_FAUCET = "https://faucet.circle.com";

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
 * auto-delists) surfaces as "listing no longer available" and triggers a
 * price refetch, which hides the widget.
 */

type Phase = "idle" | "paying" | "settling" | "done" | "error";

interface BuyButtonProps {
  tokenId: string;
  productName: string;
  price: CanonicalPrice;
  /** Live re-read of the canonical price (also updates the widget's state). */
  refetchPrice: () => Promise<CanonicalPrice | null>;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
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
  const [result, setResult] = useState<{
    newOwner: string;
    explorerUrl?: string;
    paymentExplorerUrl?: string;
  } | null>(null);

  const display = price.display ?? (price.priceUsdc6 ? formatUsdc6(price.priceUsdc6) : "—");

  const buyerWallet = useMemo(() => {
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    return embedded?.address ?? user?.wallet?.address ?? null;
  }, [wallets, user]);

  const buy = useCallback(async () => {
    if (!buyerWallet) {
      setError("Wallet still initializing — try again in a moment.");
      setPhase("error");
      return;
    }
    setError(null);
    try {
      // 0. Re-read the canonical price IMMEDIATELY before payment. The page
      //    may be minutes old; the charge must reflect the listing right now.
      const fresh = await refetchPrice();
      if (!isPurchasable(fresh)) {
        setError("This listing is no longer available.");
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
          // Most common cause: the fresh wallet has no test USDC yet.
          setError(
            /insufficient|balance|funds/i.test(msg)
              ? `Not enough test USDC. Fund ${shortAddr(buyerWallet)} at faucet.circle.com, then try again.`
              : `Payment failed: ${msg}`,
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
        setError("This listing is no longer available.");
        setPhase("error");
        void refetchPrice(); // widget hides itself once the delist lands
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error || `Purchase failed (${res.status})`);
        setPhase("error");
        return;
      }
      setResult({
        newOwner: data.newOwner ?? buyerWallet,
        explorerUrl: data.explorerUrl,
        paymentExplorerUrl: data.paymentExplorerUrl,
      });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setPhase("error");
    }
  }, [buyerWallet, tokenId, refetchPrice, sendTransaction]);

  const wrap = "rounded-2xl border border-[#00D68F]/30 p-5 mb-5 animate-fadeUp";
  const wrapStyle = { background: "rgba(0,214,143,0.07)", animationDelay: "0.45s" };
  const primaryBtn =
    "w-full rounded-xl bg-[#00D68F] py-3.5 text-center text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-50";

  // Success — buyer now owns the asset.
  if (phase === "done" && result) {
    return (
      <div className={wrap} style={wrapStyle}>
        <div className="text-center text-2xl mb-1">🎉</div>
        <div className="text-center text-[#00D68F] font-bold mb-1">You own it</div>
        <div className="text-center text-xs text-gray-400 mb-3">
          {productName} transferred to your wallet
          <br />
          <span className="font-mono">{shortAddr(result.newOwner)}</span>
        </div>
        {result.paymentExplorerUrl && (
          <a
            href={result.paymentExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-gray-400 hover:underline font-mono mb-1"
          >
            USDC payment ↗
          </a>
        )}
        {result.explorerUrl && (
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-[#00D68F] hover:underline font-mono"
          >
            View transfer on Base Sepolia ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={wrap} style={wrapStyle}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-sm font-semibold text-white">Buy this item</span>
        <span className="text-lg font-bold text-[#00D68F]">{display}</span>
      </div>

      {!ready ? (
        <button disabled className={primaryBtn}>
          Loading…
        </button>
      ) : !authenticated ? (
        <button onClick={login} className={primaryBtn}>
          Sign in to buy · {display}
        </button>
      ) : (
        <button
          onClick={buy}
          disabled={phase === "paying" || phase === "settling" || !buyerWallet}
          className={primaryBtn}
        >
          {phase === "paying"
            ? "Paying USDC…"
            : phase === "settling"
              ? "Transferring…"
              : !buyerWallet
                ? "Preparing wallet…"
                : `Buy now · ${display}`}
        </button>
      )}

      {authenticated && buyerWallet && phase !== "paying" && phase !== "settling" && (
        <div className="text-center text-[10px] text-gray-500 font-mono mt-2">
          {PAYMENT_ENABLED ? (
            <>
              pay {display} USDC from {shortAddr(buyerWallet)} · gas sponsored
              <br />
              <a
                href={CIRCLE_FAUCET}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00D68F] hover:underline"
              >
                need test USDC? faucet.circle.com
              </a>
            </>
          ) : (
            <>to {shortAddr(buyerWallet)} · gasless on Base</>
          )}
        </div>
      )}

      {phase === "error" && error && (
        <div className="text-center text-xs text-red-400 mt-2">{error}</div>
      )}
    </div>
  );
}
