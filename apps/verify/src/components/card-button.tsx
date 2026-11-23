"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { startCardCheckout } from "@/lib/card-checkout";
import { COPY } from "@/lib/consumer-copy";
import { priceDisplay, type CanonicalPrice } from "@/lib/price";

import { PRIMARY_BUTTON } from "./shared";

/**
 * "Pay by card" (TAP-T14): the step between the sheet and the card page.
 *
 * The shopper chose Card in the sheet, so this carries on without a second
 * press: sign in with an email when they are not signed in (the item is
 * registered to that account), ask this app's server for a checkout page, and
 * go there. Nothing is paid on this page and no card detail ever touches it.
 *
 * The steps themselves are startCardCheckout() in @/lib/card-checkout: the
 * price and the offer are re-read first, no price is sent, and the buyer is
 * only ever sent to the provider's own checkout host. This component is the
 * sign-in and the button around them.
 *
 * What happens after the payment is the return panel's business
 * (./order-return), on the item's own page.
 */

type Phase = "idle" | "opening" | "leaving" | "error";

interface CardButtonProps {
  tokenId: string;
  productName: string;
  price: CanonicalPrice;
  refetchPrice: () => Promise<CanonicalPrice | null>;
  demo?: boolean;
  onChooseAnother?: () => void;
  /** Leaves for the card page. A seam for tests; the default is the real thing. */
  navigate?: (url: string) => void;
}

const leave = (url: string) => window.location.assign(url);

export function CardButton({
  tokenId,
  productName,
  price,
  refetchPrice,
  demo = true,
  onChooseAnother,
  navigate = leave,
}: CardButtonProps) {
  const { ready, authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const display = priceDisplay(price) || "—";

  const buyerWallet = useMemo(() => {
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    return embedded?.address ?? user?.wallet?.address ?? null;
  }, [wallets, user]);

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("error");
  }, []);

  const start = useCallback(async () => {
    if (!buyerWallet) {
      fail(COPY.buy.notReady);
      return;
    }
    setError(null);
    setPhase("opening");
    const result = await startCardCheckout({ tokenId, buyerWallet, productName, refetchPrice });
    if (!result.ok) {
      fail(result.message);
      // The widget hides itself once the listing is gone.
      if (result.refetch) void refetchPrice();
      return;
    }
    setPhase("leaving");
    navigate(result.url);
  }, [buyerWallet, tokenId, productName, refetchPrice, navigate, fail]);

  // Carry on from the sheet. The two refs make each step happen once,
  // whatever re-renders in between. A shopper who closes the sign-in is left
  // with the button.
  const askedToSignIn = useRef(false);
  const started = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      if (!askedToSignIn.current) {
        askedToSignIn.current = true;
        login();
      }
      return;
    }
    if (buyerWallet && phase === "idle" && !started.current) {
      started.current = true;
      void start();
    }
  }, [ready, authenticated, buyerWallet, phase, login, start]);

  // The browser's Back button from the card page can bring this page back
  // exactly as it was left: busy, for good. Give the button back.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPhase((now) => (now === "leaving" ? "idle" : now));
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const working = phase === "opening" || phase === "leaving";
  const label = COPY.buy.button(display);
  const note = "text-center text-[13px] leading-[18px] text-muted";

  return (
    <div className="flex flex-col gap-2" data-card-checkout>
      {!ready ? (
        <button type="button" disabled aria-busy="true" className={PRIMARY_BUTTON}>
          {label}
        </button>
      ) : !authenticated ? (
        <button type="button" onClick={login} className={PRIMARY_BUTTON}>
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={working || !buyerWallet}
          aria-busy={working || !buyerWallet}
          className={PRIMARY_BUTTON}
        >
          {working ? COPY.buy.card.opening : !buyerWallet ? COPY.buy.preparing : label}
        </button>
      )}

      {phase === "error" && error ? (
        <p role="alert" className="text-center text-sm leading-5 text-bad">
          {error}
        </p>
      ) : (
        <p className={note}>
          {ready && !authenticated ? `${COPY.buy.signInNote} ` : ""}
          {demo ? COPY.buy.card.demoCard : ""}
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
