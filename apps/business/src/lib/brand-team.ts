import { hasRole, parseRole, type Role } from "@/lib/access";

/**
 * A brand manages its own team (TAP-T17). PURE logic, unit-tested without a
 * server: who may do it, what is sent, and how untrusted answers are read.
 *
 * - Only a Manager may see or change the team, decided on the server
 *   ({@link canManageTeam}). The API checks it again against the roster.
 * - What is sent is an email and a role. Which brand a person joins is never
 *   the form's to say: it is the signed-in Manager's own brand.
 * - Nobody changes or removes their own account.
 */

/** See and change the team: Managers only. */
export function canManageTeam(role: Role | null): boolean {
  return hasRole(role, "admin");
}

/** The most people a brand's team can hold. */
export const TEAM_MAX = 25;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HIDDEN_RE = /[\p{C}\p{Zl}\p{Zp}]/u;

/** An email as typed: trimmed and lowercased, or null. */
export function parseTeamEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 320) return null;
  if (HIDDEN_RE.test(email) || !EMAIL_RE.test(email)) return null;
  return email;
}

/** One of the three roles, or null. */
export function parseTeamRole(value: unknown): Role | null {
  return parseRole(value);
}

export interface TeamMember {
  email: string;
  role: Role;
}

const ROLE_ORDER: Record<Role, number> = { admin: 0, operator: 1, viewer: 2 };

/**
 * The brand's team as tagit-services sends it, or null when it could not be
 * read. A row of another brand, or of no brand, is never shown. Managers
 * first, then by email.
 */
export function parseTeam(status: number, body: unknown, brandId: string): TeamMember[] | null {
  if (status !== 200 || typeof body !== "object" || body === null) return null;
  const answer = body as { ok?: unknown; users?: unknown };
  if (answer.ok !== true || !Array.isArray(answer.users)) return null;
  const members: TeamMember[] = [];
  const seen = new Set<string>();
  for (const raw of answer.users.slice(0, 200)) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as { email?: unknown; role?: unknown; businessId?: unknown };
    if (row.businessId !== brandId) continue;
    const email = parseTeamEmail(row.email);
    const role = parseRole(row.role);
    if (email === null || role === null || seen.has(email)) continue;
    seen.add(email);
    members.push({ email, role });
  }
  return members.sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.email < b.email ? -1 : 1),
  );
}

export type TeamChange = "add" | "change" | "remove";

export type TeamResult =
  | { kind: "done" }
  | { kind: "already" }
  | { kind: "cannot-add" }
  | { kind: "full" }
  | { kind: "self" }
  | { kind: "not-allowed" }
  | { kind: "gone" }
  | { kind: "failed" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** What the API said. Done only when it names this person in this brand. */
export function parseTeamAnswer(
  status: number,
  body: unknown,
  change: TeamChange,
  email: string,
  brandId: string,
  role: Role | null,
): TeamResult {
  if (!isRecord(body)) return { kind: "failed" };
  if (body.ok === true) {
    if (change === "remove") {
      return status === 200 && body.email === email ? { kind: "done" } : { kind: "failed" };
    }
    const user = isRecord(body.user) ? body.user : {};
    const right =
      status === (change === "add" ? 201 : 200) &&
      user.email === email &&
      user.businessId === brandId &&
      user.role === role;
    return right ? { kind: "done" } : { kind: "failed" };
  }
  const code = body.error;
  if (status === 409 && code === "ADMIN_USER_EXISTS") return { kind: "already" };
  if (status === 409 && code === "BRAND_TEAM_FULL") return { kind: "full" };
  if (status === 409 && code === "BRAND_TEAM_SELF") return { kind: "self" };
  if (status === 403 && code === "BRAND_TEAM_MANAGERS_ONLY") return { kind: "not-allowed" };
  if (status === 404) return { kind: "gone" };
  // The API answers the same way for a mistyped email and for one that
  // already has an account with another brand or with TAG IT.
  if (status === 400 && change === "add") return { kind: "cannot-add" };
  return { kind: "failed" };
}

/** Why it did not happen, in plain words. Never the API's own text. */
export function teamProblem(result: Exclude<TeamResult, { kind: "done" }>): string {
  switch (result.kind) {
    case "already":
      return "That person is already on your team.";
    case "cannot-add":
      return "That email could not be added. Check the spelling. If it is right, the person may already have a TAG IT account elsewhere: ask TAG IT to help.";
    case "full":
      return `Your team already has ${TEAM_MAX} people, which is the most it can hold. Remove someone first.`;
    case "self":
      return "You cannot change or remove your own account. Ask another Manager.";
    case "not-allowed":
      return "Only a Manager of your brand can change the team.";
    case "gone":
      return "That person is no longer on your team. Refresh the page.";
    case "failed":
      return "That could not be done just now. Nothing was changed. Try again in a moment.";
  }
}

/** What each role may do, for the page. */
export const ROLE_NOTES: ReadonlyArray<readonly [Role, string]> = [
  ["viewer", "sees products, items and prices, and changes nothing."],
  ["operator", "also creates and edits products."],
  ["admin", "also publishes products, makes items, sets prices and manages this team."],
];
