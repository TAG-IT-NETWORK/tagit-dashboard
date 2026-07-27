/**
 * Best-effort per-IP rate limiting for the token-id read path.
 *
 * HONESTY NOTE — READ THIS BEFORE YOU TRUST IT
 * ────────────────────────────────────────────
 * The default store is an in-process `Map`. On Vercel (and any serverless or
 * multi-isolate platform) that means:
 *
 *   • The counter is PER INSTANCE, not global. Ten concurrent isolates means ten
 *     independent budgets, so the effective global limit is `limit × instances`,
 *     and `instances` is decided by the platform, not by us.
 *   • Instances are recycled constantly. A cold start resets the counter to zero,
 *     so a distributed or simply persistent client can reset its own budget just
 *     by arriving at a fresh isolate.
 *   • An attacker with a botnet defeats a per-IP limiter outright regardless of
 *     store, because the key is the thing being rotated.
 *
 * tagit-services/api/index.ts:33 already ships exactly this pattern and it
 * provides no real protection there either. This is documented here so nobody
 * mistakes it for a spend guarantee.
 *
 * WHAT ACTUALLY BOUNDS COST:
 *   1. The edge cache (src/lib/cache.ts) — PRIMARY. It collapses a crawl burst on
 *      one token into a single origin render per TTL, which is where the money
 *      is. That is the control that matters.
 *   2. A spend-capped RPC key — the only real hard ceiling. Human-provisioned
 *      (task S0.2); it cannot be enforced from this repo.
 *   3. This limiter — defence-in-depth. It trims a single dumb client hammering
 *      a cache-missing path (e.g. enumerating token ids, which all miss). That is
 *      a genuine but narrow win, and it is the entire claim being made.
 *
 * UPGRADING TO A SHARED STORE
 * ───────────────────────────
 * `RateLimitStore` is the seam. Set RATE_LIMIT_STORE_URL + RATE_LIMIT_STORE_TOKEN
 * to point at an Upstash-Redis-compatible REST endpoint (Vercel KV exposes the
 * same protocol) and `createRateLimitStore()` returns a shared counter instead —
 * no call-site changes. No new npm dependency: the REST store speaks plain
 * `fetch`, which keeps this middleware inside the pinned dependency set
 * (next, react, react-dom, viem, @privy-io/react-auth).
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Requests remaining in the current window (floored at 0). */
  remaining: number;
  /** Seconds until the current window rolls over. */
  resetSeconds: number;
}

export interface RateLimitStore {
  /** Human-readable store identity, surfaced as a response header for ops. */
  readonly kind: "memory" | "shared-rest";
  /**
   * Record one hit for `key` and report whether it is allowed.
   * Implementations MUST fail open (return allowed) on internal error — a broken
   * limiter must never take down the read path, because the limiter is not the
   * primary cost control.
   */
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

/** Requests per IP per window on the token-id read path. */
export const READ_RATE_LIMIT = 60;
/** Fixed-window length, in seconds. */
export const READ_RATE_WINDOW_SECONDS = 60;

/** Bound the Map so a spray of unique IPs cannot grow it without limit. Beyond
 *  this we fail open rather than evict blindly — see `hit()`. */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Per-instance fixed-window counter. Correct within one isolate, meaningless
 * across a fleet. See the honesty note above.
 */
class MemoryRateLimitStore implements RateLimitStore {
  readonly kind = "memory" as const;
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const now = Date.now();
    this.sweep(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.expiresAt <= now) {
      if (!existing && this.buckets.size >= MAX_TRACKED_KEYS) {
        // Refuse to grow further. Failing open is the right call: dropping
        // legitimate traffic to protect a counter that does not bound anything
        // globally would trade a real cost (broken page) for an imaginary one.
        return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds };
      }
      this.buckets.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds };
    }

    existing.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
    return {
      allowed: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      resetSeconds,
    };
  }

  /** Drop expired buckets so the Map tracks live windows only. */
  private sweep(now: number): void {
    if (this.buckets.size < 64) return; // not worth the walk
    for (const [k, v] of this.buckets) {
      if (v.expiresAt <= now) this.buckets.delete(k);
    }
  }
}

/**
 * Shared fixed-window counter over an Upstash-Redis-compatible REST API
 * (Vercel KV speaks the same protocol). Active only when RATE_LIMIT_STORE_URL
 * and RATE_LIMIT_STORE_TOKEN are both set.
 *
 * The window is encoded in the key, so a single INCR plus an EXPIRE on first
 * write is sufficient — no read-modify-write race.
 *
 * This path is unexercised in CI (it needs a live KV instance), which is exactly
 * why every failure mode returns `allowed: true`: an unreachable or
 * misconfigured store degrades to "no limiting", never to "site down".
 */
class RestRateLimitStore implements RateLimitStore {
  readonly kind = "shared-rest" as const;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const windowKey = `${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    try {
      const count = await this.command(["INCR", windowKey]);
      if (count === null) return this.failOpen(limit, windowSeconds);
      // Only the first writer in the window needs to arm the TTL.
      if (count === 1) await this.command(["EXPIRE", windowKey, String(windowSeconds)]);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetSeconds: windowSeconds,
      };
    } catch {
      return this.failOpen(limit, windowSeconds);
    }
  }

  private failOpen(limit: number, windowSeconds: number): RateLimitDecision {
    return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
  }

  /** Returns the integer result, or null if the store answered unusably. */
  private async command(args: string[]): Promise<number | null> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    return typeof body.result === "number" ? body.result : null;
  }
}

let store: RateLimitStore | undefined;

/**
 * Process-wide store singleton. Shared-REST when configured, per-instance Map
 * otherwise. Call sites are identical either way — that is the point.
 */
export function createRateLimitStore(): RateLimitStore {
  if (store) return store;
  const url = process.env.RATE_LIMIT_STORE_URL;
  const token = process.env.RATE_LIMIT_STORE_TOKEN;
  store = url && token ? new RestRateLimitStore(url, token) : new MemoryRateLimitStore();
  return store;
}

/**
 * Best-available client identifier. On Vercel the leftmost x-forwarded-for entry
 * is the real client; it is trivially spoofable by anyone willing to rotate it,
 * which is another reason this limiter is defence-in-depth and not a guarantee.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
  return `rl:asset:${ip}`;
}
