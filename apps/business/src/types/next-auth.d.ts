import type { DefaultSession } from "next-auth";

import type { Role } from "@/lib/access";

/**
 * What the brand app keeps in the session (TAP-T17): the roster role and the
 * brand, both read on the server. Either one null means "not a brand user".
 */
declare module "next-auth" {
  interface Session {
    user: {
      role: Role | null;
      businessId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role | null;
    businessId?: string | null;
    /** Epoch ms when role and brand were last read from the roster. */
    roleFetchedAt?: number;
  }
}
