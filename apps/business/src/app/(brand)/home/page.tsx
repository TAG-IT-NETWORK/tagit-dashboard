import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import { activeProductCount, countWords, tileNumber } from "@/lib/brand-catalog";
import { loadBrand, loadItemCounts, loadProducts } from "@/lib/brand-request";
import { roleWords } from "@/lib/brand-view";

export const metadata: Metadata = { title: "Home · TAG IT Business" };

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

/** The brand home (TAP-T17, slice 2: the brand's own numbers). */
export default async function BrandHomePage() {
  // All three reads start together: a slow services answer is waited for once.
  const [brand, products, counts] = await Promise.all([
    loadBrand(),
    loadProducts(),
    loadItemCounts(),
  ]);
  if (brand === null) redirect(SIGN_IN_PATH);
  const { session, profile } = brand;

  const productCount = products ? activeProductCount(products) : null;
  const missing = productCount === null || counts === null;
  const nothingYet = productCount === 0 && counts !== null && counts.items === 0;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome, {profile.name}</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {session.email} · {roleWords(session.role)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Products" value={tileNumber(productCount)} hint="In your catalog" />
        <Tile label="Items" value={tileNumber(counts?.items ?? null)} hint="Made so far" />
        <Tile
          label="For sale"
          value={tileNumber(counts?.forSale ?? null)}
          hint="Listed with a price"
        />
        <Tile
          label="With customers"
          value={tileNumber(counts?.withCustomers ?? null)}
          hint="Claimed by their owner"
        />
      </dl>

      {missing ? (
        <p role="status" className="text-sm text-muted-foreground">
          Some numbers could not be loaded just now. Refresh the page in a moment.
        </p>
      ) : null}

      {counts !== null && counts.flagged > 0 ? (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {countWords(counts.flagged, "item is", "items are")} flagged as lost, stolen or under
          review. Your TAG IT contact can tell you more.
        </p>
      ) : null}

      <section className="rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Your products</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {nothingYet
            ? "Nothing is set up yet. Your TAG IT contact adds your first product with you, and it will appear here."
            : "See every product in your catalog, its price and how many items were made."}
        </p>
        {nothingYet ? null : (
          <Link
            href="/products"
            className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            View products
          </Link>
        )}
      </section>
    </div>
  );
}
