import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StartButton, WatchRun } from "@/components/make-items";
import { SIGN_IN_PATH } from "@/lib/access";
import { countWords } from "@/lib/brand-catalog";
import { canMakeItems, parseRunId } from "@/lib/brand-make-items";
import { parseProductId } from "@/lib/brand-product-form";
import { loadBrand } from "@/lib/brand-request";
import { getBrandProduct, getBrandRun } from "@/lib/brand-services";

export const metadata: Metadata = { title: "Make items · TAG IT Business" };

/** Step 2 of making items: confirm, then watch it happen (TAP-T17). Managers only. */
export default async function ItemRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const [brand, { id, runId: rawRunId }] = await Promise.all([loadBrand(), params]);
  if (brand === null) redirect(SIGN_IN_PATH);
  const productId = parseProductId(id);
  const runId = parseRunId(rawRunId);
  // The product first: another brand's product reads as not found, and no
  // run is asked for. Then the run, shown only when it is this product's.
  const product = productId !== null ? await getBrandProduct(brand.session, productId) : null;
  if (product === null || runId === null) notFound();
  if (!canMakeItems(brand.session.role)) redirect(`/products/${product.id}/make`);
  const run = await getBrandRun(brand.session, product.id, runId);
  if (run === null) notFound();

  const items = countWords(run.size, "item", "items");

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm">
        <Link href="/products" className="underline">
          Products
        </Link>
        {" / "}
        <Link href={`/products/${product.id}`} className="underline">
          {product.values.name}
        </Link>
      </p>
      <h1 className="break-words text-3xl font-semibold tracking-tight">Make items</h1>

      {run.state === "waiting" ? (
        <section className="space-y-4 rounded-xl border p-5">
          <h2 className="font-semibold">
            Make {items} of {product.values.name}?
          </h2>
          <p className="text-sm text-muted-foreground">
            Nothing has been made yet. Once you confirm, the{" "}
            {run.size === 1 ? "item is" : "items are"} made and cannot be un-made.
          </p>
          <StartButton productId={product.id} runId={run.id} label={`Make ${items}`} />
          <p className="text-sm">
            <Link href={`/products/${product.id}`} className="underline">
              Cancel
            </Link>
          </p>
        </section>
      ) : null}

      {run.state === "making" ? (
        <section className="space-y-3 rounded-xl border p-5" aria-live="polite">
          <h2 className="font-semibold">Making {items}…</h2>
          <p className="text-sm text-muted-foreground">
            This usually takes under a minute. This page updates by itself, and it is safe to leave
            it.
          </p>
          <WatchRun />
        </section>
      ) : null}

      {run.state === "made" ? (
        <section
          role="status"
          className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900"
        >
          <h2 className="font-semibold">{items} made.</h2>
          <p className="text-sm">Next, TAG IT attaches a tag to each one.</p>
          <p className="text-sm">
            <Link href={`/products/${product.id}/items`} className="underline">
              See this product&apos;s items
            </Link>
          </p>
        </section>
      ) : null}

      {run.state === "failed" ? (
        <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <h2 className="font-semibold">These items were not made.</h2>
          <p className="text-sm">
            Something went wrong on our side. You can try again; nothing is made twice.
          </p>
          <StartButton productId={product.id} runId={run.id} label="Try again" />
        </section>
      ) : null}
    </div>
  );
}
