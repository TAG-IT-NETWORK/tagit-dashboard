import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/lib/access";
import {
  canExportSales,
  priceWords,
  saleMethodWords,
  saleStateWords,
  saleTimeWords,
} from "@/lib/brand-numbers";
import { loadBrand } from "@/lib/brand-request";
import { getBrandSales } from "@/lib/brand-services";

export const metadata: Metadata = { title: "Sales · TAG IT Business" };

/** The brand's sales, newest first (TAP-T18). Everyone on the team reads it. */
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string | string[]; file?: string | string[] }>;
}) {
  const [brand, query] = await Promise.all([loadBrand(), searchParams]);
  if (brand === null) redirect(SIGN_IN_PATH);

  const older = typeof query.before === "string";
  const page = await getBrandSales(brand.session, older ? query.before : undefined);
  const manager = canExportSales(brand.session.role);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">
            Items of {brand.profile.name} that were paid for, newest first.
          </p>
        </div>
        {manager ? (
          // A plain link, not a client-side one: the answer is a file.
          <a
            href="/sales/export"
            className="inline-flex h-9 shrink-0 items-center self-start rounded-md border px-4 text-sm font-medium sm:self-auto"
          >
            Download as a file
          </a>
        ) : null}
      </div>

      {query.file === "failed" ? (
        <p role="alert" className="rounded-xl border p-4 text-sm">
          The file could not be made just now. Try again in a moment.
        </p>
      ) : null}

      {page === null ? (
        <p role="alert" className="rounded-xl border p-6 text-sm">
          The sales could not be loaded just now. Refresh the page in a moment.
        </p>
      ) : page.sales.length === 0 ? (
        <p className="rounded-xl border p-6 text-sm text-muted-foreground">
          {older
            ? "There are no older sales."
            : "No sales yet. A sale shows here as soon as an item is paid for."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {page.sales.map((sale) => (
            <li
              key={sale.key}
              className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">
                  {sale.name ?? "Item"}{" "}
                  <span className="font-normal text-muted-foreground">· item {sale.item}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {saleTimeWords(sale.at)} · {saleMethodWords(sale.method)}
                </p>
              </div>
              <div className="flex shrink-0 items-baseline gap-4 sm:flex-col sm:items-end sm:gap-0">
                <span className="font-medium tabular-nums">{priceWords(sale.price)}</span>
                <span className="text-xs text-muted-foreground">{saleStateWords(sale.state)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex gap-6 text-sm">
        {older ? (
          <Link href="/sales" className="underline">
            Newest sales
          </Link>
        ) : null}
        {page?.next ? (
          <Link href={`/sales?before=${encodeURIComponent(page.next)}`} className="underline">
            Older sales
          </Link>
        ) : null}
      </p>

      <p className="max-w-prose text-xs text-muted-foreground">
        Sales made before 28 November 2026 are not listed here. Buyers are never shown.
      </p>
    </div>
  );
}
