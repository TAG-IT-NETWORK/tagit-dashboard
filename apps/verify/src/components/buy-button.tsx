"use client";

import { useCallback, useMemo, useState } from "react";
import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData, type Hex } from "viem";

// Base Sepolia test USDC (6 decimals) + the seller treasury that receives it.
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const USDC_DECIMALS = 6;
const TREASURY =
  (process.env.NEXT_PUBLIC_SALE_TREASURY as `0x${string}` | undefined) ??
  "0x458B4d0c3a55006965Fd13D6af7B8509De51Cb3D";
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

function priceToUnits(priceUsdc: number): bigint {
  return BigInt(Math.round(priceUsdc * 10 ** USDC_DECIMALS));
}

/**
 * "Tap to buy" button — the hackathon centerpiece.
 *
 * A buyer taps a chipped product, lands on the verify page, and (for an
 * ACTIVATED asset) sees this. Sign in with email → Privy mints a non-custodial
 * embedded wallet on Base Sepolia → "Buy now" POSTs to /api/buy → the backend
 * relayer calls TAGITCore.claim(tokenId, buyerWallet), flipping ownership to the
 * buyer's wallet. No app, no seed phrase, no gas. Cross-device by construction
 * (it's a web page), so iPhone⇄Android "tap to buy" just works.
 *
 * Only rendered when NEXT_PUBLIC_PRIVY_APP_ID is set (page-gated), so the Privy
 * hooks always have their provider.
 */

type Phase = "idle" | "paying" | "settling" | "done" | "error";

interface BuyButtonProps {
  tokenId: string;
  productName: string;
  priceUsdc: number;
}

function formatPrice(p: number): string {
  return p % 1 === 0 ? `$${p}` : `$${p.toFixed(2)}`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function BuyButton({ tokenId, productName, priceUsdc }: BuyButtonProps) {
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
      // 1. Payment leg (when enabled): the buyer pays USDC to the seller treasury.
      //    Gas is sponsored by Privy, so the buyer needs USDC but no ETH.
      let paymentTxHash: Hex | undefined;
      if (PAYMENT_ENABLED) {
        setPhase("paying");
        const data = encodeFunctionData({
          abi: erc20TransferAbi,
          functionName: "transfer",
          args: [TREASURY, priceToUnits(priceUsdc)],
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
        body: JSON.stringify({ tokenId, buyerWallet, paymentTxHash, priceUsdc }),
      });
      const data = await res.json();
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
  }, [buyerWallet, tokenId, priceUsdc, sendTransaction]);

  const wrap =
    "rounded-2xl border border-[#00D68F]/30 p-5 mb-5 animate-fadeUp";
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
        <span className="text-lg font-bold text-[#00D68F]">{formatPrice(priceUsdc)}</span>
      </div>

      {!ready ? (
        <button disabled className={primaryBtn}>
          Loading…
        </button>
      ) : !authenticated ? (
        <button onClick={login} className={primaryBtn}>
          Sign in to buy · {formatPrice(priceUsdc)}
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
                : `Buy now · ${formatPrice(priceUsdc)}`}
        </button>
      )}

      {authenticated && buyerWallet && phase !== "paying" && phase !== "settling" && (
        <div className="text-center text-[10px] text-gray-500 font-mono mt-2">
          {PAYMENT_ENABLED ? (
            <>
              pay {formatPrice(priceUsdc)} USDC from {shortAddr(buyerWallet)} · gas sponsored
              <br />
              <a href={CIRCLE_FAUCET} target="_blank" rel="noopener noreferrer" className="text-[#00D68F] hover:underline">
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
