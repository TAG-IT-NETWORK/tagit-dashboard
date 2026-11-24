/**
 * What POST /api/checkout accepts (TAP-T14). Server side only: it reads an
 * item number the way the rest of this server does (./verdict), which the
 * browser must not load. Everything the page itself needs is in
 * ./card-checkout.
 */

import { parseTokenId } from "./verdict";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface CheckoutRequest {
  tokenId: string;
  buyerWallet: string;
  productName?: string;
}

/** What POST /api/checkout accepts. Only these three fields go upstream. */
export function parseCheckoutRequest(body: unknown): CheckoutRequest | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;
  const parsedId = typeof raw.tokenId === "string" ? parseTokenId(raw.tokenId) : null;
  // tagit-services takes ids of up to 18 digits for a card order. A longer one
  // is refused here, before a request is spent on it.
  if (parsedId === null || parsedId <= 0n || parsedId.toString().length > 18) return null;
  if (typeof raw.buyerWallet !== "string" || !ADDRESS.test(raw.buyerWallet)) return null;
  const name = typeof raw.productName === "string" ? raw.productName.trim().slice(0, 120) : "";
  return {
    tokenId: parsedId.toString(),
    buyerWallet: raw.buyerWallet,
    ...(name ? { productName: name } : {}),
  };
}
