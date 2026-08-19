/**
 * Verification helpers for POST /api/revalidate (tagit-services → verify
 * cache-bust webhook). Pure/deterministic so every rule is unit-testable.
 *
 * Wire contract (tagit-services src/lib/revalidate.ts):
 *   POST body: {"id": uuid, "event": name, "tokenIds": ["5", ...], "ts": ms}
 *   X-TagIt-Signature: HMAC-SHA256 hex of the RAW JSON body, keyed with
 *   REVALIDATE_WEBHOOK_SECRET.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Reject events whose ts is further than this from our clock (replay window). */
export const MAX_SKEW_MS = 5 * 60 * 1000;

/** HMAC-SHA256 hex digest of the raw body — mirror of the emitter's signer. */
export function signBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Timing-safe signature check over the RAW request body. Returns false for a
 * missing/malformed header rather than throwing — the route maps false to 401.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !/^[0-9a-f]{64}$/i.test(signatureHeader)) return false;
  const expected = Buffer.from(signBody(rawBody, secret), "hex");
  const provided = Buffer.from(signatureHeader.toLowerCase(), "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export interface RevalidatePayload {
  id: string;
  event: string;
  tokenIds: string[];
  ts: number;
}

export type PayloadParse =
  | { ok: true; payload: RevalidatePayload }
  | { ok: false; error: "malformed" | "stale" };

/** Parse + validate a signed payload. `now` injectable for tests. */
export function parseRevalidatePayload(
  rawBody: string,
  now: number = Date.now(),
  maxSkewMs: number = MAX_SKEW_MS,
): PayloadParse {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (typeof json !== "object" || json === null) return { ok: false, error: "malformed" };
  const body = json as Record<string, unknown>;
  if (typeof body.id !== "string" || body.id.length === 0 || body.id.length > 200) {
    return { ok: false, error: "malformed" };
  }
  if (typeof body.event !== "string") return { ok: false, error: "malformed" };
  if (
    !Array.isArray(body.tokenIds) ||
    body.tokenIds.length === 0 ||
    body.tokenIds.length > 1000 ||
    !body.tokenIds.every((t): t is string => typeof t === "string" && /^\d+$/.test(t))
  ) {
    return { ok: false, error: "malformed" };
  }
  if (typeof body.ts !== "number" || !Number.isFinite(body.ts)) {
    return { ok: false, error: "malformed" };
  }
  if (Math.abs(now - body.ts) > maxSkewMs) return { ok: false, error: "stale" };
  return {
    ok: true,
    payload: { id: body.id, event: body.event, tokenIds: body.tokenIds, ts: body.ts },
  };
}

/**
 * In-memory LRU of recently seen event ids — duplicate delivery (the emitter
 * retries on non-2xx AND on network flaps that lost only the response) must
 * not re-bust caches or be replayable inside the skew window.
 */
export class ReplayGuard {
  private readonly seen = new Map<string, true>();

  constructor(private readonly maxEntries: number = 4096) {}

  /** True if `id` was already seen; otherwise records it and returns false. */
  seenBefore(id: string): boolean {
    if (this.seen.has(id)) {
      // Refresh recency so a hot id is not evicted while still being replayed.
      this.seen.delete(id);
      this.seen.set(id, true);
      return true;
    }
    this.seen.set(id, true);
    if (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return false;
  }

  get size(): number {
    return this.seen.size;
  }
}
