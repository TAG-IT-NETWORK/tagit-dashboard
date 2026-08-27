import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { TEMPLATE_ID_RE, canPublishCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/templates/:id/archive (META-T33) — soft archive
 * (idempotent; archived templates reject edits/publishes upstream).
 * Pass-through to POST /api/v1/admin/templates/:id/archive; admin key +
 * X-Actor injected server-side. No body.
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
  if (!canPublishCatalog(await getActorRole())) {
    // WB-06: archive retires a live template — admin-level, matching the
    // middleware PATH_ROLES pin.
    return NextResponse.json({ ok: false, error: "archive requires the admin role" }, { status: 403 });
  }
  const res = await templatesUpstream(`/api/v1/admin/templates/${params.id}/archive`, {
    method: "POST",
  });
  return NextResponse.json(res.body, { status: res.status });
}
