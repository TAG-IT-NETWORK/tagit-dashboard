import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { MAX_TOKEN_IDS, TEMPLATE_ID_RE, canPublishCatalog } from "@/lib/catalog/template-logic";
import { templatesUpstream } from "@/lib/server/templates-upstream";

/**
 * POST /api/catalog-proxy/templates/:id/propagate (META-T33) — start the T24
 * chunked propagate job. THE ONLY trigger for propagation (publish never
 * starts one implicitly): re-renders every adopted item (or an explicit
 * tokenIds subset) onto the latest snapshot and re-queues anchors.
 *
 * Upstream POST /api/v1/admin/templates/:id/propagate sits behind the RELAYER
 * tier (each item's re-anchor is a relayer-funded broadcast), so BOTH
 * credentials are injected server-side — same pattern as mint-proxy. 202
 * response: { ok, jobId, targetVersion }; poll /api/catalog-proxy/
 * propagate-jobs/:jobId for progress.
 *
 * Body: { tokenIds?: string[] } — omitted entirely means "every adopted item"
 * (upstream schema is .strict(); an empty array is invalid there).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!TEMPLATE_ID_RE.test(params.id)) {
    return NextResponse.json(
      { ok: false, error: "id must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  if (!canPublishCatalog(await getActorRole())) {
    // WB-06: propagate relayer-broadcasts a re-anchor per item — admin-level,
    // matching the middleware PATH_ROLES pin.
    return NextResponse.json(
      { ok: false, error: "propagate requires the admin role" },
      { status: 403 },
    );
  }

  let body: { tokenIds?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let tokenIds: string[] | undefined;
  if (body.tokenIds !== undefined) {
    if (
      !Array.isArray(body.tokenIds) ||
      body.tokenIds.length === 0 ||
      body.tokenIds.length > MAX_TOKEN_IDS ||
      !body.tokenIds.every((t) => typeof t === "string" && /^\d+$/.test(t))
    ) {
      return NextResponse.json(
        { ok: false, error: `tokenIds must be 1–${MAX_TOKEN_IDS} decimal strings` },
        { status: 400 },
      );
    }
    tokenIds = body.tokenIds as string[];
  }

  const res = await templatesUpstream(`/api/v1/admin/templates/${params.id}/propagate`, {
    method: "POST",
    relayer: true,
    body: tokenIds ? { tokenIds } : {},
  });
  return NextResponse.json(res.body, { status: res.status });
}
