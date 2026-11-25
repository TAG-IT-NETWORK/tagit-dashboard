"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@tagit/ui";

/** Ends the session and opens `redirectTo`. */
export function SignOutButton({
  label = "Sign out",
  redirectTo = "/",
  variant = "ghost",
}: {
  label?: string;
  redirectTo?: string;
  variant?: "ghost" | "outline";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut({ redirectTo }).catch(() => setBusy(false));
      }}
    >
      {label}
    </Button>
  );
}
