import { NextResponse } from "next/server";

import { getActorRole } from "@/lib/actor-role";
import { BATCH_SIZE_ADVICE, MAX_BATCH_SIZE } from "@/lib/catalog/batch-logic";
import { parseBatchFactsBody } from "@/lib/catalog/product-facts";
import { TEMPLATE_ID_RE, canMutateCatalog } from "@/lib/catalog/template-logic";
import { batchesUpstream } from "@/lib/server/batches-upstream";

/**
 * /api/catalog-proxy/batches (META-T34).
 *
 * GET ?templateId=&limit= (WB-09) — pass-through to the services batch list
 * (GET /api/v1/admin/batches: newest first, tenant-scoped through the
 * template, minted counts included). Backs the wizard's "Recent batches"
 * rail — localStorage is only the offline fallback now. Read-only,
 * viewer-safe (middleware session gate is the outer wall, same posture as
 * the batch-status GET).
 *
 * POST — step-1 create/validate. Client body is ALWAYS JSON here; the proxy
 * translates onto the two upstream shapes (batch-router.ts):
 *   { templateId, quantity }  → JSON POST /api/v1/admin/batches
 *   { templateId, csv }       → text/csv POST /api/v1/admin/batches?templateId=…
 * Either may carry `facts: { lot, madeOn, bestBefore }` (TAP-T09) — what every
 * item of the batch shares. It rides in the JSON body on the quantity path and
 * in the query string (?lot=&madeOn=&bestBefore=) on the CSV path.
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

/** Mirror of the services batchListQuerySchema limit bound (batch-router.ts). */
const MAX_LIST_LIMIT = 50;

export async function GET(req: Request) {
  const search = new URL(req.url).searchParams;
  const templateId = search.get("templateId");
  const limit = search.get("limit");
  if (templateId !== null && !TEMPLATE_ID_RE.test(templateId)) {
    return NextResponse.json(
      { ok: false, error: "templateId must be a template id (tpl_…)" },
      { status: 400 },
    );
  }
  if (
    limit !== null &&
    !(/^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= MAX_LIST_LIMIT)
  ) {
    return NextResponse.json(
      { ok: false, error: `limit must be an integer 1–${MAX_LIST_LIMIT}` },
      { status: 400 },
    );
  }

  const qs = new URLSearchParams();
  if (templateId !== null) qs.set("templateId", templateId);
  if (limit !== null) qs.set("limit", limit);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const res = await batchesUpstream(`/api/v1/admin/batches${suffix}`);
  return NextResponse.json(res.body, { status: res.status });
}

export async function POST(req: Request) {
  if (!canMutateCatalog(await getActorRole())) {
    return NextResponse.json({ ok: false, error: "viewer role is read-only" }, { status: 403 });
  }

  let body: { templateId?: unknown; quantity?: unknown; csv?: unknown; facts?: unknown };
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

  // The proxy's own read of the facts: known keys, text values, real dates.
  // Services checks again and also refuses them for a non-cosmetics template.
  const parsedFacts = parseBatchFactsBody(body.facts);
  if (!parsedFacts.ok) {
    return NextResponse.json({ ok: false, error: parsedFacts.error }, { status: 400 });
  }
  const facts = parsedFacts.facts;

  if (body.csv !== undefined) {
    if (typeof body.csv !== "string" || body.csv.length === 0) {
      return NextResponse.json(
        { ok: false, error: "csv must be a non-empty string" },
        { status: 400 },
      );
    }
    if (body.csv.length > MAX_CSV_BYTES) {
      return NextResponse.json(
        { ok: false, error: `csv exceeds ${MAX_CSV_BYTES} characters` },
        { status: 400 },
      );
    }
    const query = new URLSearchParams({ templateId });
    for (const [key, value] of Object.entries(facts ?? {})) {
      if (typeof value === "string") query.set(key, value);
    }
    const res = await batchesUpstream(`/api/v1/admin/batches?${query.toString()}`, {
      method: "POST",
      csv: body.csv,
    });
    return NextResponse.json(res.body, { status: res.status });
  }

  if (typeof body.quantity !== "number" || !Number.isInteger(body.quantity) || body.quantity < 1) {
    return NextResponse.json(
      { ok: false, error: "quantity must be a whole number, 1 or more" },
      { status: 400 },
    );
  }
  if (body.quantity > MAX_BATCH_SIZE) {
    // TAP-T19: the registry takes at most 100 items in one mint. Services
    // refuses the same, in the same words.
    return NextResponse.json({ ok: false, error: BATCH_SIZE_ADVICE }, { status: 400 });
  }
  const res = await batchesUpstream("/api/v1/admin/batches", {
    method: "POST",
    json: { templateId, quantity: body.quantity, ...(facts ? { facts } : {}) },
  });
  return NextResponse.json(res.body, { status: res.status });
}
