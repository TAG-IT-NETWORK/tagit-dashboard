import { NextResponse } from "next/server";

import { SERVICES_URL } from "@/lib/services";
import { tapLinkStoreState } from "@/lib/tap-link";
import { warmTargets } from "@/lib/warm";

/**
 * GET /api/warm — keeps the tap path hot. Vercel cron calls this every minute
 * (see vercel.json); each call exercises the functions a phone tap needs:
 *
 *   /sun                      this app's verify page λ (SDM crypto + chain client)
 *   /api/verify               the same check as JSON — what the TAG IT app calls
 *   /api/asset/:id/price      this app's price proxy λ (BuyWidget)
 *   services /api/v1/assets   tagit-services gateway (secrets, DB, chain, media)
 *
 * A cold Vercel function costs ~4 s on each side; a tap after a quiet spell
 * was paying for both. The two tap probes use a syntactically valid but wrong
 * SUN payload, so they take the counterfeit branch — no chain read, no SUN
 * counter burned, nothing cached. The list itself lives in @/lib/warm.
 *
 * After the probes it asks one more thing (TAP-T10): can this server use the
 * one-time link store? The answer is in the response as `tapLinks`. A tap
 * whose link cannot be checked ends as "We couldn't finish the check", so
 * `tapLinks.ready: false` here means every tap is failing that way right now.
 * The question reads one row on tagit-services and writes nothing. It is
 * asked after the probes, not beside them, so it never adds to the number of
 * requests that reach tagit-services at the same moment.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SELF = process.env.WARM_SELF_URL ?? "https://verify.tagit.network";
const PROBE_TOKEN = process.env.WARM_TOKEN_ID ?? "58";

async function probe(
  url: string,
  timeoutMs = 12_000,
): Promise<{ url: string; status: number | null; ms: number }> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { "user-agent": "tagit-warm/1" },
    });
    return { url, status: res.status, ms: Date.now() - started };
  } catch {
    return { url, status: null, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const targets = warmTargets({ self: SELF, services: SERVICES_URL, tokenId: PROBE_TOKEN });
  const results = await Promise.all(targets.map((url) => probe(url)));
  const asked = Date.now();
  const store = await tapLinkStoreState();
  const tapLinks = { ...store, ms: Date.now() - asked };
  // One line in the log when taps cannot be checked: the place to look first.
  if (!store.ready)
    console.error(JSON.stringify({ evt: "tap-link", ready: false, status: store.status }));
  return NextResponse.json(
    {
      ok: results.every((r) => r.status !== null),
      at: new Date().toISOString(),
      results,
      tapLinks,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
