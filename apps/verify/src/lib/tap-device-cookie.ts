/**
 * The id that lets one phone open its own tap link again (TAP-T10).
 *
 * A tap link shows its result once. So that a shopper who reloads the page is
 * not told their check expired, the phone that opened a link may open it again
 * for a few minutes. "The same phone" means: the browser that holds this id.
 *
 * What it is: 16 random bytes, made by the middleware the first time a tap
 * route is asked for, kept in a cookie the page's scripts cannot read, and
 * renewed on every tap request. It is not derived from anything about the
 * device or the visitor, it is sent only to this host, and it expires 15
 * minutes after the last tap. tagit-services is given a SHA-256 of it, never
 * the id (see @/lib/tap-device).
 *
 * It is not a login and proves nothing by itself: a link is still opened only
 * once. All the id can do is let the browser that opened a link look at that
 * same result again.
 *
 * Edge-safe (no Node imports): the middleware uses this file.
 */

/** Request header the middleware sets for the tap routes. Never trusted from a client. */
export const TAP_DEVICE_HEADER = "x-tap-device";

/**
 * How long the cookie lives after the last tap request. A little longer than
 * the time a link may be reopened (10 minutes, decided on the server side), so
 * the cookie never runs out first.
 */
export const TAP_DEVICE_MAX_AGE_SECONDS = 15 * 60;

/**
 * The cookie's name. Over https it carries the `__Host-` prefix: browsers then
 * accept it only from this exact host, with Secure and Path=/, so no other
 * site under the same domain can plant or replace it. Plain http (a developer
 * machine) cannot use that prefix.
 */
export function tapDeviceCookieName(secure: boolean): string {
  return secure ? "__Host-tap-device" : "tap-device";
}

const DEVICE_ID = /^[A-Za-z0-9_-]{22}$/;

/** True for an id this file could have made: 16 bytes, base64url, no padding. */
export function isTapDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID.test(value);
}

/** A new random id. */
export function newTapDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
