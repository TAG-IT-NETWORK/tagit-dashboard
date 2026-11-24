import { NextResponse } from "next/server";

import { brandPath, proxyBrandRequest, readJson } from "@/lib/brand-proxy";

/**
 * /api/brand-proxy/:id — one brand record (TAP-T16). Platform admins only.
 *
 * PUT → PUT /api/v1/admin/businesses/:id   (name, logo, wallets)
 *
 * The id is re-encoded before it is forwarded, never interpolated raw.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  return proxyBrandRequest({ method: "PUT", path: brandPath(id), body });
}
