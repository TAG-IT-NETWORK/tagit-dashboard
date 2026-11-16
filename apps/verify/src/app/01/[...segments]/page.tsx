/**
 * GS1 Digital Link resolver — the TAG IT DPP landing page.
 *
 * Matches  /01/{GTIN}/21/{serial}?picc=<hex>&cmac=<hex>  (the folder name "01"
 * is the GS1 primary-key AI; the catch-all captures GTIN + qualifier segments).
 *
 * On every tap:
 *   1. verify the SUN crypto from the query  → "is this tag genuine & fresh?"
 *   2. resolve the on-chain twin via the decrypted UID
 *   3. show the result the same way /sun does: the checking frame, then one of
 *      the 12 approved states (<Checking>, <TapVerdict>)
 *
 * Identity (GTIN/serial) comes from the static URL path; proof-of-presence
 * (picc/cmac) from the SUN query the chip rewrites each tap. The identity and
 * the link to the machine-readable passport (a W3C Verifiable Credential,
 * served at /api/dpp/...) sit in the page's Technical details.
 *
 * Server component — the SDM master key + RPC stay on the Vercel Node runtime.
 */
import { Suspense } from "react";

import { Checking } from "@/components/checking";
import type { TechLink, TechRow } from "@/components/consumer";
import { TapResult } from "@/components/tap-result";
import { TapVerdict } from "@/components/tap-verdict";
import { COPY } from "@/lib/consumer-copy";
import { parseGs1Path } from "@/lib/gs1";
import { startTapLookups } from "@/lib/tap-lookups";
import { startTapRun } from "@/lib/tap-run";

export const dynamic = "force-dynamic"; // always re-verify; never cache

interface PageProps {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ picc?: string; cmac?: string; linkType?: string }>;
}

export default async function Gs1ResolverPage({ params, searchParams }: PageProps) {
  const { segments } = await params;
  const link = parseGs1Path(segments);
  const { picc, cmac } = await searchParams;

  // What the link itself says about the product. Technical details only.
  const identity: TechRow[] = [
    ...(link.gtin ? [{ label: COPY.technical.productNumber, value: link.gtin }] : []),
    ...(link.serial ? [{ label: COPY.technical.serial, value: link.serial }] : []),
  ];

  // Identity-only fallback: a static carrier (no SUN) can't prove presence, so
  // nothing was checked. Ask for a tap.
  if (!picc || !cmac) {
    return <TapResult state="linkIncomplete" technical={{ rows: identity, links: [] }} />;
  }

  // Start the check and return at once (TAP-T07): the frame below is sent
  // straight away and the result streams into its place when the check is
  // done. The item record only needs the token id, so it is requested the
  // moment the tag resolves — while the item-state reads run, not after them.
  const run = startTapRun(picc, cmac, startTapLookups);
  const path = `/01/${segments.map(encodeURIComponent).join("/")}`;
  const query = new URLSearchParams({ picc, cmac }).toString();
  const again = `${path}?${query}`;

  // The machine-readable passport for this same tap (the live SUN params are
  // kept on the link). By product number when the link carries one, otherwise
  // by record number once the tap has resolved to an item.
  const serialSeg = link.serial ? `/21/${encodeURIComponent(link.serial)}` : "";
  const passport = (recordNumber: string | null): TechLink[] => {
    const href = link.gtin
      ? `/api/dpp/01/${link.gtin}${serialSeg}?${query}`
      : recordNumber
        ? `/api/dpp/token/${recordNumber}?${query}`
        : null;
    return href ? [{ label: COPY.technical.machinePassport, href }] : [];
  };

  return (
    <Suspense
      fallback={<Checking tagRead={run.tagRead} secondTick={run.secondTick} retryHref={again} />}
    >
      <TapVerdict
        run={run}
        route="/01"
        retryHref={again}
        extra={{ rows: identity, links: passport }}
      />
    </Suspense>
  );
}
