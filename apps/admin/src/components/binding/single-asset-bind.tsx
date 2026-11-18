"use client";

/**
 * "Bind a single asset" card on the Binding Station landing.
 *
 * For tokens minted outside a template batch (Assets → New), which the batch
 * station never lists. Same SUN-first, relayer-bound pipeline as the batch
 * station (see lib/binding/single.ts). Unlike the batch station this card
 * never binds on tap alone: a chip may already sit on the reader when the
 * operator types a token number, so the bind is an explicit button press
 * against the token shown on screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@tagit/ui";
import { AlertTriangle, CheckCircle2, Loader2, Nfc, ShieldAlert, Wand2 } from "lucide-react";
import { getExplorerTxUrl } from "@tagit/contracts";

import type { UseNfcBridge } from "@/lib/nfc-bridge";
import { SUN_BASE_URL } from "@/lib/binding/station";
import {
  parseTokenIdInput,
  readSingleAsset,
  verifyThenBind,
  type ProxyResult,
  type SingleAssetInfo,
  type SingleBindOutcome,
} from "@/lib/binding/single";

const BASE_SEPOLIA = 84532;
const ANCHOR_POLL_MS = 6000;

async function proxyJson(path: string, init?: RequestInit): Promise<ProxyResult> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

const postJson = (path: string, payload: unknown) =>
  proxyJson(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

type AnchorState = "pending" | "confirmed" | "failed";

interface SingleAssetBindProps {
  bridge: UseNfcBridge;
  /** Operator+ may bind; viewers see the card read-only. */
  writable: boolean;
  /** Pre-filled from /station?token=59 (the asset page's Bind button). */
  initialTokenId?: string | null;
}

export function SingleAssetBind({ bridge, writable, initialTokenId = null }: SingleAssetBindProps) {
  const [input, setInput] = useState(initialTokenId ?? "");
  const [asset, setAsset] = useState<SingleAssetInfo | null>(null);
  const [looking, setLooking] = useState(false);
  const [binding, setBinding] = useState(false);
  const [programming, setProgramming] = useState(false);
  const [outcome, setOutcome] = useState<SingleBindOutcome | null>(null);
  const [failedUid, setFailedUid] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  const busyRef = useRef(false);

  const lookUp = useCallback(async (raw: string) => {
    const tokenId = parseTokenIdInput(raw);
    setOutcome(null);
    setAnchor(null);
    if (!tokenId) {
      setAsset(null);
      return;
    }
    setLooking(true);
    const res = await proxyJson(`/api/catalog-proxy/assets/${tokenId}`);
    setAsset(readSingleAsset(tokenId, res.status, res.body));
    setLooking(false);
  }, []);

  // Deep link from the asset page: look the token up once on arrival.
  useEffect(() => {
    if (initialTokenId) void lookUp(initialTokenId);
  }, [initialTokenId, lookUp]);

  // After a bind: poll the anchor (pending → confirmed) like the batch station.
  const boundTokenId = outcome?.ok ? (asset?.tokenId ?? null) : null;
  useEffect(() => {
    if (!boundTokenId || anchor === "confirmed" || anchor === "failed") return;
    let cancelled = false;
    const poll = async () => {
      const res = await proxyJson(`/api/catalog-proxy/assets/${boundTokenId}`);
      if (cancelled) return;
      const v = (res.body?.verification ?? null) as Record<string, unknown> | null;
      const s = typeof v?.anchorStatus === "string" ? v.anchorStatus : null;
      setAnchor(s === "confirmed" ? "confirmed" : s === "failed" ? "failed" : "pending");
    };
    void poll();
    const timer = setInterval(() => void poll(), ANCHOR_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [boundTokenId, anchor]);

  const card = bridge.card;
  const canBind =
    writable &&
    asset?.bindable === true &&
    card !== null &&
    !binding &&
    !programming &&
    !outcome?.ok;

  const bind = useCallback(async () => {
    if (!asset?.bindable || !card || busyRef.current) return;
    busyRef.current = true;
    setBinding(true);
    setOutcome(null);
    try {
      const result = await verifyThenBind({
        tokenId: asset.tokenId,
        uid: card.uid,
        chip: card.chip,
        readNdef: (r) => bridge.request(r),
        postJson,
      });
      setOutcome(result);
      setFailedUid(result.ok ? null : card.uid);
      if (result.ok) setAnchor("pending");
    } finally {
      busyRef.current = false;
      setBinding(false);
    }
  }, [asset, card, bridge]);

  // Factory-fresh chip: personalize SDM on the spot, then retry the bind.
  const canProgram =
    writable &&
    !programming &&
    !binding &&
    outcome?.ok === false &&
    outcome.stage === "sun" &&
    outcome.blank === true &&
    card !== null &&
    card.uid === failedUid &&
    card.chip === "NTAG424DNA";

  const programAndRetry = useCallback(async () => {
    setProgramming(true);
    try {
      await bridge.request({ type: "personalize-sdm", baseUrl: SUN_BASE_URL });
    } catch (err) {
      setOutcome({
        ok: false,
        stage: "sun",
        kind: "unreadable",
        blank: true,
        message: `Program SDM failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      setProgramming(false);
      return;
    }
    setProgramming(false);
    await bind();
  }, [bridge, bind]);

  const reset = () => {
    setInput("");
    setAsset(null);
    setOutcome(null);
    setAnchor(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Nfc className="h-4 w-4 text-emerald-500" /> Bind a single asset
        </CardTitle>
        <CardDescription>
          For an asset minted on its own (Assets → New) — it is not part of a batch, so it never
          shows in the list above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp(input);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="single-token">Asset number</Label>
            <Input
              id="single-token"
              inputMode="numeric"
              placeholder="e.g. 59"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-40"
              disabled={binding || programming}
            />
          </div>
          <Button type="submit" variant="outline" disabled={looking || binding || programming}>
            {looking ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Look up
          </Button>
        </form>

        {input.trim() !== "" && parseTokenIdInput(input) === null && (
          <p className="text-sm text-destructive">Enter the asset number, e.g. 59.</p>
        )}

        {asset && (
          <div className="space-y-3 rounded-md border border-border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  #{asset.tokenId} {asset.name ? `— ${asset.name}` : ""}
                </div>
                <div className="text-muted-foreground">
                  {asset.lifecycle ? `State: ${asset.lifecycle}` : "State unknown"} ·{" "}
                  <Link href={`/assets/${asset.tokenId}`} className="underline">
                    open asset
                  </Link>
                </div>
              </div>
            </div>

            {!asset.bindable && (
              <p className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" /> {asset.reason}
              </p>
            )}

            {asset.bindable && !outcome?.ok && (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  {card ? (
                    <>
                      Chip on reader: <span className="font-mono text-foreground">{card.uid}</span>
                    </>
                  ) : (
                    "Place a chip on the reader."
                  )}
                </p>
                {writable ? (
                  <Button onClick={() => void bind()} disabled={!canBind}>
                    {binding ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Verifying and binding…
                      </>
                    ) : (
                      <>Bind this chip to #{asset.tokenId}</>
                    )}
                  </Button>
                ) : (
                  <p className="text-muted-foreground">Viewer role is read-only.</p>
                )}
              </div>
            )}

            {outcome && !outcome.ok && (
              <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                <p className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {outcome.stage === "sun" ? "Not bound — chip check failed: " : "Not bound: "}
                    {outcome.message}
                  </span>
                </p>
                {canProgram && (
                  <Button size="sm" variant="outline" onClick={() => void programAndRetry()}>
                    {programming ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1 h-4 w-4" />
                    )}
                    Program SDM and retry
                  </Button>
                )}
              </div>
            )}

            {outcome?.ok && (
              <div className="space-y-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
                <p className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" /> Chip bound to #{asset.tokenId}
                  {!outcome.cmacVerified && (
                    <span className="text-amber-500">(counter-only SUN check)</span>
                  )}
                </p>
                {outcome.txHash && (
                  <a
                    href={getExplorerTxUrl(BASE_SEPOLIA, outcome.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs underline"
                  >
                    {outcome.txHash.slice(0, 10)}…{outcome.txHash.slice(-8)}
                  </a>
                )}
                <p className="text-muted-foreground">
                  Product details:{" "}
                  {anchor === "confirmed"
                    ? "published"
                    : anchor === "failed"
                      ? "anchor failed — check the asset page"
                      : "publishing…"}
                </p>
                <Button size="sm" variant="ghost" onClick={reset}>
                  Bind another
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
