"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@tagit/ui";

/** Starts Google sign-in, then opens `redirectTo` (already checked on the server). */
export function SignInButton({ redirectTo }: { redirectTo: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="h-12 w-full text-base"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn("google", { redirectTo }).catch(() => setBusy(false));
      }}
    >
      {busy ? "Opening Google…" : "Sign in with Google"}
    </Button>
  );
}
