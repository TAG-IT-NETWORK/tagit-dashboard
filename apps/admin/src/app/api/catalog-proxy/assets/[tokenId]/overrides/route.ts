import { NextResponse } from "next/server";
import { getActor } from "@/lib/actor";
import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { validateOverridesDoc } from "@/lib/catalog/logic";

/**
 * PUT /api/catalog-proxy/assets/:tokenId/overrides — the slide-over's
 * overrides editor write path.
 *
 * tagit-services has no persistent per-item overrides endpoint (item
 * overrides are only written by template adoption), so the editor's JSON is
 * applied as the publish-doc overlay:
 *
 *   upstream POST /api/v1/assets/:tokenId/metadata { doc, backfill?, actor? }
 *
 * which deep-merges template fields + stored overrides + this doc, publishes
 * a new canonical metadata version and schedules the on-chain anchor. That
 * endpoint broadcasts a relayer transaction, so BOTH credentials are injected
 * server-side (same pattern as mint-proxy) and never reach the browser.
 *
 * REQ-S-16: the signed-in user identity is forwarded as X-Actor (and the
 * endpoint's `actor` body field) whenever the session helper resolves one.
 *
 * Body: { doc: object, backfill?: boolean }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

export async function PUT(req: Request, { params }: { params: { tokenId: string } }) {
  const tokenId = params.tokenId;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json(
      { ok: false, error: "tokenId must be a numeric string" },
      { status: 400 },
    );
  }

  // META-T32 role map: overrides are a catalog write — operator ("editor")
  // and above. The middleware already session-gates this path; this is the
  // proxy's own role check (defense in depth).
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }

  const apiKey = process.env.SERVICES_API_KEY;
  const relayerKey = process.env.RELAYER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICES_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  let body: { doc?: unknown; backfill?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // Re-validate server-side with the same pure validator the editor uses —
  // the browser check is convenience, this is the proxy's own gate.
  const validated = validateOverridesDoc(JSON.stringify(body.doc ?? null));
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }
  const backfill = body.backfill === true;

  const actor = await getActor();

  try {
    const upstream = await fetch(`${SERVICES_URL}/api/v1/assets/${tokenId}/metadata`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...(relayerKey ? { "x-relayer-key": relayerKey } : {}),
        ...(actor ? { "x-actor": actor } : {}),
      },
      body: JSON.stringify({
        doc: validated.doc,
        ...(backfill ? { backfill: true } : {}),
        ...(actor ? { actor } : {}),
      }),
    });
    const data = await upstream
      .json()
      .catch(() => ({ ok: false, error: `metadata upstream returned ${upstream.status}` }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
