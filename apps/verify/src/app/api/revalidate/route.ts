import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { parseRevalidatePayload, ReplayGuard, verifySignature } from "@/lib/revalidate-guard";
import { tokenTag } from "@/lib/services";

/**
 * POST /api/revalidate — cache-bust webhook from tagit-services.
 *
 * tagit-services emits a signed event whenever a token's public surfaces
 * change (price.updated, metadata.anchored, media.processed,
 * ownership.changed); this handler verifies the HMAC over the RAW body,
 * rejects stale/replayed deliveries, and revalidates the `token-<id>` fetch
 * tag for each tokenId so the next request re-reads the services API.
 *
 * Order of checks is security-relevant: signature FIRST (401, no cache
 * action of any kind on failure), then freshness, then replay. Never
 * revalidate anything for an unauthenticated request.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Module-scope: survives across requests within one warm serverless instance.
// Cold starts reset it, which is safe — the ts-skew window bounds replays.
const replayGuard = new ReplayGuard();

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "REVALIDATE_WEBHOOK_SECRET not configured" },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-tagit-signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const parsed = parseRevalidatePayload(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  // Duplicate delivery: acknowledge with 200 so the emitter stops retrying,
  // but do not re-bust anything.
  if (replayGuard.seenBefore(parsed.payload.id)) {
    return NextResponse.json({ ok: true, duplicate: true, revalidated: [] });
  }

  const revalidated: string[] = [];
  for (const tokenId of parsed.payload.tokenIds) {
    revalidateTag(tokenTag(tokenId));
    revalidated.push(tokenId);
  }

  return NextResponse.json({
    ok: true,
    event: parsed.payload.event,
    revalidated,
  });
}
