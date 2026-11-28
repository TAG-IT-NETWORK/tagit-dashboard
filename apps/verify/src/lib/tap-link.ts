import "server-only";

import { SERVICES_URL } from "./services";

/**
 * One-time tap links (TAP-T10): ask tagit-services whether this link is being
 * opened for the first time.
 *
 * A tag writes a counter into every link it makes, one higher on each tap.
 * tagit-services keeps, for each tag, the highest counter that was opened,
 * and answers one of:
 *
 *   fresh   first time this link is opened. It is now recorded as opened.
 *   again   the newest link, reopened by the device that opened it first,
 *           within a few minutes. The result may be shown again, marked as an
 *           earlier check.
 *   used    an older link, or the newest link on another device or too late.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: anything that is not one of those three
 * answers, exactly as specified, is "unavailable" — a missing key, a timeout,
 * a status other than 200, a body that does not parse, an answer this code
 * does not know. The caller then says it could not finish the check. Nothing
 * here can turn a failure into a pass, and there is no default answer.
 *
 * `server-only`: the call carries the services key, which never reaches a
 * browser. Only a tap whose code has already passed its check is ever sent
 * here (see @/lib/resolve), which is why the route on the other side trusts
 * what it is told.
 */

export type TapLinkUse =
  | { kind: "fresh" }
  | { kind: "again"; secondsAgo: number }
  | { kind: "used" }
  | { kind: "unavailable" };

export interface TapLinkRequest {
  /** keccak256 of the tag's UID, as @/lib/contract's uidToTagHash gives it. */
  tagHash: string;
  /** The item the tag belongs to, as a decimal string. */
  tokenId: string;
  /** The counter the tag wrote into this link. */
  counter: number;
  /** The requesting device (see @/lib/tap-device), or null when there is none. */
  device: string | null;
  /** The shopper's country (see @/lib/tap-country), for the brand's tap numbers. Optional. */
  country?: string | null;
}

/**
 * How long a tap waits for the answer. Generous for the same reason the item
 * record's limit is: a cold tagit-services function can take a few seconds to
 * start. When it runs out the tap ends as "could not finish the check".
 */
export const TAP_LINK_TIMEOUT_MS = 8_000;

export function tapLinkUrl(): string {
  return `${SERVICES_URL}/api/v1/tap-links/open`;
}

const UNAVAILABLE: TapLinkUse = { kind: "unavailable" };

/** One log line for a tap that could not be checked. Never the key, the tag or the device. */
function logFailure(why: string): void {
  console.error(JSON.stringify({ evt: "tap-link", unavailable: why }));
}

/** Read an answer strictly. Anything unexpected is "unavailable". */
export function readTapLinkAnswer(body: unknown): TapLinkUse {
  if (typeof body !== "object" || body === null) return UNAVAILABLE;
  const { outcome, openedSecondsAgo } = body as { outcome?: unknown; openedSecondsAgo?: unknown };
  if (outcome === "fresh") return { kind: "fresh" };
  if (outcome === "used") return { kind: "used" };
  if (
    outcome === "again" &&
    typeof openedSecondsAgo === "number" &&
    Number.isInteger(openedSecondsAgo) &&
    openedSecondsAgo >= 0
  ) {
    return { kind: "again", secondsAgo: openedSecondsAgo };
  }
  return UNAVAILABLE;
}

/**
 * Open a tap link. Never rejects: every failure is the answer "unavailable".
 */
export async function openTapLink(request: TapLinkRequest): Promise<TapLinkUse> {
  const key = process.env.SERVICES_API_KEY?.trim();
  if (!key) {
    logFailure("no services key on this server");
    return UNAVAILABLE;
  }
  try {
    const res = await fetch(tapLinkUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        tagHash: request.tagHash,
        tokenId: request.tokenId,
        counter: request.counter,
        device: request.device,
        // Sent only when known. It decides nothing about the tap.
        ...(request.country ? { country: request.country } : {}),
      }),
      // A tap's answer is for that tap alone. Never stored, never reused.
      cache: "no-store",
      signal: AbortSignal.timeout(TAP_LINK_TIMEOUT_MS),
    });
    if (res.status !== 200) {
      logFailure(`status ${res.status}`);
      return UNAVAILABLE;
    }
    const answer = readTapLinkAnswer(await res.json());
    if (answer.kind === "unavailable") logFailure("answer not understood");
    return answer;
  } catch (err) {
    logFailure(
      err instanceof Error && err.name === "TimeoutError" ? "timed out" : "request failed",
    );
    return UNAVAILABLE;
  }
}

// ── Is the store there? ──────────────────────────────────────────────────────

export function tapLinkReadyUrl(): string {
  return `${SERVICES_URL}/api/v1/tap-links/ready`;
}

export interface TapLinkStoreState {
  /** True only when tagit-services answered `{ ok: true }` to this server's key. */
  ready: boolean;
  /** The status it answered with, or null when it did not answer (or there is no key). */
  status: number | null;
}

/**
 * Ask tagit-services whether the one-time store can be used by this server:
 * the route is deployed, this server's key passes its gate, and its table can
 * be read. Nothing is written.
 *
 * Why it exists: when any of those three is wrong, every tap ends as "We
 * couldn't finish the check" — the safe side, but a broken product. The
 * keep-warm run asks this every minute (see /api/warm), so the state is on
 * record before a shopper finds out, and it is the first thing to look at
 * after a release.
 *
 * Never rejects. The answer says nothing about any tag or any tap.
 */
export async function tapLinkStoreState(): Promise<TapLinkStoreState> {
  const key = process.env.SERVICES_API_KEY?.trim();
  if (!key) return { ready: false, status: null };
  try {
    const res = await fetch(tapLinkReadyUrl(), {
      headers: { accept: "application/json", authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TAP_LINK_TIMEOUT_MS),
    });
    if (res.status !== 200) return { ready: false, status: res.status };
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return { ready: body?.ok === true, status: 200 };
  } catch {
    return { ready: false, status: null };
  }
}
