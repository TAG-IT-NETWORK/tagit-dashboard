import { NextResponse } from "next/server";

import { brandUpstream, requirePlatformAdmin } from "@/lib/brand-proxy";
import { unassignedTemplates } from "@/lib/brands";

/**
 * /api/brand-proxy/unassigned — the templates that belong to no brand yet
 * (TAP-T16): what a platform admin can hand to a brand.
 *
 * Read AS THE PLATFORM, whatever brand the admin is creating for at the
 * moment: the ordinary catalog proxy would show that brand's templates only,
 * and the no-brand ones would be invisible exactly when they are wanted.
 * Platform admins only. Answers id, name, SKU and status, and nothing else.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requirePlatformAdmin();
  if (admin instanceof NextResponse) return admin;
  const { status, body } = await brandUpstream(admin, {
    method: "GET",
    path: "/api/v1/admin/templates",
  });
  if (status !== 200) {
    return NextResponse.json(
      { ok: false, error: "UPSTREAM_FAILED" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, templates: unassignedTemplates(body.templates) },
    { headers: { "cache-control": "no-store" } },
  );
}
