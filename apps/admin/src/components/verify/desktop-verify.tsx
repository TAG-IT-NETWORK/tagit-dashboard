"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Nfc,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Usb,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@tagit/ui";
import { getExplorerTxUrl } from "@tagit/contracts";
import { useChainId } from "wagmi";
import { WagmiGuard } from "@/components/wagmi-guard";
import { useNfcBridge } from "@/lib/nfc-bridge";
import { useTokenByTag } from "@/lib/hooks/use-token-by-tag";
import {
  computeVerdict,
  interpretScan,
  readDetail,
  readServerCheck,
  stateName,
  tagHashFromUid,
  type AssetDetail,
  type ScanInterpretation,
  type ServerCheck,
  type Verdict,
} from "@/lib/verify/desktop";

const VERIFY_PUBLIC = "https://verify.tagit.network/asset";

interface LogRow {
  at: number;
  uid: string;
  level: Verdict["level"];
  title: string;
  tokenId: string | null;
}

export function DesktopVerify() {
  return (
    <WagmiGuard>
      <DesktopVerifyContent />
    </WagmiGuard>
  );
}

function DesktopVerifyContent() {
  const chainId = useChainId();
  const bridge = useNfcBridge(true);
  const lastUidRef = useRef<string | null>(null);

  const [cardUid, setCardUid] = useState<string | null>(null);
  const [chip, setChip] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanInterpretation | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [tagHash, setTagHash] = useState<`0x${string}` | null>(null);
  const [manualTokenId, setManualTokenId] = useState<bigint | null>(null);
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [server, setServer] = useState<ServerCheck | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [lookup, setLookup] = useState("");

  const { tokenId: chainTokenId, isLoading: resolving, error: resolveError } = useTokenByTag(tagHash);
  const tokenId: bigint | null = manualTokenId ?? (chainTokenId !== undefined ? chainTokenId : null);

  // ── 1. tap → read + decode ───────────────────────────────────────────────
  const readChip = useCallback(
    async (uid: string, chipType: string) => {
      setScanning(true);
      setScan(null);
      setScanError(null);
      setDetail(null);
      setDetailError(null);
      setServer(null);
      setTagHash(null);
      setManualTokenId(null);
      setCardUid(uid);
      setChip(chipType);
      try {
        const result = await bridge.request({ type: "read-ndef" });
        const interpreted = interpretScan(result);
        setScan(interpreted);
        if (interpreted.kind === "sun") setTagHash(tagHashFromUid(uid));
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err));
      } finally {
        setScanning(false);
      }
    },
    [bridge],
  );

  useEffect(() => {
    if (!bridge.card) {
      lastUidRef.current = null;
      return;
    }
    if (lastUidRef.current === bridge.card.uid) return;
    lastUidRef.current = bridge.card.uid;
    void readChip(bridge.card.uid, bridge.card.chip);
  }, [bridge.card, readChip]);

  // ── 2. token → catalog detail + server SUN check ─────────────────────────
  useEffect(() => {
    if (tokenId === null || tokenId === 0n) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/catalog-proxy/assets/${tokenId.toString()}`, { cache: "no-store" });
        const body: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        const d = readDetail(body);
        if (!d) setDetailError(`asset ${tokenId.toString()} not found in the catalog (${res.status})`);
        else setDetail(d);
      } catch (err) {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : "catalog unreachable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  useEffect(() => {
    if (tokenId === null || tokenId === 0n || !scan || scan.kind !== "sun" || manualTokenId !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/catalog-proxy/binding/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tokenId: tokenId.toString(),
            nfcPayload: {
              uid: `0x${scan.sun.uid.replace(/[^0-9a-fA-F]/g, "").toLowerCase()}`,
              cmac: `0x${scan.sun.cmac.toLowerCase()}`,
              counter: scan.sun.counter,
            },
          }),
        });
        const body: unknown = await res.json().catch(() => null);
        if (!cancelled) setServer(readServerCheck(res.status, body));
      } catch {
        if (!cancelled) setServer(readServerCheck(0, null));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, scan, manualTokenId]);

  // ── 3. verdict + session log ─────────────────────────────────────────────
  const verdict: Verdict | null =
    scan && cardUid
      ? computeVerdict({ scan, cardUid, tokenId: resolving ? null : tokenId, detail, server })
      : null;

  const settled =
    verdict !== null &&
    verdict.title !== "Looking up the token…" &&
    (tokenId === null || tokenId === 0n || detail !== null || detailError !== null);
  useEffect(() => {
    if (!settled || !verdict || !cardUid) return;
    setLog((prev) => {
      const head = prev[0];
      if (head && head.uid === cardUid && head.title === verdict.title) return prev;
      return [
        { at: Date.now(), uid: cardUid, level: verdict.level, title: verdict.title, tokenId: tokenId && tokenId > 0n ? tokenId.toString() : null },
        ...prev,
      ].slice(0, 12);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, verdict?.title]);

  // ── manual lookup (no chip) ──────────────────────────────────────────────
  const runLookup = () => {
    const q = lookup.trim();
    if (!q) return;
    setScan(null);
    setScanError(null);
    setDetail(null);
    setDetailError(null);
    setServer(null);
    setCardUid(null);
    setChip(null);
    if (/^\d+$/.test(q)) {
      setTagHash(null);
      setManualTokenId(BigInt(q));
      return;
    }
    const hash = tagHashFromUid(q);
    if (!hash) {
      setScanError("Enter a token id (55) or a chip UID (04:72:70:8A:FF:18:90)");
      return;
    }
    setManualTokenId(null);
    setCardUid(q);
    setTagHash(hash);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ScanLine className="h-6 w-6 text-emerald-500" /> Verify
          </h1>
          <p className="text-muted-foreground">
            Tap a tagged product on the desktop reader. Same check as the phone: chip signature,
            on-chain binding, and the full product record.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runLookup();
          }}
        >
          <Input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="token id or chip UID"
            className="w-64 font-mono text-sm"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="mr-1 h-4 w-4" /> Look up
          </Button>
        </form>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6 text-sm">
          <span className={`flex items-center gap-2 ${bridge.wsConnected ? "text-green-500" : "text-yellow-500"}`}>
            {bridge.wsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {bridge.wsConnected ? "Bridge connected" : "Bridge not connected"}
          </span>
          <span className={`flex items-center gap-2 ${bridge.readerConnected ? "text-green-500" : "text-muted-foreground"}`}>
            <Usb className="h-4 w-4" />
            {bridge.readerConnected ? (bridge.readerName ?? "Reader connected") : "No reader detected"}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <Nfc className="h-4 w-4" />
            {scanning ? "Reading chip…" : bridge.card ? `${bridge.card.chip} · ${bridge.card.uid}` : "Waiting for a chip…"}
          </span>
        </CardContent>
      </Card>

      {scanError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {scanError}
        </div>
      )}

      {verdict && <VerdictBanner verdict={verdict} />}

      {(scan || manualTokenId !== null) && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ProductCard detail={detail} error={detailError} loading={tokenId !== null && tokenId > 0n && !detail && !detailError} />
          <ChainCard
            tokenId={tokenId}
            resolving={resolving}
            resolveError={resolveError ? String(resolveError.message ?? resolveError) : null}
            detail={detail}
            tagHash={tagHash}
            chainId={chainId}
          />
          <ChipCard cardUid={cardUid} chip={chip} scan={scan} server={server} />
        </div>
      )}

      {detail && detail.provenance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provenance</CardTitle>
            <CardDescription>On-chain history of token #{detail.tokenId}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {detail.provenance.map((e, i) => (
                <li key={`${e.txHash ?? "tx"}-${i}`} className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-0">
                  <span>
                    <span className="font-medium">{e.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{e.type}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {e.timestamp ? new Date(e.timestamp * 1000).toLocaleString() : e.blockNumber ? `block ${e.blockNumber}` : ""}
                    {e.txHash && (
                      <a href={getExplorerTxUrl(chainId, e.txHash)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground" title={e.txHash}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {log.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session log</CardTitle>
            <CardDescription>This browser session only.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono text-xs">
              {log.map((row) => (
                <li key={row.at} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground">{new Date(row.at).toLocaleTimeString()}</span>
                  <span className={levelText(row.level)}>{row.title}</span>
                  <span>{row.uid}</span>
                  {row.tokenId && (
                    <Link href={`/assets/${row.tokenId}`} className="text-primary hover:underline">
                      #{row.tokenId}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function levelText(level: Verdict["level"]): string {
  return level === "authentic"
    ? "text-green-500"
    : level === "tamper"
      ? "text-destructive"
      : level === "warning"
        ? "text-yellow-500"
        : "text-muted-foreground";
}

function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const Icon =
    verdict.level === "authentic" ? ShieldCheck : verdict.level === "tamper" ? ShieldAlert : ShieldQuestion;
  const box =
    verdict.level === "authentic"
      ? "border-green-500/50 bg-green-500/10"
      : verdict.level === "tamper"
        ? "border-destructive/60 bg-destructive/10"
        : verdict.level === "warning"
          ? "border-yellow-500/40 bg-yellow-500/10"
          : "border-border bg-muted/40";
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${box}`}>
      <Icon className={`mt-0.5 h-6 w-6 ${levelText(verdict.level)}`} />
      <div>
        <p className={`text-lg font-semibold ${levelText(verdict.level)}`}>{verdict.title}</p>
        <p className="text-sm text-muted-foreground">{verdict.reason}</p>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function ProductCard({ detail, error, loading }: { detail: AssetDetail | null; error: string | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Product</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading record…
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">No token resolved yet.</p>
        ) : (
          <div className="space-y-3">
            {detail.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.image} alt={detail.name ?? `Token ${detail.tokenId}`} className="h-40 w-full rounded-md object-contain bg-muted/40" />
            )}
            <div>
              <p className="text-lg font-semibold">{detail.name ?? "Untitled"}</p>
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
            </div>
            <div>
              <Row label="Brand" value={detail.product.brand ?? "—"} />
              <Row label="Model" value={detail.product.model ?? "—"} />
              <Row label="SKU" value={detail.product.sku ?? "—"} mono />
              <Row label="Category" value={detail.product.category ?? "—"} />
              <Row label="Origin" value={detail.product.origin ?? "—"} />
              <Row
                label="Price"
                value={
                  detail.price?.display ? (
                    <>
                      {detail.price.display}{" "}
                      <Badge variant="outline" className="ml-1 text-xs">
                        {detail.price.saleState ?? "—"}
                      </Badge>
                    </>
                  ) : (
                    "not listed"
                  )
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChainCard({
  tokenId,
  resolving,
  resolveError,
  detail,
  tagHash,
  chainId,
}: {
  tokenId: bigint | null;
  resolving: boolean;
  resolveError: string | null;
  detail: AssetDetail | null;
  tagHash: `0x${string}` | null;
  chainId: number;
}) {
  const id = tokenId !== null && tokenId > 0n ? tokenId.toString() : null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">On-chain</CardTitle>
      </CardHeader>
      <CardContent>
        {resolving ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Resolving tag on-chain…
          </div>
        ) : resolveError ? (
          <p className="text-sm text-destructive">{resolveError}</p>
        ) : (
          <div>
            <Row label="Token" value={id ? <Link href={`/assets/${id}`} className="font-mono text-primary hover:underline">#{id}</Link> : tokenId === 0n ? "not bound" : "—"} />
            <Row
              label="Lifecycle"
              value={detail ? <Badge variant="secondary">{detail.lifecycleState ?? stateName(detail.stateCode)}</Badge> : "—"}
            />
            <Row label="Owner" value={detail?.owner ?? "—"} mono />
            <Row label="Tag hash" value={tagHash ?? detail?.tagHash ?? "—"} mono />
            <Row
              label="Anchor"
              value={
                detail?.verification
                  ? `${detail.verification.anchorStatus ?? "—"} · v${detail.verification.anchoredVersion ?? "—"}${detail.verification.verified ? " ✓" : ""}`
                  : "—"
              }
            />
            <Row label="Anchored hash" value={detail?.verification?.metadataHash ?? "—"} mono />
            <Row label="Network" value={chainId === 84532 ? "Base Sepolia (84532)" : String(chainId)} />
            {id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/assets/${id}`}>Open in registry</Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={`${VERIFY_PUBLIC}/${id}`} target="_blank" rel="noopener noreferrer">
                    Public verify page <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChipCard({ cardUid, chip, scan, server }: { cardUid: string | null; chip: string | null; scan: ScanInterpretation | null; server: ServerCheck | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Chip</CardTitle>
      </CardHeader>
      <CardContent>
        {!scan ? (
          <p className="text-sm text-muted-foreground">{cardUid ? `Looked up by UID ${cardUid} — no chip read.` : "No chip read."}</p>
        ) : (
          <div>
            <Row label="UID" value={cardUid ?? "—"} mono />
            <Row label="Family" value={chip ?? "—"} />
            <Row label="NDEF records" value={scan.records} />
            {scan.kind === "sun" ? (
              <>
                <Row label="SDM counter" value={scan.sun.counter} />
                <Row
                  label="Signature (bridge)"
                  value={
                    scan.sun.cmacVerified ? (
                      <span className="flex items-center justify-end gap-1 text-green-500"><CheckCircle2 className="h-4 w-4" /> valid</span>
                    ) : (
                      <span className="text-destructive">INVALID</span>
                    )
                  }
                />
                <Row
                  label="Server check"
                  value={
                    server === null ? (
                      "pending"
                    ) : server.skipped ? (
                      <span className="text-muted-foreground">{server.skipped}</span>
                    ) : server.verified ? (
                      <span className="text-green-500">{server.cmacVerified ? "CMAC verified" : "counter check passed"}</span>
                    ) : (
                      <span className="text-destructive">{server.reason ?? "failed"}</span>
                    )
                  }
                />
                <Row label="CMAC" value={scan.sun.cmac} mono />
                <Row label="PICC" value={scan.sun.picc} mono />
              </>
            ) : (
              <Row label="SUN" value={scan.kind === "blank" ? "none (blank chip)" : scan.kind === "undecoded" ? scan.reason : "not a TAG IT record"} />
            )}
            {scan.kind !== "blank" && scan.url && <Row label="URL" value={scan.url} mono />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
