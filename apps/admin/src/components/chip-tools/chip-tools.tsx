"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, Eraser, KeyRound, Link2, Loader2, Nfc, RefreshCw, Usb, Wand2, Wifi, WifiOff } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@tagit/ui";
import { WagmiGuard } from "@/components/wagmi-guard";
import { useNfcBridge } from "@/lib/nfc-bridge";
import { useTokenByTag } from "@/lib/hooks/use-token-by-tag";
import { SUN_BASE_URL } from "@/lib/binding/station";
import { tagHashFromUid } from "@/lib/verify/desktop";
import { buildUrlRecords, decodeReadResult, estimateUrlBytes, validateHttpsUrl, type DecodedChip } from "@/lib/chip-tools/logic";

type Op = "personalize" | "write-url" | "reset";

interface LogRow {
  at: number;
  uid: string;
  text: string;
  ok: boolean;
}

export function ChipTools({ writable }: { writable: boolean }) {
  return (
    <WagmiGuard>
      <ChipToolsContent writable={writable} />
    </WagmiGuard>
  );
}

function ChipToolsContent({ writable }: { writable: boolean }) {
  const bridge = useNfcBridge(true);
  const lastUidRef = useRef<string | null>(null);
  const [decoded, setDecoded] = useState<DecodedChip | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState<Op | null>(null);
  const [armed, setArmed] = useState<Op | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [sdmBase, setSdmBase] = useState(SUN_BASE_URL);
  const [plainUrl, setPlainUrl] = useState("https://tagit.network");
  const [showRaw, setShowRaw] = useState(false);

  const card = bridge.card;
  const tagHash = card ? tagHashFromUid(card.uid) : null;
  const { tokenId, isLoading: resolving } = useTokenByTag(tagHash);

  const readChip = useCallback(async () => {
    if (!bridge.card) return;
    setReading(true);
    setError(null);
    try {
      const result = await bridge.request({ type: "read-ndef" });
      setRaw(result);
      setDecoded(decodeReadResult(result));
    } catch (err) {
      setDecoded(null);
      setRaw(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReading(false);
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge.card) {
      lastUidRef.current = null;
      setDecoded(null);
      setRaw(null);
      setArmed(null);
      return;
    }
    if (lastUidRef.current === bridge.card.uid) return;
    lastUidRef.current = bridge.card.uid;
    setNotes([]);
    void readChip();
  }, [bridge.card, readChip]);

  const pushLog = (uid: string, text: string, ok: boolean) =>
    setLog((prev) => [{ at: Date.now(), uid, text, ok }, ...prev].slice(0, 20));

  const run = async (op: Op) => {
    if (!card || !writable) return;
    if (armed !== op) {
      setArmed(op);
      return;
    }
    setArmed(null);
    setBusy(op);
    setError(null);
    setNotes([]);
    try {
      if (op === "personalize") {
        const v = validateHttpsUrl(sdmBase);
        if (!v.url) throw new Error(v.error ?? "invalid URL");
        const res = (await bridge.request({ type: "personalize-sdm", baseUrl: v.url })) as { notes?: string[]; urlTemplate?: string };
        setNotes([...(res.notes ?? []), res.urlTemplate ? `template: ${res.urlTemplate}` : ""].filter(Boolean));
        pushLog(card.uid, `Program SDM → ${v.url}`, true);
      } else if (op === "write-url") {
        const v = validateHttpsUrl(plainUrl, { allowQuery: true });
        if (!v.url) throw new Error(v.error ?? "invalid URL");
        const res = (await bridge.request({ type: "write-ndef", records: buildUrlRecords(v.url) })) as { notes?: string[]; bytesWritten?: number };
        setNotes([...(res.notes ?? []), typeof res.bytesWritten === "number" ? `${res.bytesWritten} bytes written` : ""].filter(Boolean));
        pushLog(card.uid, `Plain URL → ${v.url} (SDM off)`, true);
      } else {
        const res = (await bridge.request({ type: "reset-sdm" })) as { notes?: string[] };
        setNotes(res.notes ?? []);
        pushLog(card.uid, "SDM keys reset to factory", true);
      }
      await readChip();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      pushLog(card.uid, `${op} failed: ${msg}`, false);
    } finally {
      setBusy(null);
    }
  };

  const chipOk = !!card && card.chip === "NTAG424DNA";
  const sdmCheck = validateHttpsUrl(sdmBase);
  const plainCheck = validateHttpsUrl(plainUrl, { allowQuery: true });
  const confirmLabel = (op: Op, idle: string) =>
    busy === op ? "Working…" : armed === op ? `Confirm on ${card?.uid ?? "chip"}` : idle;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Cpu className="h-6 w-6 text-emerald-500" /> Chip Tools
        </h1>
        <p className="text-muted-foreground">
          Decode any NTAG 424 DNA on the desktop reader, program SDM against any base URL, write a
          plain URL, or reset the keys. Writes need the operator role and a second click to confirm.
        </p>
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
            {card ? `${card.chip} · ${card.uid}` : "Place a chip on the reader…"}
          </span>
          {card && (
            <Button size="sm" variant="ghost" onClick={() => void readChip()} disabled={reading || busy !== null}>
              <RefreshCw className={`mr-1 h-4 w-4 ${reading ? "animate-spin" : ""}`} /> Re-read
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}
      {notes.length > 0 && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-green-500"><CheckCircle2 className="h-4 w-4" /> Done</p>
          <ul className="list-disc space-y-0.5 pl-5 font-mono text-xs text-muted-foreground">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {/* Decode */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Decode</CardTitle>
          <CardDescription>What is on the chip right now — refreshed on every tap.</CardDescription>
        </CardHeader>
        <CardContent>
          {!card ? (
            <p className="text-sm text-muted-foreground">Waiting for a chip.</p>
          ) : reading && !decoded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading…</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Row label="UID" value={card.uid} mono />
                <Row label="Family" value={card.chip} />
                <Row label="Capacity" value={card.capacityBytes !== null ? `${card.capacityBytes} B` : "—"} />
                <Row label="ATR" value={card.atr || "—"} mono />
                <Row label="Tag hash" value={tagHash ?? "—"} mono />
                <Row
                  label="Token"
                  value={
                    resolving ? "resolving…" : tokenId === undefined ? "—" : tokenId === 0n ? "not bound" : (
                      <Link href={`/assets/${tokenId.toString()}`} className="font-mono text-primary hover:underline">#{tokenId.toString()}</Link>
                    )
                  }
                />
              </div>
              <div>
                <Row label="NDEF records" value={decoded ? decoded.records.length : "—"} />
                {decoded?.records.map((r, i) => (
                  <Row key={i} label={`#${i + 1} ${r.recordType}`} value={r.data} mono />
                ))}
                {decoded?.sun ? (
                  <>
                    <Row label="SUN counter" value={decoded.sun.counter} />
                    <Row label="SUN UID" value={decoded.sun.uid} mono />
                    <Row label="CMAC" value={decoded.sun.cmac} mono />
                    <Row label="PICC" value={decoded.sun.picc} mono />
                    <Row
                      label="Signature"
                      value={decoded.sun.cmacVerified ? <span className="text-green-500">valid under our master key</span> : <span className="text-destructive">INVALID</span>}
                    />
                  </>
                ) : decoded ? (
                  <Row label="SUN" value={decoded.records.length === 0 ? "blank chip" : (decoded.sunError ?? "no TAG IT SUN record")} />
                ) : null}
              </div>
            </div>
          )}
          {raw !== null && (
            <div className="mt-3">
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "hide" : "show"} raw bridge result
              </button>
              {showRaw && <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-[11px]">{JSON.stringify(raw, null, 2)}</pre>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Program SDM */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4" /> Program SDM</CardTitle>
            <CardDescription>Keys + SUN URL template. Re-runnable; this is what the station does for a blank chip.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sdm-base" className="text-xs">Base URL (https, no query)</Label>
              <Input id="sdm-base" value={sdmBase} onChange={(e) => { setSdmBase(e.target.value); setArmed(null); }} className="font-mono text-xs" />
              {sdmCheck.error && <p className="text-xs text-destructive">{sdmCheck.error}</p>}
              {sdmCheck.url && <p className="text-xs text-muted-foreground">≈ {estimateUrlBytes(`${sdmCheck.url}?picc=${"0".repeat(32)}&cmac=${"0".repeat(16)}`)} B of 256</p>}
            </div>
            <Button size="sm" onClick={() => void run("personalize")} disabled={!writable || !chipOk || busy !== null || !!sdmCheck.error}>
              {busy === "personalize" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1 h-3.5 w-3.5" />}
              {confirmLabel("personalize", "Program SDM")}
            </Button>
          </CardContent>
        </Card>

        {/* Plain URL */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" /> Write plain URL</CardTitle>
            <CardDescription>Static link, SDM off — a normal NFC tag with no authenticity check.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="plain-url" className="text-xs">URL (https)</Label>
              <Input id="plain-url" value={plainUrl} onChange={(e) => { setPlainUrl(e.target.value); setArmed(null); }} className="font-mono text-xs" />
              {plainCheck.error && <p className="text-xs text-destructive">{plainCheck.error}</p>}
              {plainCheck.url && <p className="text-xs text-muted-foreground">≈ {estimateUrlBytes(plainCheck.url)} B of 256</p>}
            </div>
            <p className="flex items-start gap-1 text-xs text-yellow-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Turns a TAG IT chip into a plain tag. Program SDM again to restore verification.</p>
            <Button size="sm" variant="outline" onClick={() => void run("write-url")} disabled={!writable || !chipOk || busy !== null || !!plainCheck.error}>
              {busy === "write-url" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1 h-3.5 w-3.5" />}
              {confirmLabel("write-url", "Write URL")}
            </Button>
          </CardContent>
        </Card>

        {/* Reset keys */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Reset SDM keys</CardTitle>
            <CardDescription>Keys 1 + 2 back to factory (needs our master key on the chip). Key 0 is never changed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Use before handing a chip to another deployment, or to recover one programmed with an older master. The URL on the chip stays until you program or write again.</p>
            <Button size="sm" variant="outline" onClick={() => void run("reset")} disabled={!writable || !chipOk || busy !== null}>
              {busy === "reset" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Eraser className="mr-1 h-3.5 w-3.5" />}
              {confirmLabel("reset", "Reset keys")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {!writable && (
        <p className="text-xs text-muted-foreground">Viewer role: decoding only. Programming and resets need the operator role.</p>
      )}
      {card && !chipOk && (
        <p className="text-xs text-yellow-500">Writes are available for NTAG 424 DNA only (detected {card.chip}).</p>
      )}

      {log.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Session log</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono text-xs">
              {log.map((row) => (
                <li key={row.at} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground">{new Date(row.at).toLocaleTimeString()}</span>
                  <Badge variant={row.ok ? "secondary" : "destructive"} className="text-[10px]">{row.ok ? "ok" : "failed"}</Badge>
                  <span>{row.uid}</span>
                  <span className="text-muted-foreground">{row.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
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
