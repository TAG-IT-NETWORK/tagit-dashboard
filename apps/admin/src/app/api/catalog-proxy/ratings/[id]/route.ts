import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canPublishCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/** PUT /api/catalog-proxy/ratings/:id { hidden } — moderation (admin role). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!canPublishCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "admin role required" }, { status: 403 });
  }
  if (!/^\d+$/.test(params.id)) return NextResponse.json({ ok: false, error: "id must be numeric" }, { status: 400 });
  let body: { hidden?: unknown };
  try {
    body = (await req.json()) as { hidden?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.hidden !== "boolean") return NextResponse.json({ ok: false, error: "hidden must be a boolean" }, { status: 400 });
  const res = await templatesUpstream(`/api/v1/admin/ratings/${params.id}`, { method: "PUT", body: { hidden: body.hidden } });
  return NextResponse.json(res.body, { status: res.status });
}
