import type { DefaultSession } from "next-auth";

import type { Role } from "@/lib/rbac";

/**
 * Session/JWT augmentation (META-T32): the admin_users role resolved at
 * sign-in rides in the JWT and is surfaced on session.user.role. `null` means
 * "authenticated with Google but not enrolled" — the middleware maps that to
 * /403.
 */
declare module "next-auth" {
  interface Session {
    user: {
      /** admin_users role, or null when the email is not enrolled. */
      role: Role | null;
      /** admin_users business scope: a tenant id for brand users, null for platform users. */
      businessId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role | null;
    /** Tenant scope resolved with the role (null = platform user). */
    businessId?: string | null;
    /** Epoch ms when `role` was last resolved from services (WB-02 TTL). */
    roleFetchedAt?: number;
  }
}
