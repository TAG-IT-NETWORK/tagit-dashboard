/**
 * SUN (NTAG 424 DNA Secure Dynamic Messaging) verify landing — legacy carrier.
 *
 * Tags personalized before the GS1 carrier point here:
 *     https://verify.tagit.network/sun?picc=<32 hex>&cmac=<16 hex>
 *
 * Verification + on-chain resolution live in @/lib/resolve (shared with the
 * GS1 Digital Link resolver at /01/...). What the shopper sees — the checking
 * frame, then one of the 12 approved states — is shared too: <Checking> and
 * <TapVerdict>. New chips should be personalized with the GS1 carrier; see
 * DPP-001.
 */
import { headers } from "next/headers";
import { Suspense } from "react";

import { Checking } from "@/components/checking";
import { TapResult } from "@/components/tap-result";
import { TapVerdict } from "@/components/tap-verdict";
import { tapCountryOf } from "@/lib/tap-country";
import { tapDeviceOf } from "@/lib/tap-device";
import { startTapLookups } from "@/lib/tap-lookups";
import { startTapRun } from "@/lib/tap-run";
import { createTapTimer, logTap } from "@/lib/tap-timing";

export const dynamic = "force-dynamic"; // always re-verify; never cache

interface SunPageProps {
  searchParams: Promise<{ picc?: string; cmac?: string }>;
}

export default async function SunVerifyPage({ searchParams }: SunPageProps) {
  const { picc, cmac } = await searchParams;

  // No tap in the address: there is nothing to check, so no checking frame.
  if (!picc || !cmac) {
    const timer = createTapTimer();
    logTap("/sun", "bad-params", timer);
    return <TapResult state="linkIncomplete" timing={timer.header()} />;
  }

  // Start the check and return at once (TAP-T07): the frame below is sent
  // straight away and the verdict streams into its place when the check is
  // done. The item record only needs the item number, so it is requested the
  // moment the tag resolves — WHILE the item-state reads run, not after them.
  // Reviews follow the record (see @/lib/tap-lookups for why not side by side).
  // The device id lets this phone open its own link again for a few minutes;
  // the link itself is opened only once (TAP-T10, see @/lib/resolve).
  const requestHeaders = await headers();
  const device = tapDeviceOf(requestHeaders);
  // The country only, for the brand's tap numbers (TAP-T18).
  const country = tapCountryOf(requestHeaders);
  const run = startTapRun(picc, cmac, startTapLookups, {
    device,
    ...(country ? { country } : {}),
  });
  const again = `/sun?picc=${encodeURIComponent(picc)}&cmac=${encodeURIComponent(cmac)}`;

  return (
    <Suspense
      fallback={<Checking tagRead={run.tagRead} secondTick={run.secondTick} retryHref={again} />}
    >
      <TapVerdict run={run} route="/sun" retryHref={again} />
    </Suspense>
  );
}
