import { NextResponse } from "next/server";

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
 */

const DEFAULT_SERVICES_URL = "https://api.tagit.network";

export interface TeamProxyRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Upstream path, e.g. "/api/v1/admin/users". Must already be encoded. */
  path: string;
  body?: unknown;
}

export async function proxyTeamRequest({ method, path, body }: TeamProxyRequest) {
  const session = await auth().catch(() => null);
  const email = session?.user?.email;
  if (typeof email !== "string" || email.length === 0) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasRole(parseRole(session?.user?.role), "admin")) {
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
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const data = await upstream
      .json()
      .catch(() => ({ ok: false, error: `team upstream returned ${upstream.status}` }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

/** Canonical upstream path for one roster row (email URL-encoded). */
export function teamUserPath(email: string): string {
  return `/api/v1/admin/users/${encodeURIComponent(email)}`;
}
