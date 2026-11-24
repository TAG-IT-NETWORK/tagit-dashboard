import { NextResponse } from "next/server";

import {
  ACTING_BRAND_COOKIE,
  ACTING_BRAND_MAX_AGE_SECONDS,
  parseBusinessId,
} from "@/lib/acting-brand";
import { getTenantContext } from "@/lib/actor";
import { brandPath, brandUpstream, readJson, requirePlatformAdmin } from "@/lib/brand-proxy";

/**
 * /api/brand-proxy/acting — which brand a platform admin is creating for
 * (TAP-T16, see src/lib/acting-brand.ts).
 *
 * GET  → { ok, acting: "<business id>" | null }
 * POST → { businessId: "<id>" } starts acting for that brand,
 *        { businessId: null }   stops.
 *
 * Platform admins only. A brand must EXIST to be chosen: the id is looked up
 * in tagit-services first, so the cookie is never set to something typed.
 * The cookie is httpOnly (the page does not need to read it), and it only
 * ever narrows what an admin sees and stamps.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function GET() {
  const admin = await requirePlatformAdmin();
  if (admin instanceof NextResponse) return admin;
  const context = await getTenantContext();
  return NextResponse.json(
    { ok: true, acting: context.acting ? context.tenant : null },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  const admin = await requirePlatformAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  const raw = (body as { businessId?: unknown } | null)?.businessId;

  if (raw === null) {
    const res = NextResponse.json({ ok: true, acting: null }, { headers: NO_STORE });
    res.cookies.set(ACTING_BRAND_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const businessId = parseBusinessId(raw);
  if (!businessId) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST" },
      { status: 400, headers: NO_STORE },
    );
  }
  const found = await brandUpstream(admin, { method: "GET", path: brandPath(businessId) });
  const brand = found.body.business as { id?: unknown; name?: unknown } | undefined;
  if (found.status !== 200 || brand?.id !== businessId) {
    return NextResponse.json(
      { ok: false, error: found.status === 404 ? "UNKNOWN_BUSINESS" : "UPSTREAM_FAILED" },
      { status: found.status === 404 ? 404 : 502, headers: NO_STORE },
    );
  }

  const res = NextResponse.json(
    {
      ok: true,
      acting: businessId,
      name: typeof brand.name === "string" ? brand.name : businessId,
    },
    { headers: NO_STORE },
  );
  res.cookies.set(ACTING_BRAND_COOKIE, businessId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTING_BRAND_MAX_AGE_SECONDS,
  });
  return res;
}
