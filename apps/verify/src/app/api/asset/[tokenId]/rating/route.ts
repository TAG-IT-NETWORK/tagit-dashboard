import { NextResponse } from "next/server";

import { SERVICES_URL } from "@/lib/services";

/** GET = ratings view (60 s shared cache); POST = owner-signed submission pass-through (never cached). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

export async function GET(_req: Request, { params }: { params: { tokenId: string } }) {
  if (!ID_RE.test(params.tokenId)) return NextResponse.json({ error: "INVALID_TOKEN_ID" }, { status: 400 });
  const upstream = await fetch(`${SERVICES_URL}/api/v1/assets/${params.tokenId}/ratings`, { headers: { accept: "application/json" }, cache: "no-store" });
  const body = await upstream.json().catch(() => ({ ok: false, error: `ratings upstream returned ${upstream.status}` }));
  return NextResponse.json(body, { status: upstream.status, headers: { "cache-control": upstream.ok ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store" } });
}

export async function POST(req: Request, { params }: { params: { tokenId: string } }) {
  if (!ID_RE.test(params.tokenId)) return NextResponse.json({ error: "INVALID_TOKEN_ID" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const upstream = await fetch(`${SERVICES_URL}/api/v1/assets/${params.tokenId}/ratings`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...(forwarded ? { "x-forwarded-for": forwarded } : {}) },
    body: JSON.stringify({ ...(body as Record<string, unknown>), source: "verify" }),
    cache: "no-store",
  });
  const out = await upstream.json().catch(() => ({ ok: false, error: `ratings upstream returned ${upstream.status}` }));
  return NextResponse.json(out, { status: upstream.status, headers: { "cache-control": "no-store" } });
}
