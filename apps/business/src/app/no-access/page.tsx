import type { Metadata } from "next";

import { EntryFrame } from "@/components/entry-frame";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "No access · TAG IT Business" };

/**
 * Where every refused sign-in lands (TAP-T17). The words are the same
 * whoever was refused, and say nothing about why.
 */
export default function NoAccessPage() {
  return (
    <EntryFrame>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">This account has no access</h1>
        <p className="text-sm text-muted-foreground">
          This Google account is not set up for a brand on TAG IT. If you think it should be, ask
          the person who manages your brand&apos;s account, or write to us.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <SignOutButton label="Use a different account" redirectTo="/signin" variant="outline" />
        <a href="/" className="text-xs text-muted-foreground underline underline-offset-4">
          Back to the start page
        </a>
      </div>
    </EntryFrame>
  );
}
