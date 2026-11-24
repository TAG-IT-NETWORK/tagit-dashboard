import type { BrandSession } from "@/lib/brand-session";
import { parseBrandProfile, type BrandProfile } from "@/lib/brand-view";

/**
 * The one door from the brand app to tagit-services (TAP-T17). SERVER ONLY.
 *
 * Rules, each pinned by a unit test:
 * - a call needs a BrandSession, and is ALWAYS made under that session's
 *   brand: the brand header is set here and cannot be left out or replaced;
 * - the caller cannot pass headers at all, so nothing from the browser can
 *   name another brand, another actor or another key;
 * - only /api/v1/ paths, and only on the configured services host;
 * - the key is read here, on the server, and is never returned or logged.
 *
 * tagit-services checks the brand again on every call; this is the first
 * wall, not the only one.
 */

const DEFAULT_SERVICES_URL = "https://api.tagit.network";
const SERVICES_TIMEOUT_MS = 10_000;

export class BrandServicesError extends Error {
  constructor(public readonly code: "NOT_CONFIGURED" | "NO_BRAND" | "BAD_PATH") {
    super(code);
    this.name = "BrandServicesError";
  }
}

export interface BrandCall {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Sent as JSON. */
  body?: unknown;
}

/** The path must be a plain /api/v1/ path: no host, no dot segments, no tricks. */
export function isServicesPath(path: unknown): path is string {
  if (typeof path !== "string" || !path.startsWith("/api/v1/") || path.length > 1000) return false;
  if (path.includes("//") || path.includes("\\") || path.includes("..")) return false;
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f || code === 0x23 /* # */ || code === 0x40 /* @ */) {
      return false;
    }
  }
  return true;
}

export interface BrandAnswer {
  status: number;
  body: unknown;
}

export async function brandFetch(
  session: BrandSession,
  path: string,
  call: BrandCall = {},
): Promise<BrandAnswer> {
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) throw new BrandServicesError("NOT_CONFIGURED");
  // The type already demands a brand session; check again at run time, so a
  // cast or a bad object can never produce a call with no brand on it.
  if (!session || typeof session.brandId !== "string" || session.brandId.length === 0) {
    throw new BrandServicesError("NO_BRAND");
  }
  if (!isServicesPath(path)) throw new BrandServicesError("BAD_PATH");

  const base = (process.env.SERVICES_URL || DEFAULT_SERVICES_URL).replace(/\/+$/, "");
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "x-business-id": session.brandId,
    "x-actor": session.email,
  };
  const hasBody = call.body !== undefined;
  if (hasBody) headers["content-type"] = "application/json";

  const res = await fetch(`${base}${path}`, {
    method: call.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(call.body) : undefined,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(SERVICES_TIMEOUT_MS),
  });
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** The signed-in brand's own record. Never throws: the page opens regardless. */
export async function getBrandProfile(session: BrandSession): Promise<BrandProfile> {
  try {
    const answer = await brandFetch(
      session,
      `/api/v1/admin/businesses/${encodeURIComponent(session.brandId)}`,
    );
    return parseBrandProfile(answer.status, answer.body, session.brandId);
  } catch {
    return parseBrandProfile(0, null, session.brandId);
  }
}
