import type { Metadata } from "next";

import { EntryFrame } from "@/components/entry-frame";
import { SignInButton } from "@/components/sign-in-button";
import { safeCallbackPath } from "@/lib/access";
import { authConfigured } from "@/lib/auth-config";

export const metadata: Metadata = { title: "Sign in · TAG IT Business" };
export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * The sign-in page (TAP-T17). The address to open afterwards is checked here,
 * on the server: only a page inside the app is accepted.
 */
export default async function SignInPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const redirectTo = safeCallbackPath(params.callbackUrl);
  const failed = params.error !== undefined;
  const open = authConfigured();

  return (
    <EntryFrame>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use the Google account your brand was set up with.
        </p>
      </div>
      {failed && (
        <p role="alert" className="rounded-lg border px-4 py-3 text-sm">
          That sign-in did not go through. Please try again.
        </p>
      )}
      {open ? (
        <SignInButton redirectTo={redirectTo} />
      ) : (
        <p role="status" className="rounded-lg border px-4 py-3 text-sm">
          Sign-in is not open yet. Please check back soon.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Not a customer yet?{" "}
        <a href="/#get-started" className="underline underline-offset-4">
          Request a demo
        </a>
        .
      </p>
    </EntryFrame>
  );
}
