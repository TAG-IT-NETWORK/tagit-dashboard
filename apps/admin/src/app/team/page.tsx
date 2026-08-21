"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from "@tagit/ui";
import { Loader2, RefreshCw, Trash2, UserPlus, UsersRound } from "lucide-react";

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

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch("/api/team-proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          role: newRole,
          ...(newBusinessId.trim() ? { businessId: newBusinessId.trim() } : {}),
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
    if (!window.confirm(`Remove ${email} from the admin roster? Their next sign-in will have no access.`)) {
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
            Who can sign in to this dashboard, and with which role. Roles apply at the next
            sign-in or session refresh.
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
          <form onSubmit={(e) => void enroll(e)} className="grid gap-4 sm:grid-cols-[2fr,1fr,1.5fr,auto] items-end">
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
              <Label htmlFor="team-business">Business ID (optional)</Label>
              <Input
                id="team-business"
                placeholder="platform-wide when empty"
                value={newBusinessId}
                onChange={(e) => setNewBusinessId(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={enrolling || newEmail.trim().length === 0}>
              {enrolling ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                "Add"
              )}
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
            <p className="text-sm text-muted-foreground py-6 text-center">
              No team members found.
            </p>
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
                      <td className="py-3 pr-4 font-medium">{user.email}</td>
                      <td className="py-3 pr-4">
                        <select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          disabled={busyEmail === user.email}
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
