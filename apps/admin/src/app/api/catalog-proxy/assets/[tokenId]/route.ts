import { NextResponse } from "next/server";
import { fetchAssetDetail } from "@/lib/catalog/server";

/**
 * GET /api/catalog-proxy/assets/:tokenId — server-side pass-through to the
 * services catalog detail (GET {SERVICES_URL}/api/v1/assets/:tokenId).
 *
 * Same pattern as media-proxy/mint-proxy (META-T18): the admin API key (when
 * configured) is injected server-side inside fetchAssetDetail and never
 * reaches the browser. Read-only — no relayer tier, no X-Actor needed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  const tokenId = params.tokenId;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json(
      { ok: false, error: "tokenId must be a numeric string" },
      { status: 400 },
    );
  }

  const body = await fetchAssetDetail(tokenId);
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "services catalog unreachable" },
      { status: 502 },
    );
  }
  return NextResponse.json(body);
}
