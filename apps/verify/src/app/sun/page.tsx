/**
 * SUN (NTAG 424 DNA Secure Dynamic Messaging) verify landing — legacy carrier.
 *
 * Tags personalized before the GS1 carrier point here:
 *     https://verify.tagit.network/sun?picc=<32 hex>&cmac=<16 hex>
 *
 * Verification + on-chain resolution now live in @/lib/resolve (shared with the
 * GS1 Digital Link resolver at /01/...). This page just renders the result. New
 * chips should be personalized with the GS1 carrier; see DPP-001.
 */
import { Suspense } from "react";
import Link from "next/link";
import { resolveTap, formatUid, isAuthenticState } from "@/lib/resolve";
import { CONTRACT_ADDRESS } from "@/lib/contract";
import { heroMedia } from "@/lib/services";
import { HeroImage } from "@/components/hero-image";
import { RatingSummary } from "@/components/rating-summary";
import { RateWidget } from "@/components/rate-widget";
import type { RatingsView } from "@/lib/ratings";
import { STATES, STATE_DESCRIPTIONS } from "@/lib/states";
import { Shell, StatusHero, DataCard } from "@/components/passport";
import { BuyWidget } from "@/components/buy-widget";
import { startTapLookups, type TapLookups } from "@/lib/tap-lookups";
import { createTapTimer, logTap } from "@/lib/tap-timing";

export const dynamic = "force-dynamic"; // always re-verify; never cache

interface SunPageProps {
  searchParams: Promise<{ picc?: string; cmac?: string }>;
}

function truncateAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Owner ratings, streamed. The fetch starts the moment the tag resolves, and
 * the block renders when it lands — the verdict and the product above it are
 * never held back for it.
 */
async function RatingsBlock({
  ratings,
  productName,
}: {
  ratings: Promise<RatingsView | null>;
  productName: string;
}) {
  return <RatingSummary view={await ratings} productName={productName} />;
}

/** Holds the ratings card's place so the page does not jump when it arrives. */
function RatingsPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-white/10 mb-5 h-[76px]"
      style={{ background: "rgba(255,255,255,0.03)" }}
    />
  );
}

export default async function SunVerifyPage({ searchParams }: SunPageProps) {
  const { picc, cmac } = await searchParams;
  const timer = createTapTimer();
  // The item record only needs the item number, so it is requested the moment
  // the tag resolves — WHILE the asset/anchor chain reads run, not after them.
  // Ratings follow the record (see @/lib/tap-lookups for why not side by side).
  const started: { lookups?: TapLookups } = {};
  const res = await resolveTap(
    picc,
    cmac,
    (tokenId) => {
      started.lookups = startTapLookups(tokenId.toString(), timer);
    },
    timer,
  );

  // Every branch below that is not the resolved one renders right away.
  const earlyTiming = timer.header();
  if (res.kind !== "resolved") logTap("/sun", res.kind, timer);

  if (res.kind === "bad-params") {
    return (
      <Shell timing={earlyTiming}>
        <StatusHero
          tone="warn"
          glyph="?"
          title="Bad SUN URL"
          sub="Missing picc or cmac parameters."
        />
        <p className="text-center text-xs text-gray-500 font-mono">
          Expected: /sun?picc=&lt;hex&gt;&amp;cmac=&lt;hex&gt;
        </p>
      </Shell>
    );
  }

  if (res.kind === "not-configured") {
    return (
      <Shell timing={earlyTiming}>
        <StatusHero
          tone="warn"
          glyph="⚙"
          title="Verifier Not Configured"
          sub="SDM_MASTER_KEY env var is not set on this deployment."
        />
        <p className="text-center text-xs text-gray-500 mt-2">
          Set a 16-byte hex key in Vercel and redeploy.
        </p>
      </Shell>
    );
  }

  if (res.kind === "counterfeit") {
    return (
      <Shell timing={earlyTiming}>
        <StatusHero
          tone="bad"
          glyph="✗"
          title="Counterfeit"
          sub="This tap failed cryptographic verification."
        />
        <div
          className="rounded-2xl border border-red-500/30 p-5 mb-5 animate-fadeUp"
          style={{ background: "rgba(239,68,68,0.08)", animationDelay: "0.35s" }}
        >
          <div className="text-red-400 text-sm font-semibold mb-1">Reason</div>
          <div className="text-red-300 text-sm font-mono">{res.reason}</div>
        </div>
        <p className="text-center text-xs text-gray-500">
          Either the URL was tampered with, or the chip wasn&apos;t programmed with the
          deployment&apos;s SDM key.
        </p>
      </Shell>
    );
  }

  if (res.kind === "authentic-unbound") {
    return (
      <Shell timing={earlyTiming}>
        <StatusHero
          tone="warn"
          glyph="✓"
          title="Chip Authentic"
          sub="Cryptographically verified, but not yet bound on-chain."
        />
        <DataCard
          rows={[
            ["UID", formatUid(res.uid)],
            ["Tap counter", String(res.counter)],
          ]}
        />
      </Shell>
    );
  }

  if (res.kind === "lookup-failed") {
    return (
      <Shell timing={earlyTiming}>
        <StatusHero tone="warn" glyph="!" title="Lookup Failed" sub={res.reason} />
      </Shell>
    );
  }

  // ── Resolved ───────────────────────────────────────────────────────────────
  // Product identity from the tagit-services assets API (META-T17 — the old
  // hardcoded metadata map is gone). The lookups were started when the tag
  // resolved; the fallback only runs if that callback somehow did not fire.
  const { product, ratings } = started.lookups ?? startTapLookups(res.tokenId.toString(), timer);
  // `ratings` is NOT awaited: it streams in below and never holds the verdict back.
  const lookup = await product;
  logTap("/sun", "resolved", timer);
  // Restricted items resolve to an EMPTY product — the verdict never resurrects
  // copy the services API chose to redact (same rule as loadProduct in @/lib/dpp).
  const dto = lookup.kind === "record" ? lookup.dto : null;
  const hero = dto ? heroMedia(dto) : undefined;
  const state = STATES[res.asset.state] ?? STATES[0];
  const authentic = isAuthenticState(res.asset.state);
  const displayName = dto?.product?.name || dto?.name || `Token #${res.tokenId}`;
  const brand = dto?.product?.brand;

  return (
    <Shell timing={timer.header()}>
      <StatusHero
        tone={authentic ? "ok" : "warn"}
        glyph={authentic ? "✓" : "⚠"}
        title={
          authentic
            ? "Authentic"
            : res.asset.state === 5
              ? "Flagged"
              : res.asset.state === 6
                ? "Retired"
                : "Not Bound"
        }
        sub={
          authentic
            ? "Verified on-chain via NTAG 424 DNA SUN"
            : (STATE_DESCRIPTIONS[res.asset.state] ?? "")
        }
      />

      <div className="flex justify-center mb-8 animate-fadeUp" style={{ animationDelay: "0.25s" }}>
        <div
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border ${state.bg} ${state.border}`}
        >
          <span className="w-2 h-2 rounded-full animate-pulse-dot" />
          <span className={`text-sm font-bold tracking-wider ${state.text}`}>{state.label}</span>
        </div>
      </div>

      {hero && <HeroImage src={hero.url} alt={displayName} lqip={hero.lqip} priority />}
      <DataCard
        rows={[
          ["Product", brand ? `${brand} · ${displayName}` : displayName],
          ["Owner", truncateAddress(res.asset.owner)],
          ["UID", formatUid(res.uid)],
          ["Tap counter", String(res.counter)],
        ]}
      />

      <Suspense fallback={<RatingsPlaceholder />}>
        <RatingsBlock ratings={ratings} productName={displayName} />
      </Suspense>

      <RateWidget tokenId={res.tokenId.toString()} productName={displayName} />

      {res.asset.state === 3 && (
        <div className="mt-5">
          {/* Price comes from the pricing API inside the widget; it hides
              itself when there is no live listing. */}
          <BuyWidget tokenId={res.tokenId.toString()} productName={displayName} />
        </div>
      )}

      <div className="text-center mt-5 text-sm">
        <Link
          href={`/asset/${res.tokenId.toString()}`}
          className="inline-block rounded-full border border-[#00D68F]/40 px-5 py-2 text-[#00D68F] hover:bg-[#00D68F]/10"
        >
          Open full product passport →
        </Link>
      </div>
      <div className="text-center mt-4 text-xs text-gray-600 font-mono">
        <Link
          href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00D68F] hover:underline"
        >
          View contract on Base Sepolia
        </Link>
      </div>
    </Shell>
  );
}
