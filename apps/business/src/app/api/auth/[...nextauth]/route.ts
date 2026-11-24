import { handlers } from "@/auth";

/** Sign-in, the Google callback, the session and sign-out. Config: src/auth.ts. */
export const { GET, POST } = handlers;

export const runtime = "nodejs";
