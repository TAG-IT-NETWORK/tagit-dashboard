"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { keccak256, toBytes, isAddress } from "viem";
import { useChainId } from "wagmi";
import {
  useAccount,
  useBatchMint,
  useBatchBind,
  useBatchActivate,
  getExplorerTxUrl,
  parseContractError,
} from "@tagit/contracts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
} from "@tagit/ui";
import {
  Loader2,
  Nfc,
  Usb,
  Wifi,
  WifiOff,
  Check,
  X,
  AlertCircle,
  Trash2,
  RotateCw,
  Download,
  Factory,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { useNfcBridge } from "@/lib/nfc-bridge";
import { CHIP_SPECS, type ChipType } from "@/lib/nfc-bridge-protocol";
import { WagmiGuard } from "@/components/wagmi-guard";
import {
  queueReducer,
  initialQueueState,
  MAX_QUEUE_SIZE,
  type QueueItem,
  type SdmStatus,
} from "@/lib/assembly-line/queue";
import { downloadResultsCsv, type RunResultRow } from "@/lib/assembly-line/csv";

const DEFAULT_SDM_BASE_URL = "https://verify.tagit.network/sun";
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;

type RunStep = "idle" | "mint" | "bind" | "activate" | "done";

/**
 * Assembly Line — bulk chip-programming console.
 *
 * Operator taps up to 100 NFC chips on the desktop reader; each tap
 * auto-programs the chip's SDM (via the local bridge) and queues it. On
 * submit: batchMint → batchBind → (optional) batchActivate, all signed from
 * the operator's connected wallet (the operator IS trustedOracle+BINDER in
 * the admin context — see useBatchBind in @tagit/contracts).
 */
export function AssemblyLineConsole() {
  return (
    <WagmiGuard>
      <AssemblyLineContent />
    </WagmiGuard>
  );
}

function AssemblyLineContent() {
  const chainId = useChainId();
  const { address } = useAccount();

  // ── Bridge ────────────────────────────────────────────────────────────
  const bridge = useNfcBridge(true);
  const lastUidRef = useRef<string | null>(null);

  // ── Run config ───────────────────────────────────────────────────────
  const [recipient, setRecipient] = useState("");
  const [recipientTouched, setRecipientTouched] = useState(false);
  const [metadataNote, setMetadataNote] = useState("");
  const [sdmBaseUrl, setSdmBaseUrl] = useState(DEFAULT_SDM_BASE_URL);
  const [programOnTap, setProgramOnTap] = useState(true);
  const [activateAfterBind, setActivateAfterBind] = useState(true);

  useEffect(() => {
    if (!recipientTouched && address) setRecipient(address);
  }, [address, recipientTouched]);

  const recipientValid = isAddress(recipient);

  // ── Queue ────────────────────────────────────────────────────────────
  const [queueState, dispatch] = useReducer(queueReducer, initialQueueState);

  // ── Submit flow ──────────────────────────────────────────────────────
  const [step, setStep] = useState<RunStep>("idle");
  const [runUids, setRunUids] = useState<string[] | null>(null);
  const [runTagHashes, setRunTagHashes] = useState<`0x${string}`[] | null>(null);
  const [runTokenIds, setRunTokenIds] = useState<bigint[] | null>(null);
  const isRunning = step !== "idle" && step !== "done";

  const mintHook = useBatchMint();
  const bindHook = useBatchBind();
  const activateHook = useBatchActivate();

  const runPersonalize = useCallback(
    async (uid: string) => {
      dispatch({ type: "SET_SDM_STATUS", uid, status: "pending" });
      try {
        await bridge.request({ type: "personalize-sdm", baseUrl: sdmBaseUrl });
        dispatch({ type: "SET_SDM_STATUS", uid, status: "success" });
      } catch (err) {
        dispatch({
          type: "SET_SDM_STATUS",
          uid,
          status: "error",
          error: err instanceof Error ? err.message : "personalization failed",
        });
      }
    },
    [bridge, sdmBaseUrl],
  );

  // Tap-driven queueing — fires once per physical tap (guarded by lastUidRef so
  // the same card sitting on the antenna doesn't re-trigger on unrelated re-renders).
  useEffect(() => {
    if (!bridge.card) {
      lastUidRef.current = null;
      return;
    }
    if (lastUidRef.current === bridge.card.uid) return;
    lastUidRef.current = bridge.card.uid;

    if (isRunning) return; // pause new adds while a run is submitting

    const { uid, chip } = bridge.card;
    const isDuplicate = queueState.items.some((item) => item.uid === uid);
    if (isDuplicate || queueState.items.length >= MAX_QUEUE_SIZE) {
      dispatch({ type: "ADD", uid, chip, sdmStatus: "skipped" });
      return;
    }

    const shouldProgram = programOnTap && chip === "NTAG424DNA";
    dispatch({ type: "ADD", uid, chip, sdmStatus: shouldProgram ? "pending" : "skipped" });
    if (shouldProgram) void runPersonalize(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.card]);

  const removeItem = (uid: string) => dispatch({ type: "REMOVE", uid });
  const retrySdm = (uid: string) => void runPersonalize(uid);

  // ── Submit orchestration: mint → bind → (activate) ──────────────────
  const handleSubmit = () => {
    if (queueState.items.length === 0 || !recipientValid || isRunning) return;
    const n = queueState.items.length;
    const uids = queueState.items.map((item) => item.uid);
    const tagHashes = queueState.items.map((item) => item.tagId);
    const metadataHash = metadataNote.trim()
      ? keccak256(toBytes(metadataNote.trim()))
      : ZERO_BYTES32;

    setRunUids(uids);
    setRunTagHashes(tagHashes);
    setRunTokenIds(null);
    setStep("mint");

    const recipients = Array<`0x${string}`>(n).fill(recipient as `0x${string}`);
    const metadata = Array<`0x${string}`>(n).fill(metadataHash);
    mintHook.batchMint(recipients, metadata);
  };

  // mint success → capture tokenIds, kick off bind
  useEffect(() => {
    if (step !== "mint") return;
    if (!mintHook.isSuccess || mintHook.tokenIds.length === 0) return;
    if (!runTagHashes) return;
    setRunTokenIds(mintHook.tokenIds);
    setStep("bind");
    void bindHook.batchBind(mintHook.tokenIds, runTagHashes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mintHook.isSuccess, mintHook.tokenIds, runTagHashes]);

  // bind success → activate (if enabled) or done
  useEffect(() => {
    if (step !== "bind") return;
    if (!bindHook.isSuccess) return;
    if (activateAfterBind && runTokenIds) {
      setStep("activate");
      void activateHook.batchActivate(runTokenIds);
    } else {
      setStep("done");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, bindHook.isSuccess]);

  // activate success → done
  useEffect(() => {
    if (step !== "activate") return;
    if (!activateHook.isSuccess) return;
    setStep("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activateHook.isSuccess]);

  const retryMint = () => {
    if (!runUids || !recipientValid) return;
    const metadataHash = metadataNote.trim()
      ? keccak256(toBytes(metadataNote.trim()))
      : ZERO_BYTES32;
    const recipients = Array<`0x${string}`>(runUids.length).fill(recipient as `0x${string}`);
    const metadata = Array<`0x${string}`>(runUids.length).fill(metadataHash);
    mintHook.batchMint(recipients, metadata);
  };
  const retryBind = () => {
    if (runTokenIds && runTagHashes) void bindHook.batchBind(runTokenIds, runTagHashes);
  };
  const retryActivate = () => {
    if (runTokenIds) void activateHook.batchActivate(runTokenIds);
  };

  const handleClear = () => {
    dispatch({ type: "CLEAR" });
    setStep("idle");
    setRunUids(null);
    setRunTagHashes(null);
    setRunTokenIds(null);
  };

  const results: RunResultRow[] = useMemo(() => {
    if (step !== "done" || !runUids || !runTokenIds || !runTagHashes) return [];
    return runUids.map((uid, i) => ({ uid, tokenId: runTokenIds[i], tagId: runTagHashes[i] }));
  }, [step, runUids, runTokenIds, runTagHashes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="h-6 w-6" />
            Assembly Line
          </h1>
          <p className="text-muted-foreground">
            Tap up to {MAX_QUEUE_SIZE} chips, then mint, bind, and activate the whole run in one go.
          </p>
        </div>
      </div>

      <BridgePanel bridge={bridge} />

      <RunConfigPanel
        recipient={recipient}
        onRecipientChange={(v) => {
          setRecipientTouched(true);
          setRecipient(v);
        }}
        recipientValid={recipientValid}
        metadataNote={metadataNote}
        onMetadataNoteChange={setMetadataNote}
        sdmBaseUrl={sdmBaseUrl}
        onSdmBaseUrlChange={setSdmBaseUrl}
        programOnTap={programOnTap}
        onProgramOnTapChange={setProgramOnTap}
        activateAfterBind={activateAfterBind}
        onActivateAfterBindChange={setActivateAfterBind}
        disabled={isRunning}
      />

      <QueueCard
        items={queueState.items}
        lastEvent={queueState.lastEvent}
        onRemove={removeItem}
        onRetrySdm={retrySdm}
        onSubmit={handleSubmit}
        canSubmit={queueState.items.length > 0 && recipientValid && !isRunning}
        isRunning={isRunning}
      />

      {step !== "idle" && (
        <SubmitStepper
          step={step}
          chainId={chainId}
          n={runUids?.length ?? 0}
          activateAfterBind={activateAfterBind}
          mintHook={mintHook}
          bindHook={bindHook}
          activateHook={activateHook}
          onRetryMint={retryMint}
          onRetryBind={retryBind}
          onRetryActivate={retryActivate}
        />
      )}

      {step === "done" && <ResultsPanel results={results} onClear={handleClear} />}
    </div>
  );
}

// ── Bridge status panel ──────────────────────────────────────────────────

function BridgePanel({ bridge }: { bridge: ReturnType<typeof useNfcBridge> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reader</CardTitle>
        <CardDescription>Desktop NFC bridge (ACR1252U)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 flex-wrap">
          <StatusPill
            ok={bridge.wsConnected}
            okLabel="Bridge connected"
            badLabel="Bridge not connected"
            okIcon={Wifi}
            badIcon={WifiOff}
          />
          <StatusPill
            ok={bridge.readerConnected}
            okLabel={bridge.readerName ?? "Reader connected"}
            badLabel="No reader detected"
            okIcon={Usb}
            badIcon={Usb}
          />
          {bridge.card ? (
            <div className="flex items-center gap-2 text-sm">
              <Nfc className="h-4 w-4 text-primary animate-pulse" />
              <span className="font-mono">{bridge.card.uid}</span>
              <Badge variant="secondary">{CHIP_SPECS[bridge.card.chip].label}</Badge>
            </div>
          ) : (
            bridge.ready && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Nfc className="h-4 w-4 animate-pulse" />
                Waiting for a tap…
              </div>
            )
          )}
        </div>
        {bridge.error && !bridge.wsConnected && (
          <p className="text-sm text-muted-foreground mt-3">{bridge.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusPill({
  ok,
  okLabel,
  badLabel,
  okIcon: OkIcon,
  badIcon: BadIcon,
}: {
  ok: boolean;
  okLabel: string;
  badLabel: string;
  okIcon: typeof Wifi;
  badIcon: typeof Wifi;
}) {
  const Icon = ok ? OkIcon : BadIcon;
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? "text-green-500" : "text-yellow-500"}`}>
      <Icon className="h-4 w-4" />
      {ok ? okLabel : badLabel}
    </div>
  );
}

// ── Run config panel ──────────────────────────────────────────────────────

interface RunConfigPanelProps {
  recipient: string;
  onRecipientChange: (v: string) => void;
  recipientValid: boolean;
  metadataNote: string;
  onMetadataNoteChange: (v: string) => void;
  sdmBaseUrl: string;
  onSdmBaseUrlChange: (v: string) => void;
  programOnTap: boolean;
  onProgramOnTapChange: (v: boolean) => void;
  activateAfterBind: boolean;
  onActivateAfterBindChange: (v: boolean) => void;
  disabled: boolean;
}

function RunConfigPanel({
  recipient,
  onRecipientChange,
  recipientValid,
  metadataNote,
  onMetadataNoteChange,
  sdmBaseUrl,
  onSdmBaseUrlChange,
  programOnTap,
  onProgramOnTapChange,
  activateAfterBind,
  onActivateAfterBindChange,
  disabled,
}: RunConfigPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run configuration</CardTitle>
        <CardDescription>Applies to every chip queued for this run.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="al-recipient">Recipient address</Label>
            <Input
              id="al-recipient"
              value={recipient}
              onChange={(e) => onRecipientChange(e.target.value)}
              placeholder="0x…"
              className="font-mono"
              disabled={disabled}
            />
            {recipient && !recipientValid && (
              <p className="text-xs text-destructive">Not a valid address.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="al-metadata">Metadata note (optional)</Label>
            <Input
              id="al-metadata"
              value={metadataNote}
              onChange={(e) => onMetadataNoteChange(e.target.value)}
              placeholder="e.g. batch #42 — leather wallets"
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Hashed (keccak256) into the shared metadata field. Leave blank for bytes32(0).
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="al-sdm-url">SDM base URL</Label>
            <Input
              id="al-sdm-url"
              value={sdmBaseUrl}
              onChange={(e) => onSdmBaseUrlChange(e.target.value)}
              className="font-mono text-sm"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 pt-2">
          <ToggleRow
            id="al-program-on-tap"
            label="Program SDM on tap"
            hint="NTAG 424 DNA only — other chip types queue UID-only."
            checked={programOnTap}
            onChange={onProgramOnTapChange}
            disabled={disabled}
          />
          <ToggleRow
            id="al-activate"
            label="Activate after bind"
            hint="Runs batchActivate as the final step."
            checked={activateAfterBind}
            onChange={onActivateAfterBindChange}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
      <input
        id={id}
        type="checkbox"
        aria-label={label}
        className="mt-1 h-4 w-4 rounded border-input accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-sm font-medium block">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

// ── Queue table ────────────────────────────────────────────────────────────

function sdmBadge(item: QueueItem) {
  if (item.chip !== "NTAG424DNA") {
    return (
      <Badge variant="warning" title="This chip type doesn't support SDM — queued UID-only.">
        UID-only
      </Badge>
    );
  }
  const map: Record<
    SdmStatus,
    { variant: "secondary" | "success" | "destructive" | "outline"; label: string }
  > = {
    pending: { variant: "secondary", label: "Programming…" },
    success: { variant: "success", label: "SDM programmed" },
    error: { variant: "destructive", label: "SDM failed" },
    skipped: { variant: "outline", label: "UID-only" },
  };
  const cfg = map[item.sdmStatus];
  return (
    <Badge variant={cfg.variant} className="gap-1">
      {item.sdmStatus === "pending" && <Loader2 className="h-3 w-3 animate-spin" />}
      {item.sdmStatus === "success" && <Check className="h-3 w-3" />}
      {item.sdmStatus === "error" && <AlertCircle className="h-3 w-3" />}
      {cfg.label}
    </Badge>
  );
}

interface QueueCardProps {
  items: QueueItem[];
  lastEvent:
    | { type: "duplicate"; uid: string; position: number }
    | { type: "full"; uid: string }
    | null;
  onRemove: (uid: string) => void;
  onRetrySdm: (uid: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  isRunning: boolean;
}

function QueueCard({
  items,
  lastEvent,
  onRemove,
  onRetrySdm,
  onSubmit,
  canSubmit,
  isRunning,
}: QueueCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Queue</CardTitle>
            <CardDescription>
              {items.length}/{MAX_QUEUE_SIZE} chips
            </CardDescription>
          </div>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…
              </>
            ) : (
              <>
                Mint &amp; bind {items.length} chip{items.length === 1 ? "" : "s"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lastEvent && (
          <div className="mb-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-sm text-yellow-500 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {lastEvent.type === "duplicate"
              ? `Duplicate — already #${lastEvent.position} in queue.`
              : `Queue full (${MAX_QUEUE_SIZE} max) — remove an item before adding another.`}
          </div>
        )}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">UID</th>
                <th className="px-4 py-2 font-medium">Chip</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Tag ID</th>
                <th className="px-4 py-2 font-medium">SDM</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Tap a chip on the reader to begin.
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={item.uid} className="border-b last:border-0">
                    <td className="px-4 py-2 text-sm text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-sm">{item.uid}</td>
                    <td className="px-4 py-2 text-sm">{CHIP_SPECS[item.chip].label}</td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <code className="text-xs text-muted-foreground">
                        {item.tagId.slice(0, 10)}…{item.tagId.slice(-8)}
                      </code>
                    </td>
                    <td className="px-4 py-2">{sdmBadge(item)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {item.chip === "NTAG424DNA" && item.sdmStatus === "error" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Retry SDM programming (tap the chip again first)"
                            onClick={() => onRetrySdm(item.uid)}
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Remove from queue"
                          onClick={() => onRemove(item.uid)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Submit stepper ───────────────────────────────────────────────────────

interface StepHookState {
  hash?: `0x${string}`;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
}

function StepRow({
  label,
  n,
  active,
  hook,
  chainId,
  onRetry,
}: {
  label: string;
  n: number;
  active: boolean;
  hook: StepHookState;
  chainId: number;
  onRetry: () => void;
}) {
  const parsed = hook.error ? parseContractError(hook.error) : null;
  return (
    <div className={`flex items-start gap-3 py-3 ${active ? "" : "opacity-60"}`}>
      <div className="mt-0.5">
        {hook.isSuccess ? (
          <Check className="h-5 w-5 text-green-500" />
        ) : hook.error ? (
          <X className="h-5 w-5 text-destructive" />
        ) : hook.isPending || hook.isConfirming ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          {label} <span className="text-muted-foreground font-normal">({n} chips)</span>
        </p>
        {hook.hash && (
          <a
            href={getExplorerTxUrl(chainId, hook.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
          >
            {hook.hash.slice(0, 10)}…{hook.hash.slice(-6)}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {hook.error && (
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs text-destructive">{parsed?.message ?? hook.error.message}</p>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onRetry}>
              <RotateCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitStepper({
  step,
  chainId,
  n,
  activateAfterBind,
  mintHook,
  bindHook,
  activateHook,
  onRetryMint,
  onRetryBind,
  onRetryActivate,
}: {
  step: RunStep;
  chainId: number;
  n: number;
  activateAfterBind: boolean;
  mintHook: StepHookState;
  bindHook: StepHookState;
  activateHook: StepHookState;
  onRetryMint: () => void;
  onRetryBind: () => void;
  onRetryActivate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run status</CardTitle>
        <CardDescription>
          If a step fails, the queue and any already-completed steps stay intact — fix the issue and
          retry just that step.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <StepRow
          label="Mint"
          n={n}
          active={step === "mint"}
          hook={mintHook}
          chainId={chainId}
          onRetry={onRetryMint}
        />
        <StepRow
          label="Bind"
          n={n}
          active={step === "bind"}
          hook={bindHook}
          chainId={chainId}
          onRetry={onRetryBind}
        />
        {activateAfterBind && (
          <StepRow
            label="Activate"
            n={n}
            active={step === "activate"}
            hook={activateHook}
            chainId={chainId}
            onRetry={onRetryActivate}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Results panel ─────────────────────────────────────────────────────────

function ResultsPanel({ results, onClear }: { results: RunResultRow[]; onClear: () => void }) {
  return (
    <Card className="border-green-500/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Run complete — {results.length} chip{results.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>Minted, bound, and ready for the floor.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => downloadResultsCsv(results)}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button onClick={onClear}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear queue / start next run
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                <th className="px-4 py-2 font-medium">UID</th>
                <th className="px-4 py-2 font-medium">Token ID</th>
                <th className="px-4 py-2 font-medium">Tag ID</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.uid} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-sm">{row.uid}</td>
                  <td className="px-4 py-2 text-sm">#{row.tokenId.toString()}</td>
                  <td className="px-4 py-2">
                    <code className="text-xs text-muted-foreground">
                      {row.tagId.slice(0, 10)}…{row.tagId.slice(-8)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
