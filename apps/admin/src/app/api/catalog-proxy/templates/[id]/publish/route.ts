import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { TEMPLATE_ID_RE, canMutateCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/templates/:id/publish (META-T33) — snapshot the
 * working copy into template_versions (next monotonic version). Pass-through
 * to POST /api/v1/admin/templates/:id/publish; admin key + X-Actor injected
 * server-side. No body.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!TEMPLATE_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }
  const res = await templatesUpstream(`/api/v1/admin/templates/${params.id}/publish`, {
    method: "POST",
  });
  return NextResponse.json(res.body, { status: res.status });
}
