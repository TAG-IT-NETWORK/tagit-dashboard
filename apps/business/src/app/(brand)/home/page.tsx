import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import { loadBrand } from "@/lib/brand-request";
import { roleWords } from "@/lib/brand-view";

export const metadata: Metadata = { title: "Home · TAG IT Business" };

/** The brand home (TAP-T17, slice 1: the door). */
export default async function BrandHomePage() {
  const brand = await loadBrand();
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session, profile } = brand;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome, {profile.name}</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {session.email} · {roleWords(session.role)}
        </p>
      </div>
      <section className="rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Your products</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          This is where your products, prices and sales will be. We are setting it up now. Nothing
          is needed from you yet.
        </p>
      </section>
    </div>
  );
}
