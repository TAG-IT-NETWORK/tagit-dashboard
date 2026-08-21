/**
 * Server-side helpers for the /catalog template surface (META-T33). Route
 * handlers and server components ONLY — this module reads SERVICES_API_KEY,
 * which must never reach a client bundle.
 *
 * Upstream = the tagit-services admin template rail (src/catalog/
 * template-router.ts), authed with the admin API key injected here — same
 * pattern as media-proxy/mint-proxy (META-T18). REQ-S-16: mutating calls
 * forward the signed-in identity as X-Actor via lib/actor.ts.
 */

import { getActor } from "@/lib/actor";
import type { TemplateDto } from "@/lib/catalog/template-types";

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";
const FETCH_TIMEOUT_MS = 15_000;

export interface UpstreamResult {
  status: number;
  body: Record<string, unknown>;
}

export function servicesConfigured(): boolean {
  return Boolean(process.env.SERVICES_API_KEY);
}

/**
 * JSON call to the services admin surface. `relayer: true` additionally sends
 * the second-tier relayer key (propagate broadcasts relayer transactions).
 * Never throws — network failures come back as a 502-shaped result.
 */
export async function templatesUpstream(
  path: string,
  init: { method?: string; body?: unknown; relayer?: boolean } = {},
): Promise<UpstreamResult> {
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      body: { ok: false, error: "SERVICES_API_KEY not configured on the server" },
    };
  }
  const relayerKey = process.env.RELAYER_API_KEY;
  const actor = await getActor();
  const method = init.method ?? "GET";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVICES_URL}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(init.relayer && relayerKey ? { "x-relayer-key": relayerKey } : {}),
        // REQ-S-16: forward identity on writes; omit entirely when unknown.
        ...(actor && method !== "GET" ? { "x-actor": actor } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return {
      status: res.status,
      body: body ?? { ok: false, error: `services returned ${res.status} with a non-JSON body` },
    };
  } catch (e) {
    return {
      status: 502,
      body: { ok: false, error: e instanceof Error ? e.message : String(e) },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Keys templateCreateSchema/templateUpdateSchema accept (services templates.ts). */
const TEMPLATE_BODY_KEYS = [
  "name",
  "slug",
  "brand",
  "model",
  "sku",
  "category",
  "origin",
  "description",
  "attributes",
  "priceUsdc6",
  "msrp",
] as const;

/**
 * Whitelist a client-supplied create/update body to the services schema keys.
 * Upstream zod (.strict()) remains the enforcement point for shapes and caps.
 */
export function pickTemplateBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TEMPLATE_BODY_KEYS) {
    if (key in body) out[key] = body[key];
  }
  return out;
}

/** GET /api/v1/admin/templates for the server-rendered /catalog table. */
export async function fetchTemplatesList(): Promise<{
  templates: TemplateDto[] | null;
  error: string | null;
}> {
  const res = await templatesUpstream("/api/v1/admin/templates");
  const templates = res.body.templates;
  if (res.status !== 200 || !Array.isArray(templates)) {
    const error =
      typeof res.body.error === "string"
        ? res.body.error
        : `services template list returned ${res.status}`;
    return { templates: null, error };
  }
  return { templates: templates as TemplateDto[], error: null };
}

// ──────────────────────────────────────────────
// Items resolution (Items tab)
// ──────────────────────────────────────────────

const DETAIL_CONCURRENCY = 8;

/**
 * LIMITATION (deliberate — see task notes): tagit-services main ships NO
 * template→items enumeration endpoint (the admin rail is per-token:
 * templates/batches/binding; propagate/adopt take EXPLICIT tokenIds). Items
 * are therefore resolved from an explicit token-id set through the public
 * per-token detail DTO (GET /api/v1/assets/:tokenId — buildAssetDetail in
 * services src/api/assets.ts), which carries name/lifecycle/verification but
 * no per-item template linkage. An admin items endpoint would lift this.
 */
export async function resolveItemRows(
  tokenIds: string[],
): Promise<Array<Record<string, unknown>>> {
  const results: Array<Record<string, unknown>> = new Array(tokenIds.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tokenIds.length) {
      const index = next++;
      const tokenId = tokenIds[index];
      const res = await templatesUpstream(`/api/v1/assets/${tokenId}`);
      results[index] = toItemRow(tokenId, res.status, res.body);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, tokenIds.length) }, () => worker()),
  );
  return results;
}

/** Map one detail DTO onto the Items-table row shape (TemplateItemRow). */
export function toItemRow(
  tokenId: string,
  status: number,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const restricted = body.restricted === true || body.protected === true;
  if (status !== 200 || restricted) {
    return {
      tokenId,
      found: status === 200,
      restricted,
      name: null,
      image: null,
      lifecycleState: null,
      sku: null,
      anchoredVersion: null,
      latestVersion: null,
      anchorStatus: null,
    };
  }
  const product = (body.product ?? {}) as Record<string, unknown>;
  const verification = (body.verification ?? {}) as Record<string, unknown>;
  return {
    tokenId,
    found: true,
    restricted: false,
    name: typeof body.name === "string" ? body.name : null,
    image: typeof body.image === "string" ? body.image : null,
    lifecycleState: typeof body.lifecycleState === "string" ? body.lifecycleState : null,
    sku: typeof product.sku === "string" ? product.sku : null,
    anchoredVersion:
      typeof verification.anchoredVersion === "number" ? verification.anchoredVersion : null,
    latestVersion:
      typeof verification.latestVersion === "number" ? verification.latestVersion : null,
    anchorStatus: typeof verification.anchorStatus === "string" ? verification.anchorStatus : null,
  };
}
