/**
 * Server-side catalog registry fetchers (META-T36; WB-04). Server components
 * and route handlers ONLY — this module reads SERVICES_API_KEY, which must
 * never reach a client bundle.
 *
 * WB-04: the registry reads the org-wide ADMIN catalog list
 * (GET /api/v1/admin/catalog — keyset pagination by token id, tenant-scoped,
 * server-side lifecycle/drift/needsProductInfo filters). This replaced the
 * old 150-token public fan-out (GET /api/v1/assets/public + one detail GET
 * per token), which could only ever see public+confirmed items — restricted,
 * unanchored and drifted rows now appear. NOTE: the cursor is the last
 * SCANNED row, so a filtered page may be sparse (fewer rows than the limit)
 * while nextCursor is still set — keep paging until nextCursor is null.
 */

import { registryRowFromAdminItem } from "./logic";
import type { RegistryFilters, RegistryRow } from "./types";

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

/** Page size for the admin list (services caps limit at 100). */
export const REGISTRY_PAGE_LIMIT = 50;
const FETCH_TIMEOUT_MS = 10_000;

function authHeaders(): Record<string, string> {
  // The admin catalog list sits behind apiKeyAuth — the key is required.
  const apiKey = process.env.SERVICES_API_KEY;
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

async function fetchJson(path: string): Promise<{ status: number; body: unknown } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVICES_URL}${path}`, {
      headers: authHeaders(),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** GET /api/v1/assets/:tokenId → raw detail body (null on network failure). */
export async function fetchAssetDetail(tokenId: string): Promise<unknown | null> {
  if (!/^\d+$/.test(tokenId)) return null;
  const res = await fetchJson(`/api/v1/assets/${tokenId}`);
  if (!res || (res.status !== 200 && res.status !== 404)) return null;
  return res.body;
}

export interface RegistryResult {
  rows: RegistryRow[];
  /** Keyset cursor for the next page (last scanned token id), or null. */
  nextCursor: string | null;
  /** Set when the services catalog could not be reached / rejected the call. */
  error: string | null;
}

/**
 * One page of the org-wide registry: GET /api/v1/admin/catalog with the
 * filters mapped onto the server-side query params. The admin key is
 * injected server-side; rows map through registryRowFromAdminItem (the
 * drift verdict is recomputed client-side).
 */
export async function fetchRegistry(
  filters: RegistryFilters,
  cursor?: string,
): Promise<RegistryResult> {
  const params = new URLSearchParams();
  params.set("limit", String(REGISTRY_PAGE_LIMIT));
  if (cursor !== undefined && /^\d+$/.test(cursor)) params.set("cursor", cursor);
  if (filters.lifecycle !== null) params.set("lifecycle", filters.lifecycle);
  if (filters.drift) params.set("drift", "true");
  if (filters.needsInfo) params.set("needsProductInfo", "true");

  const res = await fetchJson(`/api/v1/admin/catalog?${params.toString()}`);
  if (!res) {
    return {
      rows: [],
      nextCursor: null,
      error: "Could not reach the services catalog (GET /api/v1/admin/catalog)",
    };
  }
  const body = res.body as
    | { ok?: unknown; items?: unknown; nextCursor?: unknown; error?: unknown; message?: unknown }
    | null;
  if (res.status !== 200 || body?.ok !== true || !Array.isArray(body.items)) {
    const detail =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.message === "string"
          ? body.message
          : `services admin catalog returned ${res.status}`;
    return {
      rows: [],
      nextCursor: null,
      error:
        res.status === 401
          ? `${detail} — is SERVICES_API_KEY configured on the server?`
          : detail,
    };
  }

  return {
    rows: body.items.map(registryRowFromAdminItem),
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    error: null,
  };
}
