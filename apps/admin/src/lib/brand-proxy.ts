import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/acting-brand";
import { parseRole } from "@/lib/rbac";

/**
 * Shared engine for /api/brand-proxy (TAP-T16): brand records in
 * tagit-services (/api/v1/admin/businesses*), with the services key attached
 * SERVER-SIDE.
 *
 * PLATFORM ADMINS ONLY, checked here from the session itself (the middleware
 * gates the path too; a matcher regression must not open it). A brand user,
 * and a platform user below admin, get 403 and nothing is sent upstream.
 *
 * NEVER SENDS A BUSINESS ID. These calls are the platform's own: services
 * refuses to create, edit or assign for any request that carries one. So the
 * "acting for a brand" choice is deliberately not read here: an admin who is
 * acting for brand A can still manage every brand.
 *
 * Failures answer with upstream's status and its short code, never more.
 */

const DEFAULT_SERVICES_URL = "https://api.tagit.network";
const FETCH_TIMEOUT_MS = 15_000;

export interface BrandProxyRequest {
  method: "GET" | "POST" | "PUT";
  /** Upstream path under /api/v1/admin/businesses. Segments must already be encoded. */
  path: string;
  body?: unknown;
}

export interface PlatformAdmin {
  email: string;
}

/** The signed-in platform admin, or the refusal to answer with. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin | NextResponse> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email;
  if (typeof email !== "string" || email.length === 0) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const businessId = session?.user?.businessId;
  const sessionBusinessId =
    typeof businessId === "string" && businessId.length > 0 ? businessId : null;
  if (!isPlatformAdmin(parseRole(session?.user?.role), sessionBusinessId)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  return { email: email.toLowerCase() };
}

export interface BrandUpstream {
  status: number;
  body: Record<string, unknown>;
}

/** One call to the brand routes as the platform. For the routes below and the acting switch. */
export async function brandUpstream(
  admin: PlatformAdmin,
  { method, path, body }: BrandProxyRequest,
): Promise<BrandUpstream> {
  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) return { status: 503, body: { ok: false, error: "NOT_CONFIGURED" } };
  const servicesUrl = process.env.SERVICES_URL || DEFAULT_SERVICES_URL;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${servicesUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "x-actor": admin.email,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const data: unknown = await upstream.json().catch(() => null);
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return { status: 502, body: { ok: false, error: "UPSTREAM_FAILED" } };
    }
    return { status: upstream.status, body: data as Record<string, unknown> };
  } catch {
    // The error's own words can name the upstream host or this server's settings.
    return { status: 502, body: { ok: false, error: "UPSTREAM_FAILED" } };
  } finally {
    clearTimeout(timer);
  }
}

export async function proxyBrandRequest(request: BrandProxyRequest): Promise<NextResponse> {
  const admin = await requirePlatformAdmin();
  if (admin instanceof NextResponse) return admin;
  const { status, body } = await brandUpstream(admin, request);
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Canonical upstream path for one brand (id URL-encoded). */
export function brandPath(id: string, suffix = ""): string {
  return `/api/v1/admin/businesses/${encodeURIComponent(id)}${suffix}`;
}

export async function readJson(req: Request): Promise<unknown | NextResponse> {
  try {
    return await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }
}
