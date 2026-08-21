import { NextResponse } from "next/server";

import { proxyTeamRequest, teamUserPath } from "@/lib/team-proxy";

/**
 * /api/team-proxy/:email — single admin_users row (META-T32).
 *
 * PUT    → PUT    {SERVICES_URL}/api/v1/admin/users/:email  (role/business change)
 * DELETE → DELETE {SERVICES_URL}/api/v1/admin/users/:email  (remove)
 *
 * Admin-only; key custody + X-Actor in src/lib/team-proxy.ts. The email path
 * segment is re-encoded before forwarding, never string-interpolated raw.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { email: string };
}

export async function PUT(req: Request, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  return proxyTeamRequest({ method: "PUT", path: teamUserPath(params.email), body });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  return proxyTeamRequest({ method: "DELETE", path: teamUserPath(params.email) });
}
