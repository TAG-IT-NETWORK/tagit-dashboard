/**
 * Card checkout, shopper side (TAP-T14): the pure parts.
 *
 * The page never talks to the payment provider and never decides anything
 * about an order. It asks this app's server for a checkout page
 * (POST /api/checkout), sends the buyer there, and on the way back asks what
 * became of the order (GET /api/checkout/orders/:id). tagit-services makes
 * the order, sets the price, and learns of the payment from the provider's
 * signed message; the return address proves nothing.
 *
 * A plain module, neither "server" nor "client": the routes, the components
 * and the tests all read it. It must stay free of server-only imports, because
 * the browser loads it; what only the server route needs is in
 * ./card-checkout-request.
 */

import { offeredMethods } from "./buy-methods";
import { COPY } from "./consumer-copy";
import { isPurchasable, type CanonicalPrice } from "./price";

/** tagit-services' order id: "ord_" and 26 characters of its own alphabet. */
const ORDER_ID = /^ord_[0-9A-Z]{26}$/;

export function isOrderId(value: unknown): value is string {
  return typeof value === "string" && ORDER_ID.test(value);
}

/** The only place a buyer is ever sent to pay. */
const CHECKOUT_HOST = "checkout.stripe.com";

/**
 * The checkout address, if it is one a buyer may be sent to: https, the
 * provider's own checkout host, no credentials, no odd port. Anything else is
 * null, and the buyer goes nowhere. Checked on the server before the address
 * is handed to the page, and by the page again before it leaves.
 */
export function safeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== CHECKOUT_HOST) return null;
  if (url.username || url.password || url.port) return null;
  return url.toString();
}

/** The failure codes of POST /api/checkout the page tells apart. */
export type CheckoutFailure = "NOT_OFFERED" | "NOT_FOR_SALE" | "UNAVAILABLE";

/** Upstream's code, reduced to what the page may know. Never its text. */
export function checkoutFailure(upstreamCode: unknown): CheckoutFailure {
  if (upstreamCode === "CARD_NOT_OFFERED" || upstreamCode === "CARD_CHECKOUT_OFF") {
    return "NOT_OFFERED";
  }
  if (upstreamCode === "NOT_FOR_SALE") return "NOT_FOR_SALE";
  return "UNAVAILABLE";
}

/** Checkout pages asked for per address per window. A buyer needs one or two. */
export const CHECKOUT_RATE_LIMIT = 6;
export const CHECKOUT_RATE_WINDOW_SECONDS = 60;
/** Order questions per address per window: the return page asks every few seconds. */
export const ORDER_RATE_LIMIT = 60;
export const ORDER_RATE_WINDOW_SECONDS = 60;

// ── Leaving for the card page ────────────────────────────────────────────────

export type CardStart =
  | { ok: true; url: string }
  /** `refetch`: the listing is gone, so the price should be read again. */
  | { ok: false; message: string; refetch?: boolean };

/**
 * Everything between "the buyer chose Card and is signed in" and "go to this
 * address", as one function with nothing of the browser in it.
 *
 * The price and the offer are read again first: signing in can take minutes,
 * and a listing that was sold, or a way to pay that was withdrawn meanwhile,
 * sends nobody to a card page. No price is sent: the amount on the card page
 * is tagit-services' own.
 */
export async function startCardCheckout(input: {
  tokenId: string;
  buyerWallet: string;
  productName: string;
  refetchPrice: () => Promise<CanonicalPrice | null>;
  fetchImpl?: typeof fetch;
}): Promise<CardStart> {
  const unavailable: CardStart = { ok: false, message: COPY.buy.card.unavailable };
  try {
    const fresh = await input.refetchPrice();
    if (!isPurchasable(fresh)) return { ok: false, message: COPY.buy.justSold };
    if (!offeredMethods(fresh).includes("card")) {
      return { ok: false, message: COPY.buy.methodWithdrawn };
    }
    const res = await (input.fetchImpl ?? fetch)("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tokenId: input.tokenId,
        buyerWallet: input.buyerWallet,
        productName: input.productName,
      }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || data?.ok !== true) {
      if (data?.code === "NOT_FOR_SALE") {
        return { ok: false, message: COPY.buy.justSold, refetch: true };
      }
      if (data?.code === "NOT_OFFERED") return { ok: false, message: COPY.buy.methodWithdrawn };
      return unavailable;
    }
    const url = safeCheckoutUrl(data.url);
    return url ? { ok: true, url } : unavailable;
  } catch {
    return unavailable;
  }
}

// ── The way back ─────────────────────────────────────────────────────────────

export interface OrderReturn {
  orderId: string;
  /**
   * The address says the buyer pressed "back" on the checkout page. A hint
   * about what to say for an unpaid order, and nothing more (see watchOrder).
   */
  cancelled: boolean;
}

/** `?order=ord_…` (and `&cancelled=1`) on the item's page, or null. */
export function parseOrderReturn(search: string): OrderReturn | null {
  const params = new URLSearchParams(search);
  const orderId = params.get("order");
  if (!isOrderId(orderId)) return null;
  return { orderId, cancelled: params.get("cancelled") === "1" };
}

export type OrderState = "waiting" | "paid" | "registered" | "problem" | "expired";

export interface OrderAnswer {
  orderId: string;
  tokenId: string;
  state: OrderState;
  onRegistry: boolean;
}

const ORDER_STATES: readonly OrderState[] = ["waiting", "paid", "registered", "problem", "expired"];

/**
 * tagit-services' answer about an order, or null when it is not one: a state
 * this page does not know is not guessed at.
 */
export function parseOrderAnswer(value: unknown): OrderAnswer | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!isOrderId(raw.orderId) || typeof raw.tokenId !== "string" || !/^\d+$/.test(raw.tokenId)) {
    return null;
  }
  if (!ORDER_STATES.includes(raw.state as OrderState)) return null;
  return {
    orderId: raw.orderId,
    tokenId: raw.tokenId,
    state: raw.state as OrderState,
    onRegistry: raw.onRegistry === true,
  };
}

/** Whether the return page is done asking. */
export function isFinalOrderState(state: OrderState): boolean {
  return state === "registered" || state === "problem" || state === "expired";
}

/** How long the return page keeps asking, and how often. */
export const ORDER_POLL_MS = 2500;
export const ORDER_POLL_LIMIT = 36; // 90 seconds

/** What the return panel shows. */
export type OrderView =
  | { kind: "none" }
  | { kind: "cancelled" }
  | { kind: "asking" }
  | { kind: "order"; order: OrderAnswer }
  /** Asked for the whole time; the order is known but not settled. */
  | { kind: "slow" }
  /** Asked for the whole time and never got an answer. */
  | { kind: "unknown" };

/**
 * The first thing to show for a return address, before anything is asked.
 * Never "cancelled": that word in the address is the buyer's browser's, and
 * an old tab or an edited address can carry it for an order that was paid.
 * "You haven't been charged" is said only after the server has answered.
 */
export function firstOrderView(found: OrderReturn | null): OrderView {
  return found ? { kind: "asking" } : { kind: "none" };
}

/**
 * Whether "Buy now" must stay off the page while this view is shown. A buyer
 * who is back from the card page is not offered the same item again until
 * their order is known to have taken no money: the listing can still read
 * "for sale" for a moment after the payment, and a second payment for one
 * item is the worst thing this page could invite.
 */
export function orderBlocksBuying(view: OrderView): boolean {
  if (view.kind === "none" || view.kind === "cancelled") return false;
  if (view.kind === "order") return view.order.state !== "expired";
  return true; // asking, slow, unknown
}

/** One question about an order: its answer, "missing" (no such order), or null (no answer). */
export type AskOrder = (orderId: string) => Promise<OrderAnswer | "missing" | null>;

export const askOrderFromProxy: AskOrder = async (orderId) => {
  try {
    const res = await fetch(`/api/checkout/orders/${orderId}`, { cache: "no-store" });
    if (res.status === 404) return "missing";
    if (!res.ok) return null;
    return parseOrderAnswer(await res.json().catch(() => null));
  } catch {
    return null;
  }
};

/**
 * Asks about an order until it is settled, or the limit is reached. Returns
 * the function that stops it.
 *
 *   no such order, or an order for another item   show nothing, stop
 *   registered / problem / expired                show it, stop
 *   waiting, and the buyer came back "cancelled"  say so, stop: the server
 *                                                 confirms nothing was paid
 *   waiting / paid                                show it, ask again
 *   no answer                                     keep what is shown, ask again
 *   the limit                                     "slow" if the order was ever
 *                                                 seen, "unknown" if it never was
 */
export function watchOrder(input: {
  orderId: string;
  tokenId: string;
  /** The address said the buyer left without paying. Believed only for an order the server calls unpaid. */
  cancelled?: boolean;
  ask: AskOrder;
  show: (view: OrderView) => void;
  /** Called once, when the order is registered: the page's record is older than the payment. */
  onRegistered?: () => void;
  limit?: number;
  intervalMs?: number;
  schedule?: (run: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}): () => void {
  const limit = input.limit ?? ORDER_POLL_LIMIT;
  const intervalMs = input.intervalMs ?? ORDER_POLL_MS;
  const schedule = input.schedule ?? ((run, ms) => setTimeout(run, ms));
  const cancel =
    input.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let stopped = false;
  let handle: unknown;
  let asked = 0;
  let seen = false;

  const once = async () => {
    const answer = await input.ask(input.orderId);
    if (stopped) return;
    asked += 1;
    if (answer === "missing" || (answer && answer.tokenId !== input.tokenId)) {
      input.show({ kind: "none" });
      return;
    }
    if (answer) {
      seen = true;
      if (input.cancelled && answer.state === "waiting") {
        input.show({ kind: "cancelled" });
        return;
      }
      input.show({ kind: "order", order: answer });
      if (isFinalOrderState(answer.state)) {
        if (answer.state === "registered") input.onRegistered?.();
        return;
      }
    }
    if (asked >= limit) {
      input.show({ kind: seen ? "slow" : "unknown" });
      return;
    }
    handle = schedule(() => void once(), intervalMs);
  };
  void once();

  return () => {
    stopped = true;
    if (handle !== undefined) cancel(handle);
  };
}
