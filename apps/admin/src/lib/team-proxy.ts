import { NextResponse } from "next/server";
import { getTenant, tenantHeader } from "@/lib/actor";

import { auth } from "@/auth";
import { hasRole, parseRole } from "@/lib/rbac";

/**
 * Shared engine for /api/team-proxy (META-T32): server-side pass-through to
 * the tagit-services admin_users CRUD (/api/v1/admin/users*) with the admin
 * API key injected SERVER-SIDE — the key never reaches the browser (same
 * custody pattern as media-proxy/mint-proxy).
 *
 * Defense in depth: the middleware already gates /api/team-proxy to admins,
 * but this re-checks the session itself — a matcher regression must not
 * expose team CRUD. Every forwarded request carries X-Actor (REQ-S-16), so
 * the services audit log names the signed-in human.
 *
 * Brand sessions (TAP-T02): a brand admin manages only its own business's
 * roster. A body that names any other business — including none at all, which
 * would make a platform user — is refused here, before services is called.
 * Services enforces the same rule; this is the second lock.
 *
 * Owner accounts: a roster row in PROTECTED_ADMIN_EMAILS cannot be removed,
 * demoted or moved to a business from the console, whoever is signed in.
 * Refused here before services is called; services holds the same rule.
 */

export const PROTECTED_ADMIN_EMAILS: readonly string[] = ["info@tagit.network"];

/** Case and padding are ignored; a still-encoded address is decoded first. */
export function isProtectedAdmin(email: string): boolean {
  const forms = [email];
  try {
    forms.push(decodeURIComponent(email));
  } catch {
    // Not valid percent-encoding: the raw form is the only one to compare.
  }
  return forms.some((form) => PROTECTED_ADMIN_EMAILS.includes(form.trim().toLowerCase()));
}

/** True when the request would remove, demote or re-home an owner account. */
function weakensOwner(method: TeamProxyRequest["method"], body: unknown): boolean {
  if (method === "DELETE") return true;
  if (method !== "PUT") return false;
  // A body that is not a plain object cannot be read as "changes nothing".
  if (typeof body !== "object" || body === null || Array.isArray(body)) return true;
  const patch = body as { role?: unknown; businessId?: unknown };
  if (patch.role !== undefined && patch.role !== "admin") return true;
  return patch.businessId !== undefined && patch.businessId !== null;
}

const DEFAULT_SERVICES_URL = "https://api.tagit.network";

export interface TeamProxyRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Upstream path, e.g. "/api/v1/admin/users". Must already be encoded. */
  path: string;
  body?: unknown;
  /** The roster row the request acts on (PUT/DELETE), as the route received it. */
  target?: string;
}

export async function proxyTeamRequest({ method, path, body, target }: TeamProxyRequest) {
  const session = await auth().catch(() => null);
  const email = session?.user?.email;
  if (typeof email !== "string" || email.length === 0) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasRole(parseRole(session?.user?.role), "admin")) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (target !== undefined && isProtectedAdmin(target) && weakensOwner(method, body)) {
    return NextResponse.json(
      {
        ok: false,
        error: "This is an owner account. It cannot be removed, demoted or moved to a business.",
        code: "PROTECTED_ADMIN",
      },
      { status: 409 },
    );
  }

  const tenant = await getTenant();
  if (tenant !== null && namesAnotherBusiness(body, tenant)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const apiKey = process.env.SERVICES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SERVICES_API_KEY not configured on the server" },
      { status: 500 },
    );
  }
  const servicesUrl = process.env.SERVICES_URL || DEFAULT_SERVICES_URL;

  try {
    const upstream = await fetch(`${servicesUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "x-actor": email.toLowerCase(),
        ...tenantHeader(tenant),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const data = await upstream
      .json()
      .catch(() => ({ ok: false, error: `team upstream returned ${upstream.status}` }));
    return NextResponse.json(markOwners(data), { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

/** Marks owner rows in a roster list so the page can show them locked. */
function markOwners(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  const users = (data as { users?: unknown }).users;
  if (!Array.isArray(users)) return data;
  return {
    ...data,
    users: users.map((user: unknown) => {
      if (typeof user !== "object" || user === null) return user;
      const row = user as { email?: unknown; protected?: unknown };
      const owner =
        row.protected === true || (typeof row.email === "string" && isProtectedAdmin(row.email));
      return { ...row, protected: owner };
    }),
  };
}

/**
 * True when a roster body carries a `businessId` other than the caller's own.
 * Leaving the field out is fine (services fills in the caller's business).
 */
function namesAnotherBusiness(body: unknown, tenant: string): boolean {
  if (typeof body !== "object" || body === null || !("businessId" in body)) return false;
  return (body as { businessId: unknown }).businessId !== tenant;
}

/** Canonical upstream path for one roster row (email URL-encoded). */
export function teamUserPath(email: string): string {
  return `/api/v1/admin/users/${encodeURIComponent(email)}`;
}
