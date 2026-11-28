"use server";

import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import { loadBrand } from "@/lib/brand-request";
import {
  addBrandTeamMember,
  changeBrandTeamRole,
  removeBrandTeamMember,
} from "@/lib/brand-services";
import { canManageTeam, parseTeamEmail, parseTeamRole, teamProblem } from "@/lib/brand-team";

/**
 * Team changes (TAP-T17). SERVER ONLY.
 *
 * Every action, before anything else:
 *   1. reads the session on the server. No brand session → sign in.
 *   2. checks the role: a Manager, nobody else. tagit-services checks the
 *      same against the roster, by the signed-in person's email.
 *   3. takes the brand from the session and nothing else. A form cannot name
 *      a brand: a person joins the Manager's own brand.
 *   4. refuses a change to the signed-in person's own account.
 */

export interface TeamState {
  problem: string | null;
}

const MANAGERS_ONLY = "Only a Manager of your brand can change the team.";
const OWN_ACCOUNT = "You cannot change or remove your own account. Ask another Manager.";

export async function addMember(_previous: TeamState, formData: FormData): Promise<TeamState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session } = brand;
  if (!canManageTeam(session.role)) return { problem: MANAGERS_ONLY };

  const email = parseTeamEmail(formData.get("email"));
  const role = parseTeamRole(formData.get("role"));
  if (email === null)
    return { problem: "Enter the person's email address, like name@example.com." };
  if (role === null) return { problem: "Choose what the person may do." };

  const result = await addBrandTeamMember(session, email, role);
  if (result.kind !== "done") return { problem: teamProblem(result) };
  redirect("/team?done=added");
}

export async function changeMember(_previous: TeamState, formData: FormData): Promise<TeamState> {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session } = brand;
  if (!canManageTeam(session.role)) return { problem: MANAGERS_ONLY };

  const email = parseTeamEmail(formData.get("email"));
  if (email === null) return { problem: "That could not be done. Refresh the page and try again." };
  if (email === session.email.trim().toLowerCase()) return { problem: OWN_ACCOUNT };

  if (formData.get("intent") === "remove") {
    const result = await removeBrandTeamMember(session, email);
    if (result.kind !== "done") return { problem: teamProblem(result) };
    redirect("/team?done=removed");
  }
  const role = parseTeamRole(formData.get("role"));
  if (role === null) return { problem: "Choose what the person may do." };
  const result = await changeBrandTeamRole(session, email, role);
  if (result.kind !== "done") return { problem: teamProblem(result) };
  redirect("/team?done=changed");
}
