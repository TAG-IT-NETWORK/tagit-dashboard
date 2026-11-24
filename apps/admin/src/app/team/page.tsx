"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from "@tagit/ui";
import { Loader2, Lock, RefreshCw, Trash2, UserPlus, UsersRound } from "lucide-react";

import { parseBrands, type Brand } from "@/lib/brands";
import { ROLES, type Role } from "@/lib/rbac";

/**
 * /team — admin_users roster CRUD (META-T32, admin role only).
 *
 * Talks exclusively to /api/team-proxy (server-side key custody + X-Actor);
 * the browser never sees the services key. The middleware gates this page to
 * the `admin` role and the proxy re-checks the session server-side.
 */

interface AdminUser {
  email: string;
  role: Role;
  businessId: string | null;
  createdAt?: string;
  /** Owner account: the server refuses to remove, demote or re-home it. */
  protected?: boolean;
}

interface RosterResponse {
  ok?: boolean;
  users?: AdminUser[];
  error?: string;
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: "read-only pages",
  operator: "+ drafts, media, batches, binding",
  admin: "+ publish, prices, recovery, team",
};

function roleBadgeVariant(role: Role): "default" | "secondary" | "outline" {
  if (role === "admin") return "default";
  if (role === "operator") return "secondary";
  return "outline";
}

export default function TeamPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  // Enroll form
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [newBusinessId, setNewBusinessId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  // Where a new member can be put (TAP-T16). It must be KNOWN before anyone
  // is added: a request that names no brand makes a platform-wide user when
  // it comes from a platform admin, and a member of the brand when it comes
  // from a brand admin. Until this page knows which of the two it is talking
  // for, the Add button stays off.
  //   loading   not known yet
  //   platform  a platform admin: the brand is chosen from `brands`
  //   acting    a platform admin creating for `actingBrand`: fixed to it
  //   brand     a brand admin: the server puts the member in their brand
  //   unknown   could not find out
  const [scope, setScope] = useState<"loading" | "platform" | "acting" | "brand" | "unknown">(
    "loading",
  );
  const [brands, setBrands] = useState<Brand[]>([]);
  const [actingBrand, setActingBrand] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, who] = await Promise.all([
          fetch("/api/brand-proxy", { cache: "no-store" }),
          fetch("/api/brand-proxy/acting", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        // The brand routes are a platform admin's. This page is an admin's
        // already, so a refusal here means a brand admin.
        if (list.status === 403 && who.status === 403) {
          setScope("brand");
          return;
        }
        if (!list.ok || !who.ok) {
          setScope("unknown");
          return;
        }
        const body = (await list.json()) as { ok?: unknown; businesses?: unknown };
        const acting = ((await who.json()) as { ok?: unknown; acting?: unknown }).acting;
        if (cancelled) return;
        if (body.ok !== true || !Array.isArray(body.businesses)) {
          setScope("unknown");
          return;
        }
        if (typeof acting === "string" && acting.length > 0) {
          setActingBrand(acting);
          setScope("acting");
          return;
        }
        if (acting !== null) {
          setScope("unknown");
          return;
        }
        setBrands(parseBrands(body.businesses));
        setScope("platform");
      } catch {
        if (!cancelled) setScope("unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team-proxy");
      const data = (await res.json()) as RosterResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? `roster fetch failed (${res.status})`);
        setUsers([]);
      } else {
        setUsers(data.users ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Nobody is added before the page knows where they would land.
  const scopeKnown = scope === "platform" || scope === "acting" || scope === "brand";

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    if (!scopeKnown) return;
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch("/api/team-proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          role: newRole,
          // Only a platform admin who is not creating for a brand names one.
          ...(scope === "platform" && newBusinessId ? { businessId: newBusinessId } : {}),
        }),
      });
      const data = (await res.json()) as RosterResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? `enroll failed (${res.status})`);
      } else {
        setNewEmail("");
        setNewBusinessId("");
        setNewRole("viewer");
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnrolling(false);
    }
  }

  async function changeRole(email: string, role: Role) {
    setBusyEmail(email);
    setError(null);
    try {
      const res = await fetch(`/api/team-proxy/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await res.json()) as RosterResponse;
      if (!res.ok || !data.ok) setError(data.error ?? `update failed (${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyEmail(null);
    }
  }

  async function remove(email: string) {
    if (
      !window.confirm(
        `Remove ${email} from the admin roster? Their next sign-in will have no access.`,
      )
    ) {
      return;
    }
    setBusyEmail(email);
    setError(null);
    try {
      const res = await fetch(`/api/team-proxy/${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as RosterResponse;
      if (!res.ok || !data.ok) setError(data.error ?? `delete failed (${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-primary" aria-hidden="true" />
            Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Who can sign in to this dashboard, and with which role. Roles apply at the next sign-in
            or session refresh.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {ROLES.map((role) => (
          <span key={role} className="flex items-center gap-1.5">
            <Badge variant={roleBadgeVariant(role)}>{role}</Badge>
            {ROLE_DESCRIPTIONS[role]}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Enroll */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add team member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => void enroll(e)}
            className="grid gap-4 sm:grid-cols-[2fr,1fr,1.5fr,auto] items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="team-email">Google email</Label>
              <Input
                id="team-email"
                type="email"
                required
                placeholder="person@tagit.network"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-role">Role</Label>
              <select
                id="team-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-business">Brand</Label>
              {scope === "acting" ? (
                <p id="team-business" className="flex h-10 items-center text-sm font-mono">
                  {actingBrand}
                </p>
              ) : scope === "platform" ? (
                <select
                  id="team-business"
                  value={newBusinessId}
                  onChange={(e) => setNewBusinessId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Platform (all brands)</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              ) : scope === "brand" ? (
                <p
                  id="team-business"
                  className="flex h-10 items-center text-sm text-muted-foreground"
                >
                  Your brand
                </p>
              ) : scope === "loading" ? (
                <p
                  id="team-business"
                  className="flex h-10 items-center text-sm text-muted-foreground"
                >
                  Loading…
                </p>
              ) : (
                <p id="team-business" role="alert" className="text-sm text-destructive">
                  Could not load the brands, so nobody can be added yet. Refresh the page.
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={enrolling || !scopeKnown || newEmail.trim().length === 0}
            >
              {enrolling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
              Loading roster…
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No team members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium">Business</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.email} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {user.email}
                        {user.protected && (
                          <Badge variant="outline" className="ml-2 align-middle">
                            Owner
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          disabled={busyEmail === user.email || user.protected === true}
                          title={user.protected ? "Owner account: the role is fixed" : undefined}
                          onChange={(e) => void changeRole(user.email, e.target.value as Role)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {user.businessId ?? <span className="italic">platform</span>}
                      </td>
                      <td className="py-3 text-right">
                        {user.protected ? (
                          <span
                            className="inline-flex h-9 items-center px-3 text-muted-foreground"
                            title="Owner account: cannot be removed"
                          >
                            <Lock className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Owner account, cannot be removed</span>
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${user.email}`}
                            disabled={busyEmail === user.email}
                            onClick={() => void remove(user.email)}
                          >
                            {busyEmail === user.email ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
