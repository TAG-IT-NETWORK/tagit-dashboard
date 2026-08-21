import { NextResponse } from "next/server";

import { PROPAGATE_JOB_ID_RE } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * GET /api/catalog-proxy/propagate-jobs/:id (META-T33) — propagate job
 * status poll (cursor + per-outcome counters). Pass-through to
 * GET /api/v1/admin/propagate-jobs/:id; the upstream endpoint is
 * tenant-scoped + admin-gated server-side (foreign job ids read as 404).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!PROPAGATE_JOB_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a propagate job id (pjob_…)" },
      { status: 400 },
    );
  }
  const res = await templatesUpstream(`/api/v1/admin/propagate-jobs/${params.id}`);
  return NextResponse.json(res.body, { status: res.status });
}
