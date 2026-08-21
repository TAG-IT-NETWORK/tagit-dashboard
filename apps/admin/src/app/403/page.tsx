import Link from "next/link";
import { ShieldX } from "lucide-react";

import { auth } from "@/auth";

/**
 * 403 — signed in, but the admin_users role does not cover the requested
 * area (META-T32). The middleware redirects here; the page itself is
 * session-only (NOT role-gated — a role-less account must be able to see it,
 * see SESSION_ONLY_PATHS in src/lib/rbac.ts).
 */

export const dynamic = "force-dynamic";

export default async function ForbiddenPage() {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  const role = session?.user?.role ?? null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <ShieldX className="h-12 w-12 mx-auto text-destructive" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">403 — Access denied</h1>
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              <span className="text-foreground font-medium">{email}</span>{" "}
              {role ? (
                <>
                  has the <span className="font-mono">{role}</span> role, which does not cover
                  this area.
                </>
              ) : (
                <>is signed in but not enrolled in the admin team roster.</>
              )}
            </>
          ) : (
            <>Your account does not have access to this area.</>
          )}{" "}
          Ask a TAG IT admin to adjust your role on the Team page.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to dashboard
          </Link>
          <a
            href="/api/auth/signout"
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
