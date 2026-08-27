import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { fetchAdminRole } from "@/lib/admin-role";
import { parseRole } from "@/lib/rbac";
import { SESSION_MAX_AGE_SECONDS, shouldRefreshRole } from "@/lib/role-refresh";

/**
 * NextAuth v5 (Auth.js) — Google sign-in for the admin dashboard (META-T32).
 *
 * Google is the ONLY provider (workspace identities); the retired
 * SITE_PASSWORD shared-secret gate is replaced by this + the per-path role
 * middleware (src/middleware.ts).
 *
 * Role resolution: at sign-in the `jwt` callback asks tagit-services
 * (admin_users roster, server-side key — see src/lib/admin-role.ts) and
 * caches the role IN the session JWT. `useSession().update()` /
 * `unstable_update` re-fetches (trigger === "update") after /team edits.
 * A Google account that is not enrolled signs in fine but carries role null —
 * the middleware sends it to /403 everywhere.
 *
 * WB-02: the cached role also re-resolves WITHOUT user cooperation — every
 * request whose cached role is older than ROLE_TTL_MS (5 min) refetches it
 * (roleFetchedAt claim, pure decision in src/lib/role-refresh.ts). A demoted
 * user loses power within 5 minutes; a user deleted from the roster resolves
 * null and becomes no-role. Session + JWT lifetime is capped at 12 h.
 *
 * Env (see .env.example): AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (provider infers
 * both), AUTH_SECRET. Builds and unit tests run without any of them — config
 * is only asserted per-request.
 */
// NOTE: only `handlers` + `auth` are exported — the signIn/signOut helper
// exports trip TS2742 (non-portable inferred type) under this tsconfig; the
// UI signs in/out via the /api/auth/* pages instead.
export const { handlers, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  // Vercel terminates TLS in front of us; the forwarded Host header is
  // platform-controlled, so it is safe to trust for callback URLs.
  trustHost: true,
  callbacks: {
    async jwt({ token, account, trigger }) {
      const email = typeof token.email === "string" ? token.email : "";
      const freshSignIn = account !== undefined && account !== null;
      const refresh = shouldRefreshRole({
        freshSignIn,
        trigger,
        roleFetchedAt: token.roleFetchedAt,
        now: Date.now(),
      });
      if (email && refresh) {
        token.role = await fetchAdminRole(email);
        token.roleFetchedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = parseRole(token.role);
      return session;
    },
  },
});
