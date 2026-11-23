"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useSendTransaction, useSignMessage, useWallets } from "@privy-io/react-auth";
import { encodeFunctionData, type Hex } from "viem";
import { COPY, isFailureAfterPayment, purchaseFailure, supportMailto } from "@/lib/consumer-copy";
import { offeredMethods } from "@/lib/buy-methods";
import { DEMO_ORDER_LIFETIME_SECONDS, demoOrderMessage, type DemoOrder } from "@/lib/demo-order";
import { isPurchasable, priceDisplay, takesDemoOrder, type CanonicalPrice } from "@/lib/price";

import { PRIMARY_BUTTON } from "./shared";

// Base Sepolia test USDC (6 decimals).
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const BASE_SEPOLIA = 84532;
// Where a demo buyer gets free test funds for the demo checkout.
const TEST_FUNDS_URL = "https://faucet.circle.com";

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
 * PROOF (TAP-T15): the settle route takes a verified USDC payment, or for a
 * demo item an order signed by the buyer's wallet, and nothing else. Which one
 * is the server's word (`purchase.proof`); there is no build-time switch.
 *
 * A 409 LISTING_STALE from settle (owner changed off-platform; services
 * auto-delists) surfaces as "just sold or taken off sale" and triggers a
 * price refetch, which hides the widget.
 *
 * WORDS (TAP-T08): everything the shopper reads comes from @/lib/consumer-copy,
 * and a failure never repeats the upstream error text. The seller's address is
 * never shown. The buyer's own demo account is shown in one place only: inside
 * a closed "How to add test funds" note, to the signed-in buyer, when a demo
 * payment failed for lack of test funds — they need it to add some.
 */

type Phase = "idle" | "paying" | "settling" | "done" | "error";

interface BuyButtonProps {
  tokenId: string;
  productName: string;
  price: CanonicalPrice;
  /** Live re-read of the canonical price (also updates the widget's state). */
  refetchPrice: () => Promise<CanonicalPrice | null>;
  /** Whether to say that no real money is charged. The server's word (see @/lib/buy-methods). */
  demo?: boolean;
  /**
   * The shopper already pressed "Buy now" and chose this way to pay in the
   * sheet (TAP-T13), so carry on without a second press: open the sign-in
   * when they are not signed in, then start the purchase. Each happens once.
   * A shopper who closes the sign-in is left with the button.
   */
  autoStart?: boolean;
  /** Back to the list of ways to pay. */
  onChooseAnother?: () => void;
}

export function BuyButton({
  tokenId,
  productName,
  price,
  refetchPrice,
  demo = true,
  autoStart = false,
  onChooseAnother,
}: BuyButtonProps) {
  const { ready, authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const { signMessage } = useSignMessage();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ explorerUrl?: string } | null>(null);

  const display = priceDisplay(price) || "—";

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
    // Whether this attempt already sent a payment. It only chooses the words
    // of a later failure: "you haven't been charged" is said only when true.
    let paid = false;
    try {
      // 0. Re-read the canonical price IMMEDIATELY before payment. The page
      //    may be minutes old; the charge must reflect the listing right now.
      const fresh = await refetchPrice();
      if (!isPurchasable(fresh)) {
        setError(COPY.buy.justSold);
        setPhase("error");
        return;
      }
      // The same fresh answer also says which ways to pay are offered NOW.
      // Signing in can take minutes; if the server stopped offering this way
      // in the meantime, nothing is sent.
      if (!offeredMethods(fresh).includes("crypto")) {
        setError(COPY.buy.methodWithdrawn);
        setPhase("error");
        return;
      }

      // 1. The proof (TAP-T15). The server takes one of two and says which
      //    (`purchase.proof`): a USDC payment, or for a demo item an order
      //    signed by this wallet. Anything but the server's exact word for a
      //    demo order means the buyer pays.
      let paymentTxHash: Hex | undefined;
      let demoOrder: DemoOrder | undefined;
      if (takesDemoOrder(fresh)) {
        // No payment: the wallet signs a short text naming the item and
        // itself. Privy shows that text to the buyer before signing.
        setPhase("settling");
        const expires = Math.floor(Date.now() / 1000) + DEMO_ORDER_LIFETIME_SECONDS;
        try {
          const { signature } = await signMessage(
            {
              message: demoOrderMessage({
                tokenId,
                buyer: buyerWallet,
                chainId: fresh.purchase!.chainId,
                expires,
              }),
            },
            { address: buyerWallet },
          );
          demoOrder = { expires, signature };
        } catch {
          setError(purchaseFailure("failed", false));
          setPhase("error");
          return;
        }
      } else {
        // The buyer pays USDC to the listing's payTo. Gas is sponsored by
        // Privy, so the buyer needs USDC but no ETH.
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
          paid = true;
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
          priceUsdc: paymentTxHash ? Number(fresh.priceUsdc6) / 1e6 : undefined,
          demoOrder,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 || data?.code === "LISTING_STALE") {
        setError(purchaseFailure("justSold", paid));
        setPhase("error");
        void refetchPrice(); // widget hides itself once the delist lands
        return;
      }
      if (!res.ok || !data?.ok) {
        setError(purchaseFailure("failed", paid));
        setPhase("error");
        return;
      }
      setResult({ explorerUrl: data.explorerUrl });
      setPhase("done");
    } catch {
      setError(purchaseFailure("failed", paid));
      setPhase("error");
    }
  }, [buyerWallet, tokenId, refetchPrice, sendTransaction, signMessage]);

  // Carry on from the sheet (see `autoStart`). The two refs make each step
  // happen once, whatever re-renders in between.
  const askedToSignIn = useRef(false);
  const startedPurchase = useRef(false);
  useEffect(() => {
    if (!autoStart || !ready) return;
    if (!authenticated) {
      if (!askedToSignIn.current) {
        askedToSignIn.current = true;
        login();
      }
      return;
    }
    if (buyerWallet && phase === "idle" && !startedPurchase.current) {
      startedPurchase.current = true;
      void buy();
    }
  }, [autoStart, ready, authenticated, buyerWallet, phase, login, buy]);

  const primaryBtn = PRIMARY_BUTTON;
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
        <>
          <p role="alert" className="text-center text-sm leading-5 text-bad">
            {error}
          </p>
          {isFailureAfterPayment(error) && (
            <a
              href={supportMailto(COPY.mail.paymentNotFinished(tokenId))}
              className="inline-flex min-h-[44px] items-center self-center text-sm font-semibold leading-5 text-brand-link underline underline-offset-2"
            >
              {COPY.actions.reportProblem}
            </a>
          )}
          {error === COPY.buy.noFunds && buyerWallet && (
            <details className="rounded-2xl border border-line">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center px-4 text-sm font-semibold leading-5 text-brand-link underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {COPY.buy.addFundsTitle}
              </summary>
              <div className="flex flex-col gap-2 px-4 pb-3.5 text-[13px] leading-[18px] text-body">
                <p>{COPY.buy.addFundsBody}</p>
                <p>
                  <span className="text-muted">{COPY.buy.addFundsAccount}</span>
                  <br />
                  <span className="font-mono [overflow-wrap:anywhere]">{buyerWallet}</span>
                </p>
                <a
                  href={TEST_FUNDS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center self-start font-semibold text-brand-link underline underline-offset-2"
                >
                  {COPY.buy.addFundsLink}
                </a>
              </div>
            </details>
          )}
        </>
      ) : (
        <p className={note}>
          {ready && !authenticated ? `${COPY.buy.signInNote} ` : ""}
          {demo ? COPY.buy.demoNote : ""}
        </p>
      )}

      {onChooseAnother && !working && (
        <button
          type="button"
          onClick={onChooseAnother}
          data-choose-another
          className="inline-flex min-h-[44px] items-center self-center text-sm font-semibold leading-5 text-brand-link underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {COPY.buy.chooseAnother}
        </button>
      )}
    </div>
  );
}
