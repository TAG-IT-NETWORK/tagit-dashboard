import { NextResponse } from "next/server";

import { TEMPLATE_ID_RE } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * GET /api/catalog-proxy/templates/:id/items?cursor=&limit= (WB-05) —
 * pass-through to the services template-items enumeration
 * (GET /api/v1/admin/templates/:id/items): same row shape + keyset
 * pagination as the org-wide admin catalog list, tenant-scoped THROUGH the
 * template (a foreign template id 404s upstream). Replaces the old
 * explicit-tokenIds fan-out over the public per-token DTO — the Items tab
 * now enumerates real template linkage by default and uses the manual
 * token-id input only as a client-side filter.
 *
 * Read-only, viewer-safe (middleware session gate is the outer wall, same
 * posture as the other template GETs); admin key injected server-side.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mirror of the services catalogListQuerySchema bounds (admin-list.ts). */
const MAX_LIMIT = 100;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!TEMPLATE_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  const search = new URL(req.url).searchParams;
  const cursor = search.get("cursor");
  const limit = search.get("limit");
  if (cursor !== null && !/^\d+$/.test(cursor)) {
    return NextResponse.json(
      { ok: false, error: "cursor must be a numeric token id" },
      { status: 400 },
    );
  }
  if (limit !== null && !(/^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= MAX_LIMIT)) {
    return NextResponse.json(
      { ok: false, error: `limit must be an integer 1–${MAX_LIMIT}` },
      { status: 400 },
    );
  }

  const qs = new URLSearchParams();
  if (cursor !== null) qs.set("cursor", cursor);
  if (limit !== null) qs.set("limit", limit);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const res = await templatesUpstream(`/api/v1/admin/templates/${params.id}/items${suffix}`);
  return NextResponse.json(res.body, { status: res.status });
}
