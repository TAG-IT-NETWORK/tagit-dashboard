/**
 * The ways to pay for an item (TAP-T13).
 *
 * THE SERVER DECIDES WHICH ARE OFFERED. The price endpoint's purchase block
 * lists them (`purchase.methods`) and says whether the checkout is a demo
 * (`purchase.demo`). The sheet shows exactly that list, in one fixed order,
 * and nothing it does not know how to draw. A page cannot add a method.
 *
 * A plain module, neither "server" nor "client": the widget, the sheet and
 * the tests all read it.
 */

import { COPY } from "./consumer-copy";
import type { CanonicalPrice } from "./price";

export type PayMethod = "card" | "paypal" | "crypto";

/** The order of the rows in the sheet, whatever order the server sends. */
export const PAY_METHOD_ORDER: readonly PayMethod[] = ["card", "paypal", "crypto"];

/** Base Sepolia: a public test network, so nothing paid there is real money. */
const TEST_CHAIN_ID = 84532;

const isPayMethod = (value: unknown): value is PayMethod =>
  typeof value === "string" && (PAY_METHOD_ORDER as readonly string[]).includes(value);

/**
 * The methods to offer for a price, in sheet order, each at most once.
 *
 *   no live purchase block        none (nothing is for sale)
 *   `methods` is a list           the ones in it that we know; an empty or
 *                                 all-unknown list means none
 *   `methods` is missing          the crypto wallet alone: what a server from
 *                                 before this field offers
 *   `methods` is anything else    none (we do not guess)
 */
export function offeredMethods(price: CanonicalPrice | null | undefined): PayMethod[] {
  const purchase = price?.saleState === "listed" ? price.purchase : undefined;
  if (!purchase) return [];
  const raw: unknown = purchase.methods;
  if (raw === undefined) return ["crypto"];
  if (!Array.isArray(raw)) return [];
  return PAY_METHOD_ORDER.filter((method) => raw.includes(method) && isPayMethod(method));
}

/**
 * Whether to say "Demo checkout. No real money is charged." The server's word
 * when it gives one; from a server that does not, the network decides: a
 * payment on the public test network is never real money.
 */
export function isDemoCheckout(price: CanonicalPrice | null | undefined): boolean {
  const purchase = price?.purchase;
  if (!purchase) return false;
  if (typeof purchase.demo === "boolean") return purchase.demo;
  return purchase.chainId === TEST_CHAIN_ID;
}

/** "Pay by card, PayPal or crypto wallet", for the methods that are offered. */
export function methodsLine(methods: readonly PayMethod[]): string {
  const names = PAY_METHOD_ORDER.filter((method) => methods.includes(method)).map(
    (method) => COPY.buy.methodNames[method],
  );
  if (names.length === 0) return "";
  if (names.length === 1) return `${COPY.buy.payBy} ${names[0]}`;
  return `${COPY.buy.payBy} ${names.slice(0, -1).join(", ")} ${COPY.buy.or} ${names[names.length - 1]}`;
}

/**
 * Where the buy flow is. One small state machine, so the widget only wires it.
 *
 *   closed   the "Buy now" button
 *   sheet    the list of ways to pay is open
 *   method   one way was chosen; its own steps run where the button was
 */
export type BuyFlow =
  | { step: "closed" }
  | { step: "sheet"; notice?: string }
  | { step: "method"; method: PayMethod };

export type BuyFlowEvent =
  | { type: "open" }
  | { type: "close" }
  | { type: "choose"; method: PayMethod }
  | { type: "chooseAnother" };

/** The methods this build can take a payment with. PayPal is not one yet. */
export const READY_METHODS: readonly PayMethod[] = ["card", "crypto"];

/**
 * The methods that need the buyer signed in to their account here: the item is
 * registered to that account, whichever way it is paid for. Without the
 * sign-in service configured, these are not offered.
 */
export const SIGN_IN_METHODS: readonly PayMethod[] = ["card", "crypto"];

export function buyFlowReducer(
  state: BuyFlow,
  event: BuyFlowEvent,
  offered: readonly PayMethod[],
): BuyFlow {
  switch (event.type) {
    case "open":
    case "chooseAnother":
      return offered.length > 0 ? { step: "sheet" } : { step: "closed" };
    case "close":
      // Closing the sheet. A method that is already running is not a sheet.
      return state.step === "sheet" ? { step: "closed" } : state;
    case "choose":
      if (state.step !== "sheet" || !offered.includes(event.method)) return state;
      if (!READY_METHODS.includes(event.method)) {
        return { step: "sheet", notice: COPY.buy.methodUnavailable };
      }
      return { step: "method", method: event.method };
  }
}
