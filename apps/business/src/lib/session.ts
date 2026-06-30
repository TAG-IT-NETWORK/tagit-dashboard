import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-SAFE session / caller-assertion helpers for the business app.
 *
 * Uses ONLY jose + Web Crypto (crypto.subtle) — no `node:crypto`, no `Buffer` —
 * so this module runs in the Next.js Edge middleware runtime as well as in Node
 * route handlers.
 *
 * KEEP IN SYNC WITH tagit-services/src/auth/claims.ts.
 * The cookie name, issuer, audiences, TTLs, role set and claim shapes below are
 * duplicated from that file (the single source of truth on the services side).
 * If they change there, change them here too — otherwise the two HS256 verifiers
 * will silently disagree and valid sessions will be rejected (or vice-versa).
 */

// ── contract constants (duplicated from tagit-services/src/auth/claims.ts) ────
export const SESSION_COOKIE = "tagit_session"; // HttpOnly access JWT
export const ISS = "tagit-services";
export const AUD = "pro.tagit.network"; // access-token (session) audience
export const CALLER_AUD = "tagit-services-relay"; // caller-assertion audience
export const CALLER_TTL_SEC = 60; // 60s caller-assertion (TTL.callerSec)

export const ROLES = ["owner", "admin", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Access-token claims carried in the tagit_session cookie. */
export interface SessionClaims {
  sub: string; // wallet, lowercased 0x...
  uid: string; // users.id
  act: string; // accounts.id (active account / seat)
  role: Role;
  amr: "siwe" | "privy+siwe"; // auth method reference
  chain: number;
  jti: string; // sessions.id (revocation handle)
}

/** Inputs for a short-lived caller-assertion minted per relayed action. */
export interface CallerInput {
  sub: string; // end-user wallet
  act: string; // accounts.id
  cap: string; // capability being exercised, e.g. "BINDER"
  tokenId?: string;
}

/** HS256 secret from the environment (Web-Crypto key bytes). Throws if unset. */
function secretKey(): Uint8Array {
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    throw new Error("SESSION_JWT_SECRET is not configured — the session layer is disabled");
  }
  return new TextEncoder().encode(secret);
}

function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/**
 * Strict AUTH_ENFORCE parse — fail LOUD and fail CLOSED (never open).
 * "true" → enforce; "false"/unset → report-only (dark); any other value → log an
 * error and ENFORCE, so a typo (e.g. "TRUE", "1") can't silently leave the gateway open.
 * Matches the services-side zod behavior of rejecting unknown values rather than
 * degrading to allow-all.
 */
export function isEnforcing(): boolean {
  const raw = process.env.AUTH_ENFORCE;
  const v = (raw ?? "false").trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false" || v === "") return false;
  // eslint-disable-next-line no-console
  console.error(`[auth] invalid AUTH_ENFORCE=${JSON.stringify(raw)} — defaulting to ENFORCE`);
  return true;
}

/**
 * Verify a tagit_session access JWT. Returns the typed claims on success, or
 * `null` on ANY failure — bad signature, wrong iss/aud, expired, malformed claim
 * shape, or a missing/empty token. Callers (middleware, the bind relay) decide
 * what to do with `null` based on AUTH_ENFORCE.
 */
export async function verifySession(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISS,
      audience: AUD,
      algorithms: ["HS256"],
    });
    const { sub, uid, act, role, amr, chain, jti } = payload as Record<string, unknown>;
    if (
      typeof sub !== "string" ||
      typeof uid !== "string" ||
      typeof act !== "string" ||
      !isRole(role) ||
      (amr !== "siwe" && amr !== "privy+siwe") ||
      typeof chain !== "number" ||
      typeof jti !== "string"
    ) {
      return null;
    }
    return { sub, uid, act, role, amr, chain, jti };
  } catch {
    return null;
  }
}

/**
 * Mint a short-lived (60s) HS256 caller-assertion for a single relayed action.
 * Audience is "tagit-services-relay"; the services relay verifies this header
 * to attribute the on-chain action to the end-user wallet + account.
 */
export async function issueCallerAssertion(input: CallerInput): Promise<string> {
  const claims: Record<string, unknown> = {
    sub: input.sub,
    act: input.act,
    cap: input.cap,
  };
  if (input.tokenId !== undefined) claims.tokenId = input.tokenId;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISS)
    .setAudience(CALLER_AUD)
    .setIssuedAt()
    .setJti(crypto.randomUUID()) // unique per assertion → enables single-use replay defense
    .setExpirationTime(`${CALLER_TTL_SEC}s`)
    .sign(secretKey());
}
