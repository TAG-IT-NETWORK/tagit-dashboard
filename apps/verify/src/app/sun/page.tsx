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
import Link from "next/link";
import { resolveTap, formatUid, isAuthenticState } from "@/lib/resolve";
import { CONTRACT_ADDRESS, getMetadataForToken, getBuyConfigForToken } from "@/lib/contract";
import { STATES, STATE_DESCRIPTIONS } from "@/lib/states";
import { Shell, StatusHero, DataCard } from "@/components/passport";
import { BuyWidget } from "@/components/buy-widget";

export const dynamic = "force-dynamic"; // always re-verify; never cache

interface SunPageProps {
  searchParams: { picc?: string; cmac?: string };
}

function truncateAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default async function SunVerifyPage({ searchParams }: SunPageProps) {
  const { picc, cmac } = searchParams;
  const res = await resolveTap(picc, cmac);

  if (res.kind === "bad-params") {
    return (
      <Shell>
        <StatusHero tone="warn" glyph="?" title="Bad SUN URL" sub="Missing picc or cmac parameters." />
        <p className="text-center text-xs text-gray-500 font-mono">
          Expected: /sun?picc=&lt;hex&gt;&amp;cmac=&lt;hex&gt;
        </p>
      </Shell>
    );
  }

  if (res.kind === "not-configured") {
    return (
      <Shell>
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
      <Shell>
        <StatusHero tone="bad" glyph="✗" title="Counterfeit" sub="This tap failed cryptographic verification." />
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
      <Shell>
        <StatusHero
          tone="warn"
          glyph="✓"
          title="Chip Authentic"
          sub="Cryptographically verified, but not yet bound on-chain."
        />
        <DataCard rows={[["UID", formatUid(res.uid)], ["Tap counter", String(res.counter)]]} />
      </Shell>
    );
  }

  if (res.kind === "lookup-failed") {
    return (
      <Shell>
        <StatusHero tone="warn" glyph="!" title="Lookup Failed" sub={res.reason} />
      </Shell>
    );
  }

  // ── Resolved ───────────────────────────────────────────────────────────────
  const meta = getMetadataForToken(res.tokenId.toString());
  const state = STATES[res.asset.state] ?? STATES[0];
  const authentic = isAuthenticState(res.asset.state);
  const displayName = meta.productName || `Token #${res.tokenId}`;

  return (
    <Shell>
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
        sub={authentic ? "Verified on-chain via NTAG 424 DNA SUN" : STATE_DESCRIPTIONS[res.asset.state] ?? ""}
      />

      <div className="flex justify-center mb-8 animate-fadeUp" style={{ animationDelay: "0.25s" }}>
        <div
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border ${state.bg} ${state.border}`}
        >
          <span className="w-2 h-2 rounded-full animate-pulse-dot" />
          <span className={`text-sm font-bold tracking-wider ${state.text}`}>{state.label}</span>
        </div>
      </div>

      <DataCard
        rows={[
          ["Product", displayName],
          ["Owner", truncateAddress(res.asset.owner)],
          ["UID", formatUid(res.uid)],
          ["Tap counter", String(res.counter)],
        ]}
      />

      {res.asset.state === 3 && (
        <div className="mt-5">
          <BuyWidget
            tokenId={res.tokenId.toString()}
            productName={displayName}
            priceUsdc={getBuyConfigForToken(res.tokenId.toString()).priceUsdc}
          />
        </div>
      )}

      <div className="text-center mt-5 text-xs text-gray-600 font-mono">
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
