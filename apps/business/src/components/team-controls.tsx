"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label } from "@tagit/ui";

import { addMember, changeMember, type TeamState } from "@/app/(brand)/team/actions";

const NOTHING: TeamState = { problem: null };
const ROLES = [
  ["viewer", "View only"],
  ["operator", "Editor"],
  ["admin", "Manager"],
] as const;
const SELECT =
  "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-sm text-red-700">
      {text}
    </p>
  ) : null;
}

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, NOTHING);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  return (
    <form action={action} className="space-y-3 rounded-xl border p-5">
      <h2 className="font-semibold">Add a person</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={320}
            required
            autoComplete="off"
            className="min-w-56"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-role">May do</Label>
          <select
            id="new-role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={SELECT}
          >
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add person"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        They sign in with Google using this email. No invitation is sent: tell them yourself.
      </p>
      <Problem text={state.problem} />
    </form>
  );
}

export function MemberControls({ email, role }: { email: string; role: string }) {
  const [state, action, pending] = useActionState(changeMember, NOTHING);
  const [chosen, setChosen] = useState(role);
  const [open, setOpen] = useState(false);
  return (
    <details
      className="w-full text-sm"
      open={open || state.problem !== null}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer underline">Change or remove</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="email" value={email} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`role-${email}`}>May do</Label>
            <select
              id={`role-${email}`}
              name="role"
              value={chosen}
              onChange={(event) => setChosen(event.target.value)}
              className={SELECT}
            >
              {ROLES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" name="intent" value="change" disabled={pending || chosen === role}>
            Save
          </Button>
          <Button type="submit" name="intent" value="remove" variant="outline" disabled={pending}>
            Remove from team
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A change takes effect within a few minutes, also for someone who is signed in.
        </p>
        <Problem text={state.problem} />
      </form>
    </details>
  );
}
