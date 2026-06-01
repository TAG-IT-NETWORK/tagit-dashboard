/**
 * GS1 Digital Link resolver — the TAG IT DPP landing page.
 *
 * Matches  /01/{GTIN}/21/{serial}?picc=<hex>&cmac=<hex>  (the folder name "01"
 * is the GS1 primary-key AI; the catch-all captures GTIN + qualifier segments).
 *
 * On every tap:
 *   1. verify the SUN crypto from the query  → "is this chip genuine & fresh?"
 *   2. resolve the on-chain twin via the decrypted UID
 *   3. render the Digital Product Passport (identity + lifecycle + anchor)
 *
 * Identity (GTIN/serial) comes from the static URL path; proof-of-presence
 * (picc/cmac) from the SUN query the chip rewrites each tap. A machine-readable
 * W3C Verifiable Credential of the same passport is served at /api/dpp/...
 *
 * Server component — the SDM master key + RPC stay on the Vercel Node runtime.
 */
import Link from "next/link";
import { parseGs1Path } from "@/lib/gs1";
import { resolveTap, formatUid, isAuthenticState } from "@/lib/resolve";
import { buildDpp, loadProduct } from "@/lib/dpp";
import { CONTRACT_ADDRESS } from "@/lib/contract";
import { STATES, STATE_DESCRIPTIONS } from "@/lib/states";
import { Shell, StatusHero, DataCard } from "@/components/passport";

export const dynamic = "force-dynamic"; // always re-verify; never cache

interface PageProps {
  params: { segments: string[] };
  searchParams: { picc?: string; cmac?: string; meta?: string; linkType?: string };
}

export default async function Gs1ResolverPage({ params, searchParams }: PageProps) {
  const link = parseGs1Path(params.segments);
  const { picc, cmac, meta } = searchParams;

  // Identity-only fallback: a static carrier (no SUN) can't prove presence.
  if (!picc || !cmac) {
    return (
      <Shell>
        <StatusHero
          tone="warn"
          glyph="◇"
          title="Tap to Verify"
          sub="Product identity recognized — tap the TAG IT chip to prove authenticity."
        />
        <DataCard
          rows={[
            ["GTIN", link.gtin ?? "—"],
            ["Serial", link.serial ?? "—"],
          ]}
        />
        <p className="text-center text-xs text-gray-600">
          This is a GS1 Digital Link. A live NFC tap adds cryptographic proof-of-presence.
        </p>
      </Shell>
    );
  }

  const res = await resolveTap(picc, cmac);

  if (res.kind === "not-configured") {
    return (
      <Shell>
        <StatusHero
          tone="warn"
          glyph="⚙"
          title="Verifier Not Configured"
          sub="SDM_MASTER_KEY env var is not set on this deployment."
        />
      </Shell>
    );
  }

  if (res.kind === "counterfeit") {
    return (
      <Shell>
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
        <DataCard
          rows={[
            ["GTIN", link.gtin ?? "—"],
            ["Serial", link.serial ?? "—"],
            ["UID", formatUid(res.uid)],
            ["Tap counter", String(res.counter)],
          ]}
        />
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

  // `bad-params` is already handled by the !picc/!cmac guard above; this
  // narrows the union to `resolved` for the renderer below.
  if (res.kind !== "resolved") {
    return (
      <Shell>
        <StatusHero tone="warn" glyph="?" title="Bad SUN URL" sub="Missing picc or cmac parameters." />
      </Shell>
    );
  }

  // ── Resolved — assemble + render the Digital Product Passport ──────────────
  const product = await loadProduct(res.tokenId.toString(), meta);

  const dpp = buildDpp({
    gtin: link.gtin,
    gtinValid: link.gtinValid,
    serial: link.serial,
    tokenId: res.tokenId,
    uid: res.uid,
    counter: res.counter,
    asset: res.asset,
    metadataHash: res.metadataHash,
    product,
    verifiedAt: new Date().toISOString(),
  });

  const authentic = isAuthenticState(dpp.lifecycle.stateCode);
  const state = STATES[dpp.lifecycle.stateCode] ?? STATES[0];
  const displayName = product.name || `Token #${res.tokenId}`;

  // Preserve the live SUN params on the machine-readable VC link.
  const q = new URLSearchParams({ picc, cmac });
  const serialSeg = link.serial ? `/21/${encodeURIComponent(link.serial)}` : "";
  const vcHref = link.gtin
    ? `/api/dpp/01/${link.gtin}${serialSeg}?${q.toString()}`
    : `/api/dpp/token/${res.tokenId}?${q.toString()}`;

  const rows: [string, string][] = [
    ["Product", displayName],
    ...(link.gtin ? ([["GTIN", `${link.gtin}${link.gtinValid ? "" : " ⚠"}`]] as [string, string][]) : []),
    ...(link.serial ? ([["Serial", link.serial]] as [string, string][]) : []),
    ...(product.brand ? ([["Brand", product.brand]] as [string, string][]) : []),
    ...(product.origin ? ([["Origin", product.origin]] as [string, string][]) : []),
    ...(product.msrp ? ([["MSRP", product.msrp]] as [string, string][]) : []),
    ["Owner", `${dpp.lifecycle.owner.slice(0, 6)}…${dpp.lifecycle.owner.slice(-4)}`],
    ["UID", formatUid(res.uid)],
    ["Tap counter", String(res.counter)],
    ["Token ID", res.tokenId.toString()],
    ["Anchor", dpp.integrity.metadataHash ? `${dpp.integrity.metadataHash.slice(0, 10)}…` : "not set"],
  ];

  return (
    <Shell>
      <StatusHero
        tone={authentic ? "ok" : "warn"}
        glyph={authentic ? "✓" : dpp.lifecycle.stateCode === 5 ? "⚑" : "⚠"}
        title={
          authentic
            ? "Authentic"
            : dpp.lifecycle.stateCode === 5
              ? "Flagged"
              : dpp.lifecycle.stateCode === 6
                ? "Retired"
                : "Not Bound"
        }
        sub={
          authentic
            ? "Verified on-chain via NTAG 424 DNA SUN"
            : STATE_DESCRIPTIONS[dpp.lifecycle.stateCode] ?? ""
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

      <DataCard rows={rows} />

      {product.description && (
        <div
          className="rounded-2xl border border-white/10 p-5 mb-5 animate-fadeUp"
          style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.4s" }}
        >
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mb-4 animate-fadeUp">
        <span className="text-sm">&#x1F512;</span>
        <span className="text-xs" style={{ color: "#00D68F" }}>
          Digital Product Passport · GS1 Digital Link · Base
        </span>
      </div>

      <div className="text-center space-y-2 text-xs text-gray-600 font-mono">
        <Link href={vcHref} className="text-[#00D68F] hover:underline block" prefetch={false}>
          View machine-readable passport (JSON-LD)
        </Link>
        <Link
          href={`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:underline block"
        >
          View contract on Base Sepolia
        </Link>
      </div>
    </Shell>
  );
}
