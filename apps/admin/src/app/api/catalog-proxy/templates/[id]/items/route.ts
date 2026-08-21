import { NextResponse } from "next/server";

import { TEMPLATE_ID_RE } from "@/lib/catalog/template-logic";
import { resolveItemRows } from "@/lib/server/templates-upstream";

/**
 * GET /api/catalog-proxy/templates/:id/items?tokenIds=1,2,3 (META-T33) —
 * resolve an explicit token-id set into Items-table rows via the services
 * per-token detail DTO (admin key injected server-side).
 *
 * LIMITATION (deliberate — see lib/server/templates-upstream.ts): services
 * main exposes no template→items enumeration endpoint, so the caller supplies
 * the token ids and rows carry no per-item template linkage; the Items tab
 * banner explains both. Capped at 100 ids per request to keep the fan-out
 * (one upstream GET per id, concurrency 8) polite.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS_PER_REQUEST = 100;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!TEMPLATE_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  const raw = new URL(req.url).searchParams.get("tokenIds") ?? "";
  const tokenIds = raw.split(",").filter((t) => t !== "");
  if (tokenIds.length === 0) {
    return NextResponse.json({ ok: true, rows: [] });
  }
  if (tokenIds.length > MAX_ITEMS_PER_REQUEST || !tokenIds.every((t) => /^\d+$/.test(t))) {
    return NextResponse.json(
      { ok: false, error: `tokenIds must be 1–${MAX_ITEMS_PER_REQUEST} decimal ids` },
      { status: 400 },
    );
  }

  const rows = await resolveItemRows(tokenIds);
  return NextResponse.json({ ok: true, rows });
}
