/**
 * A demo order: how a demo item is taken without a payment (TAP-T15).
 *
 * tagit-services moves ownership only for a verified USDC payment or for a
 * demo order, and the price endpoint says which one an item takes
 * (`purchase.proof`). A demo order is this text, signed by the buyer's own
 * wallet. The server builds the same text to check the signature
 * (tagit-services src/sale/demo-order.ts), so not a character of it may
 * differ: a golden vector on both sides pins it.
 *
 * A plain module: the buy button builds the text, the buy route checks the
 * shape of what it is sent.
 */

import { getAddress } from "viem";

/** How long a freshly signed order stays good. The server takes at most 15 minutes. */
export const DEMO_ORDER_LIFETIME_SECONDS = 10 * 60;

export interface DemoOrder {
  /** Unix seconds after which the order is no longer taken. */
  expires: number;
  /** The buyer wallet's signature over demoOrderMessage(). */
  signature: string;
}

export function demoOrderMessage(order: {
  tokenId: string;
  buyer: string;
  chainId: number;
  expires: number;
}): string {
  return [
    "TAG IT demo order",
    `Item: ${BigInt(order.tokenId).toString()}`,
    `Buyer: ${getAddress(order.buyer)}`,
    `Network: ${order.chainId}`,
    `Expires: ${order.expires}`,
    "No payment is made. This registers the demo item to the buyer.",
  ].join("\n");
}
