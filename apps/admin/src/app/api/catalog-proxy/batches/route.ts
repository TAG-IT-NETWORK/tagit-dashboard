import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { MAX_BATCH_SIZE } from "@/lib/catalog/batch-logic";
import { TEMPLATE_ID_RE, canMutateCatalog } from "@/lib/catalog/template-logic";
import { batchesUpstream } from "@/lib/server/batches-upstream";

/**
 * POST /api/catalog-proxy/batches (META-T34) — step-1 create/validate.
 *
 * Client body is ALWAYS JSON here; the proxy translates onto the two upstream
 * shapes (batch-router.ts):
 *   { templateId, quantity }  → JSON POST /api/v1/admin/batches
 *   { templateId, csv }       → text/csv POST /api/v1/admin/batches?templateId=…
 *
 * Responses pass through: 201 {ok, batch, rows, errors:[]} on success; the
 * CSV row-error preview comes back as 400 {ok:false, rows, errors} WITHOUT
 * persisting a batch (surfaced inline in step 1); structural rejects arrive
 * as the AppError envelope {error, message}. Admin key + X-Actor injected
 * server-side (REQ-S-16).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Client-side cap well under the upstream express text() 5mb limit. */
const MAX_CSV_BYTES = 2_000_000;

export async function POST(req: Request) {
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }

  let body: { templateId?: unknown; quantity?: unknown; csv?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const templateId = String(body.templateId ?? "");
  if (!TEMPLATE_ID_RE.test(templateId)) {
    return NextResponse.json(
      { ok: false, error: "templateId must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  if ((body.csv === undefined) === (body.quantity === undefined)) {
    return NextResponse.json(
      { ok: false, error: "provide exactly one of quantity or csv" },
      { status: 400 },
    );
  }

  if (body.csv !== undefined) {
    if (typeof body.csv !== "string" || body.csv.length === 0) {
      return NextResponse.json({ ok: false, error: "csv must be a non-empty string" }, { status: 400 });
    }
    if (body.csv.length > MAX_CSV_BYTES) {
      return NextResponse.json(
        { ok: false, error: `csv exceeds ${MAX_CSV_BYTES} characters` },
        { status: 400 },
      );
    }
    const res = await batchesUpstream(
      `/api/v1/admin/batches?templateId=${encodeURIComponent(templateId)}`,
      { method: "POST", csv: body.csv },
    );
    return NextResponse.json(res.body, { status: res.status });
  }

  if (
    typeof body.quantity !== "number" ||
    !Number.isInteger(body.quantity) ||
    body.quantity < 1 ||
    body.quantity > MAX_BATCH_SIZE
  ) {
    return NextResponse.json(
      { ok: false, error: `quantity must be an integer 1–${MAX_BATCH_SIZE}` },
      { status: 400 },
    );
  }
  const res = await batchesUpstream("/api/v1/admin/batches", {
    method: "POST",
    json: { templateId, quantity: body.quantity },
  });
  return NextResponse.json(res.body, { status: res.status });
}
