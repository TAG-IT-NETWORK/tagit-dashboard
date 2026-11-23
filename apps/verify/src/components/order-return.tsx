"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  askOrderFromProxy,
  firstOrderView,
  parseOrderReturn,
  watchOrder,
  type OrderReturn as OrderReturnParams,
  type OrderView,
} from "@/lib/card-checkout";
import { COPY, supportMailto } from "@/lib/consumer-copy";

/**
 * The way back from the card page (TAP-T14).
 *
 * The card page returns the buyer to the item's page with `?order=ord_…`.
 * That address PROVES NOTHING and this panel treats it so: it only tells the
 * panel which order to ask about. What it then says is this app's server's
 * answer about that order, and nothing is said about a payment until the
 * server says it. An order for another item is not shown at all.
 *
 * The payment provider tells tagit-services about a payment by itself, a
 * moment after the buyer is sent back, so the panel asks again every few
 * seconds until the order is settled one way or the other, or it has asked
 * for a minute and a half. A buyer who is told nothing certain is told not to
 * pay again.
 *
 * Renders nothing on an ordinary visit.
 */

export function OrderReturn({
  tokenId,
  productName,
  onView,
}: {
  tokenId: string;
  productName: string;
  /** Told of every view, so the page can keep "Buy now" away while an order is open. */
  onView?: (view: OrderView) => void;
}) {
  const router = useRouter();
  const [params, setParams] = useState<OrderReturnParams | null>(null);
  const [view, setView] = useState<OrderView>({ kind: "none" });

  // Read the address after mount: the page itself is rendered without it.
  useEffect(() => {
    const found = parseOrderReturn(window.location.search);
    setParams(found);
    setView(firstOrderView(found));
  }, []);

  useEffect(() => {
    onView?.(view);
  }, [view, onView]);

  useEffect(() => {
    if (!params || params.cancelled) return;
    return watchOrder({
      orderId: params.orderId,
      tokenId,
      ask: askOrderFromProxy,
      show: setView,
      onRegistered: () => router.refresh(),
    });
  }, [params, tokenId, router]);

  return <OrderPanel view={view} tokenId={tokenId} productName={productName} />;
}

/** What the panel says for a view. No state of its own. */
export function OrderPanel({
  view,
  tokenId,
  productName,
}: {
  view: OrderView;
  tokenId: string;
  productName: string;
}) {
  if (view.kind === "none") return null;

  const good = "flex flex-col gap-1 rounded-2xl border border-ok-line bg-ok-bg p-4";
  const plain = "flex flex-col gap-1 rounded-2xl border border-line p-4";
  const report = (
    <a
      href={supportMailto(COPY.mail.paymentNotFinished(tokenId))}
      className="inline-flex min-h-[44px] items-center self-start text-sm font-semibold leading-5 text-brand-link underline underline-offset-2"
    >
      {COPY.actions.reportProblem}
    </a>
  );

  if (view.kind === "cancelled") {
    return (
      <div role="status" className={plain} data-order-return="cancelled">
        <p className="text-sm leading-5 text-body">{COPY.buy.card.cancelled}</p>
      </div>
    );
  }
  if (view.kind === "asking") {
    return (
      <div role="status" aria-busy="true" className={plain} data-order-return="asking">
        <p className="text-sm leading-5 text-body">{COPY.buy.card.confirming}</p>
      </div>
    );
  }
  if (view.kind === "slow" || view.kind === "unknown") {
    return (
      <div role="alert" className={plain} data-order-return={view.kind}>
        <p className="text-sm leading-5 text-body">
          {view.kind === "slow" ? COPY.buy.card.slow : COPY.buy.card.unknown}
        </p>
        {report}
      </div>
    );
  }

  const { state, onRegistry } = view.order;
  if (state === "registered") {
    return (
      <div role="status" className={good} data-order-return="registered">
        <p className="text-lg font-bold leading-6 text-ok">
          {onRegistry ? COPY.buy.successTitle : COPY.buy.card.receivedTitle}
        </p>
        <p className="text-sm leading-5 text-body">
          {onRegistry ? COPY.buy.successBody(productName) : COPY.buy.card.recorded(productName)}
        </p>
      </div>
    );
  }
  if (state === "paid") {
    return (
      <div role="status" aria-busy="true" className={good} data-order-return="paid">
        <p className="text-lg font-bold leading-6 text-ok">{COPY.buy.card.receivedTitle}</p>
        <p className="text-sm leading-5 text-body">{COPY.buy.card.registering}</p>
      </div>
    );
  }
  if (state === "problem") {
    return (
      <div role="alert" className={plain} data-order-return="problem">
        <p className="text-sm leading-5 text-body">{COPY.buy.card.problem}</p>
        {report}
      </div>
    );
  }
  if (state === "expired") {
    return (
      <div role="status" className={plain} data-order-return="expired">
        <p className="text-sm leading-5 text-body">{COPY.buy.card.expired}</p>
      </div>
    );
  }
  // "waiting": the buyer is back, the provider's message is not here yet.
  return (
    <div role="status" aria-busy="true" className={plain} data-order-return="waiting">
      <p className="text-sm leading-5 text-body">{COPY.buy.card.confirming}</p>
    </div>
  );
}
