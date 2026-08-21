import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";
import { pickTemplateBody, templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * /api/catalog-proxy/templates — server-side pass-through to the services
 * template rail (META-T33). Same pattern as media-proxy/mint-proxy: the admin
 * API key is injected server-side (inside templatesUpstream) and never
 * reaches the browser. REQ-S-16: writes forward X-Actor; the role seam
 * (viewer read-only) gates mutations here as well as in the UI.
 *
 *   GET  → GET  {SERVICES_URL}/api/v1/admin/templates
 *   POST → POST {SERVICES_URL}/api/v1/admin/templates   (create draft)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await templatesUpstream("/api/v1/admin/templates");
  return NextResponse.json(res.body, { status: res.status });
}

export async function POST(req: Request) {
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
  // Whitelist to the create-schema keys; zod (.strict()) upstream stays the
  // enforcement point for shapes and caps.
  const res = await templatesUpstream("/api/v1/admin/templates", {
    method: "POST",
    body: pickTemplateBody(body as Record<string, unknown>),
  });
  return NextResponse.json(res.body, { status: res.status });
}
