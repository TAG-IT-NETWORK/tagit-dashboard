import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AddMemberForm, MemberControls } from "@/components/team-controls";
import { SIGN_IN_PATH } from "@/lib/access";
import { countWords } from "@/lib/brand-catalog";
import { loadBrand } from "@/lib/brand-request";
import { getBrandTeam } from "@/lib/brand-services";
import { canManageTeam, ROLE_NOTES, TEAM_MAX } from "@/lib/brand-team";
import { roleWords } from "@/lib/brand-view";

export const metadata: Metadata = { title: "Team · TAG IT Business" };

const DONE_WORDS: Record<string, string> = {
  added: "Added. They can sign in now.",
  changed: "Changed.",
  removed: "Removed. They can no longer sign in to your brand.",
};

/** The brand's own team (TAP-T17). Managers only. */
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string | string[] }>;
}) {
  const [brand, query] = await Promise.all([loadBrand(), searchParams]);
  if (brand === null) redirect(SIGN_IN_PATH);
  // The gate already keeps everyone but Managers out; this is the second check.
  if (!canManageTeam(brand.session.role)) redirect("/home");

  const team = await getBrandTeam(brand.session);
  const me = brand.session.email.trim().toLowerCase();
  const done =
    typeof query.done === "string" && Object.hasOwn(DONE_WORDS, query.done)
      ? DONE_WORDS[query.done]
      : undefined;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          The people who can sign in for {brand.profile.name}, and what each may do.
        </p>
      </div>

      {done ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {done}
        </p>
      ) : null}

      {team === null ? (
        <p role="alert" className="rounded-xl border p-6 text-sm">
          The team could not be loaded just now. Refresh the page in a moment.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {countWords(team.length, "person", "people")} of up to {TEAM_MAX}.
          </p>
          <ul className="divide-y rounded-xl border">
            {team.map((member) => (
              <li key={member.email} className="space-y-3 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <p className="min-w-0 break-all font-medium">
                    {member.email}
                    {member.email === me ? (
                      <span className="font-normal text-muted-foreground"> · you</span>
                    ) : null}
                  </p>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {roleWords(member.role)}
                  </span>
                </div>
                {member.email === me ? null : (
                  <MemberControls
                    key={`${member.email}:${member.role}`}
                    email={member.email}
                    role={member.role}
                  />
                )}
              </li>
            ))}
          </ul>
          {team.length < TEAM_MAX ? (
            <AddMemberForm />
          ) : (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              Your team is full. Remove someone to add another person.
            </p>
          )}
        </>
      )}

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">What each may do</h2>
        <ul className="list-disc space-y-1 pl-5">
          {ROLE_NOTES.map(([role, note]) => (
            <li key={role}>
              <span className="font-medium text-foreground">{roleWords(role)}</span> {note}
            </li>
          ))}
        </ul>
        <p>Your own account can only be changed by another Manager.</p>
      </section>
    </div>
  );
}
