import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { TEMPLATE_ID_RE, canMutateCatalog } from "@/lib/catalog/template-logic";
import { pickTemplateBody, templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * /api/catalog-proxy/templates/:id (META-T33) — key-injecting pass-through:
 *
 *   GET → GET /api/v1/admin/templates/:id   (detail + published versions)
 *   PUT → PUT /api/v1/admin/templates/:id   (edit working copy; auto-forks a
 *                                            published template — response
 *                                            carries `forked`)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!TEMPLATE_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  const res = await templatesUpstream(`/api/v1/admin/templates/${params.id}`);
  return NextResponse.json(res.body, { status: res.status });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!TEMPLATE_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "body must be a JSON object" }, { status: 400 });
  }
  const picked = pickTemplateBody(body as Record<string, unknown>);
  if (Object.keys(picked).length === 0) {
    return NextResponse.json({ ok: false, error: "empty update" }, { status: 400 });
  }
  const res = await templatesUpstream(`/api/v1/admin/templates/${params.id}`, {
    method: "PUT",
    body: picked,
  });
  return NextResponse.json(res.body, { status: res.status });
}
