import { NextResponse } from "next/server";

import { BATCH_ID_RE } from "@/lib/binding/station";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * GET /api/catalog-proxy/binding/exceptions?batchId=bat_… (META-T35) —
 * append-only binding_exceptions list for the per-batch exception log tab.
 * Pass-through to GET /api/v1/admin/binding/exceptions. Read-only.
 *
 * The rows carry operator free text (reason) — the UI must render it inert
 * (plain text nodes), never as markup.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const batchId = new URL(req.url).searchParams.get("batchId");
  if (batchId !== null && !BATCH_ID_RE.test(batchId)) {
    return NextResponse.json(
      { ok: false, error: "batchId must be a batch id (bat_…)" },
      { status: 400 },
    );
  }
  const query = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
  const res = await templatesUpstream(`/api/v1/admin/binding/exceptions${query}`);
  return NextResponse.json(res.body, { status: res.status });
}
