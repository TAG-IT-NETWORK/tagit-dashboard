/**
 * Server-side catalog registry fetchers (META-T36). Server components and
 * route handlers ONLY — this module reads SERVICES_API_KEY, which must never
 * reach a client bundle.
 *
 * LIMITATION (deliberate, see task notes): tagit-services ships no org-wide
 * ADMIN catalog list endpoint yet — the admin surface is per-token
 * (templates/batches/binding). The registry is therefore assembled from the
 * public enumeration (GET /api/v1/assets/public: visibility='public' AND
 * anchor_status='confirmed' rows only) plus the per-token detail DTO. Items
 * that are restricted, unanchored, or mid-drift do NOT appear in that
 * enumeration; an admin list endpoint would lift this.
 */

import { buildRegistryRow } from "./logic";
import type { RegistryRow } from "./types";

const SERVICES_URL = process.env.SERVICES_URL || "https://api.tagit.network";

/** Upper bound on per-token detail fetches for one page render. */
export const MAX_REGISTRY_SCAN = 150;
const DETAIL_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 10_000;

function authHeaders(): Record<string, string> {
  // The list/detail reads are public today, but send the admin key when
  // configured so the registry keeps working if the surface moves behind auth.
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

/** GET /api/v1/assets/public → ascending tokenId list. */
export async function fetchPublicTokenIds(): Promise<string[] | null> {
  const res = await fetchJson("/api/v1/assets/public");
  if (!res || res.status !== 200) return null;
  const body = res.body as { assets?: Array<{ tokenId?: unknown }> } | null;
  if (!body || !Array.isArray(body.assets)) return null;
  return body.assets
    .map((a) => (typeof a?.tokenId === "string" ? a.tokenId : null))
    .filter((id): id is string => id !== null);
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
  /** Total tokens in the services enumeration (before the scan cap). */
  total: number;
  /** True when total exceeded MAX_REGISTRY_SCAN and the tail was skipped. */
  truncated: boolean;
  /** Set when the services catalog could not be reached at all. */
  error: string | null;
}

/** Concurrency-limited map — keeps the per-token detail fan-out polite. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

/**
 * Assemble the org-wide registry: enumerate public tokens, then fetch each
 * token's detail DTO (concurrency-limited) and map to table rows. A token
 * whose detail fetch fails degrades to a minimal row rather than vanishing.
 */
export async function fetchRegistry(): Promise<RegistryResult> {
  const ids = await fetchPublicTokenIds();
  if (ids === null) {
    return {
      rows: [],
      total: 0,
      truncated: false,
      error: "Could not reach the services catalog (GET /api/v1/assets/public)",
    };
  }

  const scanned = ids.slice(0, MAX_REGISTRY_SCAN);
  const rows = await mapLimit(scanned, DETAIL_CONCURRENCY, async (tokenId) => {
    const body = await fetchAssetDetail(tokenId);
    return buildRegistryRow(tokenId, body);
  });

  return {
    rows,
    total: ids.length,
    truncated: ids.length > scanned.length,
    error: null,
  };
}
