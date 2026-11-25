import Image from "next/image";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BrandNav } from "@/components/brand-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SIGN_IN_PATH } from "@/lib/access";
import { loadBrand } from "@/lib/brand-request";
import { brandInitials } from "@/lib/brand-view";

export const dynamic = "force-dynamic";

/**
 * The frame around every brand page (TAP-T17). It reads the session again on
 * the server: if the middleware were ever skipped, nothing here renders
 * without a brand session.
 */
export default async function BrandLayout({ children }: { children: ReactNode }) {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session, profile } = brand;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b px-4 sm:px-6 md:px-10">
        <a href="/home" className="flex min-w-0 items-center gap-3">
          {profile.logoUrl ? (
            // A brand's own logo, from an https address checked in lib/brand-view.ts.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logoUrl}
              alt=""
              width={32}
              height={32}
              referrerPolicy="no-referrer"
              className="h-8 w-8 shrink-0 rounded-md object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
            >
              {brandInitials(profile.name)}
            </span>
          )}
          <span className="truncate font-semibold tracking-tight">{profile.name}</span>
        </a>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground sm:inline">
            {session.email}
          </span>
          <SignOutButton />
        </div>
      </header>
      <nav aria-label="Sections" className="border-b px-4 sm:px-6 md:px-10">
        <BrandNav />
      </nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      <footer className="flex h-14 items-center justify-center gap-2 border-t text-xs text-muted-foreground">
        <Image src="/tagit_logo.png" alt="" width={16} height={16} />
        TAG IT Network
      </footer>
    </div>
  );
}
