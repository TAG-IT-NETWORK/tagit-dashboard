import { NextResponse } from "next/server";

import { proxyBrandRequest, readJson } from "@/lib/brand-proxy";

/**
 * /api/brand-proxy — brand records (TAP-T16). Platform admins only; see
 * src/lib/brand-proxy.ts.
 *
 * GET  → GET  /api/v1/admin/businesses   (list)
 * POST → POST /api/v1/admin/businesses   (create)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyBrandRequest({ method: "GET", path: "/api/v1/admin/businesses" });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  return proxyBrandRequest({ method: "POST", path: "/api/v1/admin/businesses", body });
}
