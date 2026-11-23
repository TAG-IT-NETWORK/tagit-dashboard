/**
 * What POST /api/buy accepts (TAP-T15), as one pure function.
 *
 * The route used to forward any `{ tokenId, buyerWallet }` to the settle
 * route, with this server's own keys attached, and an optional payment hash.
 * Now a request must bring its proof: the transaction hash of a USDC payment,
 * or a demo order signed by the buyer's wallet. Without one it is refused
 * HERE, with 402, and nothing is sent upstream. (tagit-services refuses the
 * same request by itself; this is the nearer of two locks, not the only one.)
 *
 * Nothing is trusted because it has the right shape: the payment is verified
 * on-chain and the signature is checked by tagit-services.
 */

import type { DemoOrder } from "./demo-order";
import { parseTokenId } from "./verdict";

export interface BuyRequest {
  tokenId: string;
  buyerWallet: string;
  paymentTxHash?: string;
  priceUsdc?: number;
  demoOrder?: DemoOrder;
}

export type ParsedBuyRequest =
  | { ok: true; value: BuyRequest }
  | { ok: false; status: 400 | 402; code: "INVALID_REQUEST" | "PAYMENT_REQUIRED" };

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const SIGNATURE = /^0x[0-9a-fA-F]{130}$/;

function parseDemoOrder(value: unknown): DemoOrder | null {
  if (typeof value !== "object" || value === null) return null;
  const { expires, signature } = value as Record<string, unknown>;
  if (typeof expires !== "number" || !Number.isSafeInteger(expires) || expires <= 0) return null;
  if (typeof signature !== "string" || !SIGNATURE.test(signature)) return null;
  return { expires, signature };
}

export function parseBuyRequest(body: unknown): ParsedBuyRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  const raw = body as Record<string, unknown>;
  // The same reading of an item number as everywhere else in this app (any
  // uint256, as a decimal string). A narrower one here would refuse an item
  // the page could show, after the buyer had already paid for it.
  const parsedId = typeof raw.tokenId === "string" ? parseTokenId(raw.tokenId) : null;
  const buyerWallet = typeof raw.buyerWallet === "string" ? raw.buyerWallet : "";
  if (parsedId === null || !ADDRESS.test(buyerWallet)) {
    return { ok: false, status: 400, code: "INVALID_REQUEST" };
  }
  const tokenId = parsedId.toString();

  // A proof that is present but malformed is a bad request, not a missing one.
  if (raw.paymentTxHash !== undefined && raw.paymentTxHash !== null) {
    if (typeof raw.paymentTxHash !== "string" || !TX_HASH.test(raw.paymentTxHash)) {
      return { ok: false, status: 400, code: "INVALID_REQUEST" };
    }
    const priceUsdc =
      typeof raw.priceUsdc === "number" && Number.isFinite(raw.priceUsdc) && raw.priceUsdc > 0
        ? raw.priceUsdc
        : undefined;
    // With a payment, a demo order sent beside it is dropped: the payment is the proof.
    return {
      ok: true,
      value: { tokenId, buyerWallet, paymentTxHash: raw.paymentTxHash, priceUsdc },
    };
  }
  if (raw.demoOrder !== undefined && raw.demoOrder !== null) {
    const demoOrder = parseDemoOrder(raw.demoOrder);
    if (!demoOrder) return { ok: false, status: 400, code: "INVALID_REQUEST" };
    return { ok: true, value: { tokenId, buyerWallet, demoOrder } };
  }
  return { ok: false, status: 402, code: "PAYMENT_REQUIRED" };
}

/** Purchase attempts per IP per window. A person buying needs one or two. */
export const BUY_RATE_LIMIT = 10;
export const BUY_RATE_WINDOW_SECONDS = 60;
