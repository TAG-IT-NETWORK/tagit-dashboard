"use client";

/**
 * Binding station (META-T35) — assembly-line loop over one mint batch.
 *
 * Tap-driven via the local NFC bridge (ws://127.0.0.1:8237, tagit-nfc-bridge,
 * same client as the Assembly Line console): "next up: token #N / serial S" →
 * tap → SUN verify FIRST (REQ-S-21 — a failed SUN NEVER binds; tamper warning
 * + Skip rail) → bind through the server relay proxy → anchor status flip
 * (pending → confirmed) → auto-advance. Server truth makes it resumable:
 * re-entering the page rebuilds the queue from GET /admin/batches/:id and
 * continues at the first unbound token.
 *
 * Keyboard-first for station operators: Enter advances, S opens Skip.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@tagit/ui";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Nfc,
  Recycle,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Undo2,
  Usb,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useNfcBridge } from "@/lib/nfc-bridge";
import { CHIP_SPECS } from "@/lib/nfc-bridge-protocol";
import { VoidRemintWizard } from "@/components/binding/void-remint-wizard";
import type { CatalogRole } from "@/lib/catalog/template-logic";
import { canMutateCatalog, canPublishCatalog } from "@/lib/catalog/template-logic";
import {
  canFixLastBind,
  currentToken,
  graceRemainingMs,
  initialStationState,
  parseBatchTokens,
  pendingQueue,
  stationReducer,
  sunCheckViaBridge,
  type LogEntry,
  type StationState,
  type StationToken,
} from "@/lib/binding/station";

const AUTO_ADVANCE_MS = 1500;
const ANCHOR_POLL_MS = 6000;

type Tab = "station" | "exceptions";

interface BindingStationProps {
  batchId: string;
  role: CatalogRole | null;
  /** Exception-log tab content injected by the page (keeps this file focused). */
  exceptionsTab: React.ReactNode;
}

async function proxyJson(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null }> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

function upstreamError(body: Record<string, unknown> | null, fallback: string): string {
  return typeof body?.error === "string" ? body.error : fallback;
}

export function BindingStation({ batchId, role, exceptionsTab }: BindingStationProps) {
  const writable = canMutateCatalog(role);
  // Void + remint recycles on-chain (irreversible) — admin-only, same posture
  // as batch unstick; the proxy + middleware enforce it server-side too.
  const canVoid = canPublishCatalog(role);
  const bridge = useNfcBridge(true);

  const [state, dispatch] = useReducer(stationReducer, initialStationState);
  const stateRef = useRef<StationState>(state);
  stateRef.current = state;

  const [tab, setTab] = useState<Tab>("station");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [skipOpen, setSkipOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const lastUidRef = useRef<string | null>(null);
  const pipelineBusyRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Batch status (server truth — resume point) ────────────────────────
  const refreshStatus = useCallback(async () => {
    const res = await proxyJson(`/api/catalog-proxy/batches/${batchId}`);
    const tokens = res.ok ? parseBatchTokens(res.body) : null;
    if (tokens === null) {
      setLoadError(upstreamError(res.body, "Could not load the batch from tagit-services"));
      dispatch({ type: "LOAD_FAILED" });
      return;
    }
    setLoadError(null);
    dispatch({ type: "LOAD", tokens });
  }, [batchId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // ── Grace countdown tick (1s while a last bind is armed) ─────────────
  useEffect(() => {
    if (!state.lastBind) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.lastBind]);

  // ── Anchor status polling for the last bind (pending → confirmed) ────
  useEffect(() => {
    const lastBind = state.lastBind;
    if (!lastBind || lastBind.anchorStatus === "confirmed" || lastBind.anchorStatus === "failed") {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const res = await proxyJson(`/api/catalog-proxy/assets/${lastBind.tokenId}`);
      if (cancelled) return;
      const verification = (res.body?.verification ?? null) as Record<string, unknown> | null;
      const status = typeof verification?.anchorStatus === "string" ? verification.anchorStatus : null;
      dispatch({
        type: "ANCHOR",
        status: status === "confirmed" ? "confirmed" : status === "failed" ? "failed" : "pending",
      });
    };
    void poll();
    const timer = setInterval(() => void poll(), ANCHOR_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.lastBind]);

  // ── Advance helpers ──────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    dispatch({ type: "ADVANCE" });
  }, []);

  const scheduleAdvance = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      dispatch({ type: "ADVANCE" });
    }, AUTO_ADVANCE_MS);
  }, []);

  useEffect(
    () => () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    },
    [],
  );

  // ── Tap pipeline: SUN verify FIRST, then bind via relay ──────────────
  const runTapPipeline = useCallback(
    async (uid: string, chip: string) => {
      const token = currentToken(stateRef.current);
      if (!token || pipelineBusyRef.current) return;
      pipelineBusyRef.current = true;
      dispatch({ type: "TAP", uid });
      try {
        // 1. SUN check (REQ-S-21) — chip family, NDEF read, UID match, oracle verify.
        if (chip !== "NTAG424DNA") {
          dispatch({
            type: "SUN_FAIL",
            kind: "tamper",
            message: `Chip reports as ${CHIP_SPECS[chip as keyof typeof CHIP_SPECS]?.label ?? chip}, not NTAG 424 DNA`,
            at: Date.now(),
          });
          return;
        }
        const evaluation = await sunCheckViaBridge(
          (r) => bridge.request(r),
          uid,
        );
        if (!evaluation.ok) {
          dispatch({ type: "SUN_FAIL", kind: evaluation.kind, message: evaluation.message, at: Date.now() });
          return;
        }
        const verifyRes = await proxyJson("/api/catalog-proxy/binding/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tokenId: token.tokenId,
            nfcPayload: {
              uid: evaluation.sun.uidHex,
              cmac: evaluation.sun.cmacHex,
              counter: evaluation.sun.counter,
            },
          }),
        });
        if (verifyRes.status === 0) {
          dispatch({
            type: "SUN_FAIL",
            kind: "unreadable",
            message: "SUN verify service unreachable — binding blocked (fail closed)",
            at: Date.now(),
          });
          return;
        }
        // WB-01: CMAC_INVALID is a cryptographic SDMMAC mismatch — a hard
        // tamper alert. NEVER bind such a chip.
        if (verifyRes.body?.reason === "CMAC_INVALID") {
          dispatch({
            type: "SUN_FAIL",
            kind: "tamper",
            message:
              "CMAC invalid — the chip's SDM MAC failed cryptographic verification. Do not bind or attach this chip.",
            at: Date.now(),
          });
          return;
        }
        if (!verifyRes.ok || verifyRes.body?.verified !== true) {
          dispatch({
            type: "SUN_FAIL",
            kind: "tamper",
            message: upstreamError(verifyRes.body, "SUN verification failed"),
            at: Date.now(),
          });
          return;
        }
        // cmacVerified:false = counter-only check (SDM key not provisioned
        // upstream) — surfaced as an amber badge instead of full green.
        dispatch({ type: "SUN_OK", cmacVerified: verifyRes.body?.cmacVerified === true });

        // 2. Bind via the relayer proxy.
        const bindRes = await proxyJson("/api/catalog-proxy/binding/bind", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tokenId: token.tokenId, tagUid: uid }),
        });
        if (!bindRes.ok || bindRes.body?.ok !== true) {
          dispatch({
            type: "BIND_FAIL",
            error: upstreamError(bindRes.body, `bind failed (${bindRes.status || "network"})`),
            at: Date.now(),
          });
          return;
        }
        dispatch({
          type: "BIND_OK",
          txHash: typeof bindRes.body.txHash === "string" ? bindRes.body.txHash : null,
          at: Date.now(),
        });
        scheduleAdvance();
        void refreshStatus();
      } finally {
        pipelineBusyRef.current = false;
      }
    },
    [bridge, refreshStatus, scheduleAdvance],
  );

  // Tap detection — one pipeline run per physical card-present event.
  useEffect(() => {
    if (!bridge.card) {
      lastUidRef.current = null;
      return;
    }
    if (lastUidRef.current === bridge.card.uid) return;
    lastUidRef.current = bridge.card.uid;
    if (!writable) return;
    if (stateRef.current.phase !== "idle") return;
    void runTapPipeline(bridge.card.uid, bridge.card.chip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.card]);

  // ── Keyboard-first UX: Enter advances, S opens Skip ──────────────────
  useEffect(() => {
    const anyDialogOpen = skipOpen || fixOpen || voidOpen;
    const onKeyDown = (e: KeyboardEvent) => {
      if (anyDialogOpen || !writable) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (e.key === "Enter") {
        if (stateRef.current.phase === "bound") {
          e.preventDefault();
          advance();
        }
      } else if (e.key === "s" || e.key === "S") {
        if (stateRef.current.phase === "idle" && currentToken(stateRef.current)) {
          e.preventDefault();
          setSkipOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, writable, skipOpen, fixOpen, voidOpen]);

  // ── Derived view state ───────────────────────────────────────────────
  const queue = pendingQueue(state.tokens);
  const next = queue[0] ?? null;
  const totalTokens = state.tokens.length;
  const boundTotal = state.tokens.filter((t) => t.lifecycle !== "minted" && t.lifecycle !== "recycled").length;
  const graceLeftMs = graceRemainingMs(state.lastBind, now);
  const fixEnabled = writable && canFixLastBind(state, now);

  const onVoided = useCallback(
    (tokenId: string, replacementTokenId: string | null) => {
      dispatch({ type: "VOID_DONE", tokenId, replacementTokenId, at: Date.now() });
      void refreshStatus();
    },
    [refreshStatus],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Nfc className="h-6 w-6" />
            Binding station
          </h1>
          <p className="text-muted-foreground">
            Batch <code className="text-sm">{batchId}</code> — {boundTotal}/{totalTokens} bound,{" "}
            {queue.length} to go. Enter advances, S skips.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border p-1">
          {(["station", "exceptions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "station" ? "Station" : "Exception log"}
            </button>
          ))}
        </div>
      </div>

      {!writable && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
          Read-only: your role cannot bind. Taps are ignored.
        </div>
      )}
      {loadError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {tab === "exceptions" ? (
        exceptionsTab
      ) : (
        <>
          <BridgeStatus bridge={bridge} />

          <NextUpCard
            state={state}
            next={next}
            queueLength={queue.length}
            writable={writable}
            onAdvance={advance}
            onSkip={() => setSkipOpen(true)}
            onDismiss={() => dispatch({ type: "DISMISS_WARNING" })}
          />

          <LastBindCard
            state={state}
            graceLeftMs={graceLeftMs}
            fixEnabled={fixEnabled}
            canVoid={canVoid}
            onFix={() => setFixOpen(true)}
            onVoid={() => setVoidOpen(true)}
          />

          {state.sessionLog.length > 0 && <SessionLogCard log={state.sessionLog} />}
        </>
      )}

      <SkipDialog
        open={skipOpen}
        onOpenChange={setSkipOpen}
        token={next}
        batchId={batchId}
        tapUid={state.tapUid}
        onSkipped={(reason) => {
          dispatch({ type: "SKIP_RECORDED", reason, at: Date.now() });
          void refreshStatus();
        }}
      />
      <FixLastBindDialog
        open={fixOpen}
        onOpenChange={setFixOpen}
        state={state}
        graceLeftMs={graceLeftMs}
        defaultTarget={next?.tokenId ?? ""}
        onReassigned={(targetTokenId) => {
          dispatch({ type: "REASSIGN_DONE", targetTokenId, at: Date.now() });
          void refreshStatus();
        }}
      />
      <VoidRemintWizard
        open={voidOpen}
        onOpenChange={setVoidOpen}
        initialTokenId={state.lastBind?.tokenId ?? next?.tokenId ?? ""}
        onVoided={onVoided}
      />
    </div>
  );
}

// ── Bridge status ─────────────────────────────────────────────────────────

function BridgeStatus({ bridge }: { bridge: ReturnType<typeof useNfcBridge> }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-6">
          <span className={`flex items-center gap-2 text-sm ${bridge.wsConnected ? "text-green-500" : "text-yellow-500"}`}>
            {bridge.wsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {bridge.wsConnected ? "Bridge connected" : "Bridge not connected"}
          </span>
          <span className={`flex items-center gap-2 text-sm ${bridge.readerConnected ? "text-green-500" : "text-yellow-500"}`}>
            <Usb className="h-4 w-4" />
            {bridge.readerConnected ? (bridge.readerName ?? "Reader connected") : "No reader detected"}
          </span>
          {bridge.card && (
            <span className="flex items-center gap-2 font-mono text-sm">
              <Nfc className="h-4 w-4 animate-pulse text-primary" />
              {bridge.card.uid}
              <Badge variant="secondary">{CHIP_SPECS[bridge.card.chip].label}</Badge>
            </span>
          )}
        </div>
        {bridge.error && !bridge.wsConnected && (
          <p className="mt-3 text-sm text-muted-foreground">{bridge.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Next-up card ──────────────────────────────────────────────────────────

function NextUpCard({
  state,
  next,
  queueLength,
  writable,
  onAdvance,
  onSkip,
  onDismiss,
}: {
  state: StationState;
  next: StationToken | null;
  queueLength: number;
  writable: boolean;
  onAdvance: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}) {
  if (state.phase === "loading") {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading batch…
        </CardContent>
      </Card>
    );
  }

  if (state.phase === "complete" || next === null) {
    return (
      <Card className="border-green-500/50">
        <CardContent className="flex items-center gap-3 pt-6">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium">Batch complete — every token is bound.</p>
            <p className="text-sm text-muted-foreground">
              {state.boundCount} bound in this session. Check the exception log for skips and fixes.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="text-lg">
          Next up: token #{next.tokenId}
          {next.serial && <span className="text-muted-foreground"> / serial {next.serial}</span>}
        </CardTitle>
        <CardDescription>{queueLength} unbound in queue (serial order)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.phase === "idle" && !state.sunFail && !state.bindError && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Nfc className="h-4 w-4 animate-pulse" />
            {writable ? "Tap the chip for this item on the reader…" : "Read-only — taps ignored."}
          </p>
        )}
        {state.phase === "verifying" && (
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Verifying SUN (chip authenticity)…
          </p>
        )}
        {state.phase === "binding" && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <CmacBadge cmacVerified={state.cmacVerified === true} />
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            binding via relay…
          </p>
        )}
        {state.phase === "bound" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>
              Bound. Advancing — or press <kbd className="rounded border px-1">Enter</kbd>.
            </span>
            <CmacBadge cmacVerified={state.cmacVerified === true} />
            <Button size="sm" variant="outline" onClick={onAdvance}>
              Next
            </Button>
          </div>
        )}

        {state.sunFail && (
          <div
            className={`rounded-md border p-3 text-sm ${
              state.sunFail.kind === "tamper"
                ? "border-destructive/60 bg-destructive/10"
                : "border-yellow-500/40 bg-yellow-500/10"
            }`}
          >
            <p
              className={`flex items-center gap-2 font-medium ${
                state.sunFail.kind === "tamper" ? "text-destructive" : "text-yellow-500"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              {state.sunFail.kind === "tamper"
                ? "TAMPER WARNING — SUN verification failed. Do not attach this chip."
                : "Chip could not be verified — binding blocked (fail closed)."}
            </p>
            {/* Bridge/server detail — rendered inert. */}
            <p className="mt-1 text-muted-foreground">{state.sunFail.message}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={onSkip} disabled={!writable}>
                <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip defective chip
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
        {state.bindError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Bind failed — tap again to retry.
            </p>
            <p className="mt-1 text-muted-foreground">{state.bindError}</p>
          </div>
        )}

        {state.phase === "idle" && !state.sunFail && (
          <div>
            <Button size="sm" variant="outline" onClick={onSkip} disabled={!writable}>
              <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip defective chip (S)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Last-bind card (grace countdown + anchor flip + recovery rails) ───────

function LastBindCard({
  state,
  graceLeftMs,
  fixEnabled,
  canVoid,
  onFix,
  onVoid,
}: {
  state: StationState;
  graceLeftMs: number;
  fixEnabled: boolean;
  /** Admin-only: void + remint recycles the token on-chain (irreversible). */
  canVoid: boolean;
  onFix: () => void;
  onVoid: () => void;
}) {
  const lastBind = state.lastBind;
  if (!lastBind) return null;
  const seconds = Math.ceil(graceLeftMs / 1000);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Last bind</CardTitle>
        <CardDescription>
          Token #{lastBind.tokenId}
          {lastBind.serial ? ` / serial ${lastBind.serial}` : ""} — chip{" "}
          <span className="font-mono">{lastBind.uid}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <AnchorBadge status={lastBind.anchorStatus} />
          <CmacBadge cmacVerified={lastBind.cmacVerified} />
          {lastBind.txHash && (
            <code className="text-xs text-muted-foreground">{lastBind.txHash.slice(0, 10)}…{lastBind.txHash.slice(-6)}</code>
          )}
          {graceLeftMs > 0 ? (
            <span className="text-muted-foreground">
              Anchor grace: <span className="font-mono">{seconds}s</span> left
            </span>
          ) : (
            <span className="text-muted-foreground">Anchor grace expired</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onFix}
            disabled={!fixEnabled}
            title={
              fixEnabled
                ? "Swap this bind's content with another token (wrong physical item tapped)"
                : "Only available during the 120s anchor grace window"
            }
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" /> Fix last bind{graceLeftMs > 0 ? ` (${seconds}s)` : ""}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onVoid}
            disabled={!canVoid}
            title={
              canVoid
                ? "Recycle this token on-chain and remint the content as a fresh token"
                : "Requires the admin role (irreversible on-chain recycle)"
            }
          >
            <Recycle className="mr-1 h-3.5 w-3.5" /> Void + remint…
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * WB-01: SUN check depth for a tap/bind. Full green ONLY when the server
 * cryptographically verified the SDMMAC; amber = counter-only check (SDM key
 * not provisioned upstream), so the operator knows the crypto rail was not
 * exercised.
 */
function CmacBadge({ cmacVerified }: { cmacVerified: boolean }) {
  if (cmacVerified) {
    return (
      <Badge variant="success" className="gap-1">
        <ShieldCheck className="h-3 w-3" /> SUN + CMAC verified
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 bg-yellow-500/15 text-yellow-500"
      title="Verified via SUN counter + on-chain state only — the SDM master key is not provisioned on the server, so the chip's CMAC was not cryptographically checked."
    >
      <ShieldAlert className="h-3 w-3" /> counter-only check (SDM key not provisioned)
    </Badge>
  );
}

function AnchorBadge({ status }: { status: "unknown" | "pending" | "confirmed" | "failed" }) {
  if (status === "confirmed") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Anchor confirmed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Anchor failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" /> Anchor pending
    </Badge>
  );
}

// ── Session log ───────────────────────────────────────────────────────────

const LOG_LABEL: Record<LogEntry["kind"], string> = {
  bound: "Bound",
  sun_fail: "SUN fail",
  bind_fail: "Bind fail",
  skipped: "Chip skipped",
  reassigned: "Fixed (reassign)",
  voided: "Void + remint",
};

function SessionLogCard({ log }: { log: LogEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Session log</CardTitle>
        <CardDescription>This browser session only — the durable trail is the exception log.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {log.slice(0, 30).map((entry, i) => (
            <li key={`${entry.at}-${i}`} className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs text-muted-foreground">
                {new Date(entry.at).toLocaleTimeString()}
              </span>
              <span className="font-medium">{LOG_LABEL[entry.kind]}</span>
              <span>
                #{entry.tokenId}
                {entry.serial ? ` / ${entry.serial}` : ""}
              </span>
              {/* Free text — inert text node. */}
              {entry.detail && <span className="text-muted-foreground">{entry.detail}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Skip dialog ───────────────────────────────────────────────────────────

function SkipDialog({
  open,
  onOpenChange,
  token,
  batchId,
  tapUid,
  onSkipped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: StationToken | null;
  batchId: string;
  tapUid: string | null;
  onSkipped: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!token || reason.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const res = await proxyJson("/api/catalog-proxy/binding/skip-defective", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tokenId: token.tokenId,
        batchId,
        ...(tapUid ? { tagUid: tapUid } : {}),
        reason: reason.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok || res.body?.ok !== true) {
      setError(upstreamError(res.body, "skip-defective failed"));
      return;
    }
    onOpenChange(false);
    onSkipped(reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip defective chip</DialogTitle>
          <DialogDescription>
            Records an exception for token #{token?.tokenId ?? "?"} and keeps it next in queue —
            grab a fresh chip for the same item. No chain transaction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="skip-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <textarea
            id="skip-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="e.g. chip dead on tap / failed SUN — required, goes to the exception log"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || reason.trim().length === 0} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2 h-4 w-4" />}
            Record skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Fix-last-bind dialog (reassign, grace-gated) ─────────────────────────

function FixLastBindDialog({
  open,
  onOpenChange,
  state,
  graceLeftMs,
  defaultTarget,
  onReassigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: StationState;
  graceLeftMs: number;
  defaultTarget: string;
  onReassigned: (targetTokenId: string) => void;
}) {
  const [target, setTarget] = useState(defaultTarget);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTarget(defaultTarget);
      setReason("");
      setError(null);
    }
  }, [open, defaultTarget]);

  const lastBind = state.lastBind;
  const targetValid = /^\d+$/.test(target) && target !== lastBind?.tokenId;

  const submit = async () => {
    if (!lastBind || !targetValid || reason.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const res = await proxyJson("/api/catalog-proxy/binding/reassign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tokenId: lastBind.tokenId,
        targetTokenId: target,
        reason: reason.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok || res.body?.ok !== true) {
      const code = typeof res.body?.code === "string" ? res.body.code : null;
      setError(
        code === "GRACE_EXPIRED" || res.status === 409
          ? "Grace window expired server-side — use Void + remint instead."
          : upstreamError(res.body, "reassign failed"),
      );
      return;
    }
    onOpenChange(false);
    onReassigned(target);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fix last bind</DialogTitle>
          <DialogDescription>
            Wrong physical item tapped? Swaps the content of token #{lastBind?.tokenId ?? "?"} with
            another token while the anchor grace timer is armed (
            {Math.ceil(graceLeftMs / 1000)}s left). The chip binding itself stays put.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fix-target">Swap content with token</Label>
            <Input
              id="fix-target"
              value={target}
              onChange={(e) => setTarget(e.target.value.trim())}
              className="font-mono"
              placeholder="target token id"
            />
            {!targetValid && target.length > 0 && (
              <p className="text-xs text-destructive">
                Must be a numeric token id different from #{lastBind?.tokenId}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fix-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="fix-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Required — goes to the exception log"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !targetValid || reason.trim().length === 0 || graceLeftMs <= 0}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
            Swap content
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
