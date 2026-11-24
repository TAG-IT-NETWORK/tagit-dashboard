import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { NO_ACCESS_PATH, SIGN_IN_PATH, parseBrandId, parseRole } from "@/lib/access";
import { SESSION_MAX_AGE_SECONDS, shouldRefreshRole } from "@/lib/role-refresh";
import { fetchRoster } from "@/lib/roster";
import { mayStartSession } from "@/lib/sign-in-gate";

/**
 * Sign-in for the brand app (TAP-T17). Google is the only provider; there is
 * no wallet and no password.
 *
 * Who gets in: only an email on the TAG IT team roster that belongs to a
 * brand (see lib/sign-in-gate.ts). TAG IT staff and unknown emails are sent
 * to /no-access before any session exists, with the same words.
 *
 * What the session holds: the roster role and the brand id, read on the
 * server with the services key and kept in the session token. Both are read
 * again every five minutes (lib/role-refresh.ts), so a person who is moved
 * or removed loses access without having to sign out. The middleware and the
 * server pages check them on every request.
 *
 * AUTH_SECRET must be this app's own, never the console's: a session made
 * here must not be accepted there.
 */
// Only `handlers` and `auth` are exported: the signIn/signOut helper exports
// trip TS2742 under this tsconfig. The pages use next-auth/react instead.
export const { handlers, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  // Vercel terminates TLS in front of us; the forwarded Host header is
  // platform-controlled, so it is safe to trust for callback URLs.
  trustHost: true,
  pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
  callbacks: {
    async signIn({ account, profile, user }) {
      const identity = await fetchRoster(profile?.email ?? user?.email);
      const allowed = mayStartSession({
        provider: account?.provider,
        emailVerified: profile?.email_verified,
        identity,
      });
      return allowed ? true : NO_ACCESS_PATH;
    },
    async jwt({ token, account, trigger }) {
      const freshSignIn = account !== undefined && account !== null;
      const refresh = shouldRefreshRole({
        freshSignIn,
        trigger,
        roleFetchedAt: token.roleFetchedAt,
        now: Date.now(),
      });
      if (refresh) {
        const identity = await fetchRoster(token.email);
        token.role = identity.role;
        token.businessId = identity.brand;
        token.roleFetchedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = parseRole(token.role);
      session.user.businessId = parseBrandId(token.businessId);
      return session;
    },
  },
});
