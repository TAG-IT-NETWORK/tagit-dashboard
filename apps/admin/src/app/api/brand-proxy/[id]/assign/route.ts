import { NextResponse } from "next/server";

import { brandPath, proxyBrandRequest, readJson } from "@/lib/brand-proxy";

/**
 * /api/brand-proxy/:id/assign — give no-brand templates and items to a brand
 * (TAP-T16). Platform admins only.
 *
 * POST → POST /api/v1/admin/businesses/:id/assign   { templateIds?, tokenIds? }
 *
 * tagit-services moves only rows that have no brand; this route adds nothing
 * to that rule and cannot loosen it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  return proxyBrandRequest({ method: "POST", path: brandPath(id, "/assign"), body });
}
