"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buyFlowReducer,
  isDemoCheckout,
  methodsLine,
  offeredMethods,
  type BuyFlow,
  type BuyFlowEvent,
  type PayMethod,
} from "@/lib/buy-methods";
import { COPY } from "@/lib/consumer-copy";
import { fetchPriceFromProxy, isPurchasable, priceDisplay, type CanonicalPrice } from "@/lib/price";

import { BuySheet } from "./buy-sheet";
import { PRIMARY_BUTTON } from "./shared";

/**
 * "Buy now" and what follows it (TAP-T13): the button, the sheet that lists
 * the ways to pay, and the steps of the way that was chosen.
 *
 * PRICE COMES FROM THE SERVER ONLY (META-T17). On mount the widget fetches
 * GET /api/asset/[tokenId]/price (a pass-through to the tagit-services
 * pricing API) and renders NOTHING unless the response carries a live
 * purchase block (saleState 'listed'). There is no client-side price, no
 * default price, and no price prop — a page cannot inject one. The crypto
 * wallet's BuyButton re-fetches the same endpoint immediately before payment.
 *
 * THE WAYS TO PAY COME FROM THE SERVER TOO: the same response lists them (see
 * @/lib/buy-methods). With none on offer there is no button.
 *
 * PERF: the wallet stack (Privy + wagmi/viem, ~600 KB gzipped) is a lazy
 * chunk (./buy-checkout). It is not asked for until the sheet opens, so a
 * shopper who only checks a product never downloads it, and "Buy now" works
 * the moment the price is known. The crypto wallet needs
 * NEXT_PUBLIC_PRIVY_APP_ID; without it that way is not offered.
 */

const loadCheckout = () => import("./buy-checkout");

const BuyCheckout = dynamic(loadCheckout, {
  ssr: false,
  loading: () => <BuyPlaceholder />,
});

let placeholderDisplay = "";
function BuyPlaceholder() {
  return (
    <button type="button" disabled aria-busy="true" className={PRIMARY_BUTTON}>
      {placeholderDisplay ? COPY.buy.button(placeholderDisplay) : COPY.buy.buttonNoPrice}
    </button>
  );
}

const NOTE = "text-center text-[13px] leading-[18px] text-muted";

export function BuyWidget(props: { tokenId: string; productName: string }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const [price, setPrice] = useState<CanonicalPrice | null>(null);
  const [flow, setFlow] = useState<BuyFlow>({ step: "closed" });

  const refetchPrice = useCallback(async () => {
    const fresh = await fetchPriceFromProxy(props.tokenId);
    setPrice(fresh);
    return fresh;
  }, [props.tokenId]);

  useEffect(() => {
    void refetchPrice();
  }, [refetchPrice]);

  const offered = useMemo<PayMethod[]>(
    () => offeredMethods(price).filter((method) => method !== "crypto" || !!appId),
    [price, appId],
  );

  const send = useCallback(
    (event: BuyFlowEvent) => setFlow((state) => buyFlowReducer(state, event, offered)),
    [offered],
  );

  // Give the focus back to "Buy now" when the sheet closes. The browser does
  // this itself only if the button had the focus when the sheet opened, and
  // Safari does not focus a button that is pressed.
  const buyButton = useRef<HTMLButtonElement>(null);
  const sheetWasOpen = useRef(false);
  useEffect(() => {
    if (sheetWasOpen.current && flow.step === "closed") buyButton.current?.focus();
    sheetWasOpen.current = flow.step === "sheet";
  }, [flow.step]);

  const open = useCallback(() => {
    // Start fetching the wallet stack while the shopper reads the sheet.
    if (offered.includes("crypto")) void loadCheckout();
    send({ type: "open" });
  }, [offered, send]);

  // Hidden entirely when there is no live purchase block, or no way to pay.
  if (!isPurchasable(price) || offered.length === 0) return null;
  const display = priceDisplay(price);
  placeholderDisplay = display;
  const demo = isDemoCheckout(price);

  if (flow.step === "method" && flow.method === "crypto" && appId) {
    return (
      <BuyCheckout
        appId={appId}
        tokenId={props.tokenId}
        productName={props.productName}
        price={price}
        refetchPrice={refetchPrice}
        demo={demo}
        autoStart
        onChooseAnother={() => send({ type: "chooseAnother" })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={buyButton}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className={PRIMARY_BUTTON}
        data-buy-now
      >
        {display ? COPY.buy.button(display) : COPY.buy.buttonNoPrice}
      </button>
      <p className={NOTE}>
        {methodsLine(offered)}
        {demo ? (
          <>
            <br />
            {COPY.buy.demoNote}
          </>
        ) : null}
      </p>
      <BuySheet
        open={flow.step === "sheet"}
        methods={offered}
        priceDisplay={display}
        productName={props.productName}
        demo={demo}
        notice={flow.step === "sheet" ? flow.notice : undefined}
        onChoose={(method) => send({ type: "choose", method })}
        onClose={() => send({ type: "close" })}
      />
    </div>
  );
}
