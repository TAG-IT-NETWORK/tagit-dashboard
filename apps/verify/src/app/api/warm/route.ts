import { NextResponse } from "next/server";

import { SERVICES_URL } from "@/lib/services";

/**
 * GET /api/warm — keeps the tap path hot. Vercel cron calls this every minute
 * (see vercel.json); each call exercises the functions a phone tap needs:
 *
 *   /sun                      this app's verify page λ (SDM crypto + chain client)
 *   /api/asset/:id/price      this app's price proxy λ (BuyWidget)
 *   services /api/v1/assets   tagit-services gateway (secrets, DB, chain, media)
 *
 * A cold Vercel function costs ~4 s on each side; a tap after a quiet spell
 * was paying for both. The /sun probe uses a syntactically valid but wrong
 * SUN payload, so it renders the counterfeit branch — no chain read, no SUN
 * counter burned, nothing cached.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SELF = process.env.WARM_SELF_URL ?? "https://verify.tagit.network";
const PROBE_TOKEN = process.env.WARM_TOKEN_ID ?? "58";
const PROBE_SUN = "/sun?picc=00112233445566778899aabbccddeeff&cmac=0011223344556677";

async function probe(url: string, timeoutMs = 12_000): Promise<{ url: string; status: number | null; ms: number }> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { "user-agent": "tagit-warm/1" } });
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
  const results = await Promise.all([
    probe(`${SELF}${PROBE_SUN}`),
    probe(`${SELF}/api/asset/${PROBE_TOKEN}/price`),
    probe(`${SERVICES_URL}/api/v1/assets/${PROBE_TOKEN}?currency=EUR`),
  ]);
  return NextResponse.json(
    { ok: results.every((r) => r.status !== null), at: new Date().toISOString(), results },
    { headers: { "cache-control": "no-store" } },
  );
}
