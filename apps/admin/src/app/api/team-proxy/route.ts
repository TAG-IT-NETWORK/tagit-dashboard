import { NextResponse } from "next/server";

import { proxyTeamRequest } from "@/lib/team-proxy";

/**
 * /api/team-proxy — admin_users roster list + enroll (META-T32).
 *
 * GET  → GET  {SERVICES_URL}/api/v1/admin/users            (list, /team page)
 * POST → POST {SERVICES_URL}/api/v1/admin/users            (enroll)
 *
 * Admin-only (middleware + in-route session re-check); the services admin
 * key stays server-side and X-Actor carries the signed-in email — see
 * src/lib/team-proxy.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return proxyTeamRequest({ method: "GET", path: "/api/v1/admin/users" });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  return proxyTeamRequest({ method: "POST", path: "/api/v1/admin/users", body });
}
