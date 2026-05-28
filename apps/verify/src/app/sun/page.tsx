/**
 * SUN (NTAG 424 DNA Secure Dynamic Messaging) verify landing.
 *
 * Server component — runs on the Vercel Node runtime so the SDM master key
 * never reaches the browser. Tags are personalized with an NDEF URL of the form
 *
 *     https://verify.tagit.network/sun?picc=<32 hex>&cmac=<16 hex>
 *
 * The chip recomputes the encrypted PICC payload (UID + monotonic tap counter)
 * and the truncated AES-CMAC on every tap; we verify both server-side using the
 * shared master key (`SDM_MASTER_KEY` env, 16-byte hex). Then we map the UID to
 * an on-chain digital twin (`keccak256(UID)` → `tagId`) and render asset info.
 *
 * No DB yet — the *counter* is shown so anyone can spot a non-increasing tap (a
 * tell of cloning/replay). Per-tag last-seen persistence is a follow-up.
 */
import Link from "next/link";
import { verifySunUrl } from "@/lib/sdm";
import {
  CONTRACT_ADDRESS,
  getAsset,
  getMetadataForToken,
  getTokenByTag,
  uidToTagHash,
} from "@/lib/contract";
import { STATES, STATE_DESCRIPTIONS } from "@/lib/states";

export const dynamic = "force-dynamic"; // always re-verify; never cache

interface SunPageProps {
  searchParams: { picc?: string; cmac?: string };
}

function truncateAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatUid(uidHex: string): string {
  return (uidHex.match(/.{1,2}/g) ?? []).join(":");
}

function getMasterKey(): Buffer | null {
  const hex = process.env.SDM_MASTER_KEY?.trim();
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

export default async function SunVerifyPage({ searchParams }: SunPageProps) {
  const { picc, cmac } = searchParams;

  // ── Shell helpers ────────────────────────────────────────────────────────
  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "#000" }}
      >
        <div className="w-full max-w-[420px] py-[52px] px-5">{children}</div>
      </main>
    );
  }

  function StatusHero({
    tone,
    glyph,
    title,
    sub,
  }: {
    tone: "ok" | "warn" | "bad";
    glyph: string;
    title: string;
    sub: string;
  }) {
    const color = tone === "ok" ? "#00D68F" : tone === "warn" ? "#fbbf24" : "#ef4444";
    return (
      <>
        <div className="flex justify-center mb-6 animate-scaleIn">
          <div className="relative w-[100px] h-[100px]">
            <div
              className="absolute inset-0 rounded-full animate-glowPulse"
              style={{
                background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: `3px solid ${color}`, opacity: 0.3 }}
            />
            <div
              className="absolute inset-[8px] rounded-full flex items-center justify-center"
              style={{ background: `${color}1F` }}
            >
              <span className="text-4xl" style={{ color }}>
                {glyph}
              </span>
            </div>
          </div>
        </div>
        <div className="text-center mb-6 animate-fadeUp" style={{ animationDelay: "0.15s" }}>
          <h1 className="font-syne text-[38px] font-bold leading-tight" style={{ color }}>
            {title}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{sub}</p>
        </div>
      </>
    );
  }

  // ── Input validation ─────────────────────────────────────────────────────
  if (!picc || !cmac) {
    return (
      <Shell>
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

  const masterKey = getMasterKey();
  if (!masterKey) {
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

  // ── Crypto verify ────────────────────────────────────────────────────────
  const result = verifySunUrl(picc, cmac, masterKey);
  if (!result.valid) {
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
          <div className="text-red-300 text-sm font-mono">{result.reason}</div>
        </div>
        <p className="text-center text-xs text-gray-500">
          Either the URL was tampered with, or the chip wasn&apos;t programmed with the
          deployment&apos;s SDM key.
        </p>
      </Shell>
    );
  }

  // ── Verified — now look up the on-chain digital twin ─────────────────────
  const tagHash = uidToTagHash(result.uid);
  let tokenId: bigint = 0n;
  let assetError: string | null = null;
  try {
    tokenId = await getTokenByTag(tagHash);
  } catch {
    assetError = "Could not query chain.";
  }

  // Authentic chip, but no token bound to this UID yet.
  if (!assetError && tokenId === 0n) {
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
            ["UID", formatUid(result.uid)],
            ["Tap counter", String(result.counter)],
          ]}
        />
      </Shell>
    );
  }

  if (assetError || tokenId === 0n) {
    return (
      <Shell>
        <StatusHero tone="warn" glyph="!" title="Lookup Failed" sub={assetError ?? "Unknown."} />
      </Shell>
    );
  }

  const asset = await getAsset(tokenId);
  const meta = getMetadataForToken(tokenId.toString());
  const state = STATES[asset.state] ?? STATES[0];
  const isAuthentic = asset.state >= 1 && asset.state <= 4;
  const displayName = meta.productName || `Token #${tokenId}`;

  return (
    <Shell>
      <StatusHero
        tone={isAuthentic ? "ok" : "warn"}
        glyph={isAuthentic ? "✓" : "⚠"}
        title={
          isAuthentic
            ? "Authentic"
            : asset.state === 5
              ? "Flagged"
              : asset.state === 6
                ? "Retired"
                : "Not Bound"
        }
        sub={
          isAuthentic
            ? "Verified on-chain via NTAG 424 DNA SUN"
            : (STATE_DESCRIPTIONS[asset.state] ?? "")
        }
      />

      {/* State pill */}
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
          ["Owner", truncateAddress(asset.owner)],
          ["UID", formatUid(result.uid)],
          ["Tap counter", String(result.counter)],
        ]}
      />

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

// Tiny rows-of-key-values card — matches the visual language of /tag/[uid].
function DataCard({ rows }: { rows: [string, string][] }) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-5 space-y-0 mb-5 animate-fadeUp"
      style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.35s" }}
    >
      {rows.map(([k, v], i) => (
        <div key={k}>
          {i > 0 && <div className="border-t border-white/5" />}
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-500 text-sm">{k}</span>
            <span className="text-white text-sm font-mono">{v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
