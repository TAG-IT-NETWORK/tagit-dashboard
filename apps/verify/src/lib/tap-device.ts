import "server-only";

import { createHash } from "node:crypto";

import { TAP_DEVICE_HEADER, isTapDeviceId } from "./tap-device-cookie";

/**
 * The requesting device, as the one-time link store is told about it
 * (TAP-T10): a SHA-256 of the id the middleware keeps in a cookie, or null
 * when the request carries no usable id.
 *
 * The id itself stops here. What leaves this server, and what is stored, is
 * the hash: enough to tell "the same browser as before", and nothing that
 * could be replayed as the cookie.
 *
 * Null is a safe answer, not an error. A tap with no device is still checked
 * and still opens its link once; it just cannot be opened a second time.
 */
export function tapDeviceOf(headers: Pick<Headers, "get">): string | null {
  const id = headers.get(TAP_DEVICE_HEADER);
  if (!isTapDeviceId(id)) return null;
  return createHash("sha256").update(id).digest("hex");
}
