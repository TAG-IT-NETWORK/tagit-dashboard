import { handlers } from "@/auth";

/**
 * NextAuth v5 route handlers (META-T32): /api/auth/* — sign-in, Google OAuth
 * callback, session, sign-out. All auth config lives in src/auth.ts.
 */
export const { GET, POST } = handlers;

export const runtime = "nodejs";
