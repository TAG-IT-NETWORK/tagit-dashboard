"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
} from "@tagit/ui";
import { useBindTag, getExplorerTxUrl } from "@tagit/contracts";
import { useChainId } from "wagmi";
import {
  Loader2,
  Nfc,
  Keyboard,
  Check,
  AlertCircle,
  ExternalLink,
  Smartphone,
  Usb,
  Wifi,
  WifiOff,
} from "lucide-react";
import { getNFCSupportStatus, readNFCTag, type NFCTagInfo } from "@/lib/nfc";
import { uidToTagId, isValidUID, formatUID, generateTestUID } from "@/lib/tag-utils";
import { useNfcBridge } from "@/lib/nfc-bridge";
import { CHIP_OPTIONS, CHIP_SPECS, type ChipType } from "@/lib/nfc-bridge-protocol";

interface BindTagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: bigint;
  onSuccess?: (tagId: `0x${string}`) => void;
}

type InputMode = "reader" | "manual" | "nfc";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

export function BindTagModal({ open, onOpenChange, tokenId, onSuccess }: BindTagModalProps) {
  const chainId = useChainId();
  const [mode, setMode] = useState<InputMode>("manual");
  const [uidInput, setUidInput] = useState("");
  const [uidError, setUidError] = useState<string | null>(null);
  const [computedTagId, setComputedTagId] = useState<`0x${string}` | null>(null);
  const [selectedChip, setSelectedChip] = useState<ChipType>("NTAG424DNA");

  // Web NFC (phone) scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [scannedTag, setScannedTag] = useState<NFCTagInfo | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Desktop reader (bridge) — only connect while the modal is open.
  const bridge = useNfcBridge(open);
  const [tokenDraft, setTokenDraft] = useState("");
  const userPickedMode = useRef(false);

  const { bindTag, hash, isPending, isConfirming, isSuccess, error } = useBindTag();
  const nfcStatus = getNFCSupportStatus();

  // Compute tagId when UID changes
  useEffect(() => {
    if (uidInput && isValidUID(uidInput)) {
      const formatted = formatUID(uidInput);
      if (formatted !== uidInput) setUidInput(formatted);
      setComputedTagId(uidToTagId(formatted));
      setUidError(null);
    } else if (uidInput) {
      setComputedTagId(null);
      setUidError("Invalid UID format. Expected 7 bytes like: 04:A1:B2:C3:D4:E5:F6");
    } else {
      setComputedTagId(null);
      setUidError(null);
    }
  }, [uidInput]);

  // Auto-select the Desktop Reader source the moment the bridge + reader are
  // ready (unless the operator has manually chosen another source).
  useEffect(() => {
    if (open && bridge.ready && !userPickedMode.current) {
      setMode("reader");
    }
  }, [open, bridge.ready]);

  // Tap-to-fill: when a tag lands on the reader, drop its UID in and auto-select
  // the detected chip type. Operator can still override the chip.
  useEffect(() => {
    if (mode === "reader" && bridge.card) {
      setUidInput(bridge.card.uid);
      if (bridge.card.chip !== "UNKNOWN") setSelectedChip(bridge.card.chip);
    }
  }, [mode, bridge.card]);

  // Handle successful binding
  useEffect(() => {
    if (isSuccess && computedTagId) {
      onSuccess?.(computedTagId);
    }
  }, [isSuccess, computedTagId, onSuccess]);

  const pickMode = (next: InputMode) => {
    userPickedMode.current = true;
    setMode(next);
  };

  // Web NFC (phone) scan handler
  const startNFCScan = useCallback(async () => {
    setIsScanning(true);
    setNfcError(null);
    setScannedTag(null);
    const controller = new AbortController();
    setAbortController(controller);
    try {
      const tagInfo = await readNFCTag(controller.signal);
      setScannedTag(tagInfo);
      setUidInput(tagInfo.uid);
      setIsScanning(false);
    } catch (err) {
      setIsScanning(false);
      if (err instanceof DOMException && err.name === "AbortError") return;
      setNfcError(err instanceof Error ? err.message : "Failed to read NFC tag");
    }
  }, []);

  const cancelNFCScan = useCallback(() => {
    abortController?.abort();
    setIsScanning(false);
    setAbortController(null);
  }, [abortController]);

  const handleBind = async () => {
    if (!computedTagId) return;
    await bindTag(tokenId, computedTagId);
  };

  const resetModal = () => {
    setUidInput("");
    setComputedTagId(null);
    setUidError(null);
    setNfcError(null);
    setScannedTag(null);
    setIsScanning(false);
    userPickedMode.current = false;
  };

  useEffect(() => {
    if (open) {
      resetModal();
      setTokenDraft(bridge.config.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chipSpec = CHIP_SPECS[selectedChip];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Bind NFC Tag to Asset #{tokenId.toString()}</DialogTitle>
          <DialogDescription>
            Associate a physical NFC tag with this asset token. The tag UID is hashed into a unique
            tagId stored on-chain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Source Selector — only show input methods this device supports. No
              "N/A" badge: the Phone (Web NFC) button is omitted on devices that
              don't expose NDEFReader (desktop, iOS Safari). On a Mac with the
              USB reader plugged in, only Desktop Reader + Manual appear —
              reader-first by intent. */}
          <div
            className={nfcStatus.supported ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}
          >
            <Button
              type="button"
              variant={mode === "reader" ? "default" : "outline"}
              onClick={() => pickMode("reader")}
              className="relative"
            >
              <Usb className="h-4 w-4 mr-2" />
              Desktop Reader
              {bridge.ready && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />
              )}
            </Button>
            {nfcStatus.supported && (
              <Button
                type="button"
                variant={mode === "nfc" ? "default" : "outline"}
                onClick={() => pickMode("nfc")}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Phone
              </Button>
            )}
            <Button
              type="button"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => pickMode("manual")}
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Manual
            </Button>
          </div>

          {/* Desktop Reader Mode */}
          {mode === "reader" && (
            <div className="space-y-4">
              <ReaderStatusPanel
                bridge={bridge}
                tokenDraft={tokenDraft}
                setTokenDraft={setTokenDraft}
              />
            </div>
          )}

          {/* Manual Entry Mode */}
          {mode === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="uid">Tag UID (7 bytes)</Label>
              <div className="flex gap-2">
                <Input
                  id="uid"
                  placeholder="04:A1:B2:C3:D4:E5:F6"
                  value={uidInput}
                  onChange={(e) => setUidInput(e.target.value)}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUidInput(generateTestUID())}
                >
                  Random
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the NFC tag&apos;s unique identifier. All NTAG chips have 7-byte UIDs.
              </p>
            </div>
          )}

          {/* Phone (Web NFC) Mode */}
          {mode === "nfc" && (
            <div className="space-y-4">
              {!nfcStatus.supported ? (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Smartphone className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-500">Web NFC not available here</p>
                      <p className="text-sm text-muted-foreground mt-1">{nfcStatus.reason}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Web NFC needs Chrome on Android. On desktop, use the Desktop Reader.
                      </p>
                    </div>
                  </div>
                </div>
              ) : isScanning ? (
                <div className="rounded-lg border border-primary/50 bg-primary/10 p-6 text-center">
                  <Nfc className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
                  <p className="font-medium">Ready to Scan</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hold an NFC tag near your phone
                  </p>
                  <Button variant="outline" className="mt-4" onClick={cancelNFCScan}>
                    Cancel
                  </Button>
                </div>
              ) : scannedTag ? (
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-500">Tag Scanned</span>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">UID:</span>{" "}
                    <code className="font-mono">{scannedTag.uid}</code>
                  </p>
                  <Button variant="outline" className="mt-3" onClick={startNFCScan}>
                    Scan Again
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Button onClick={startNFCScan} className="w-full">
                    <Nfc className="h-4 w-4 mr-2" />
                    Start NFC Scan
                  </Button>
                  {nfcError && (
                    <p className="text-sm text-destructive mt-2 flex items-center justify-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {nfcError}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chip-type selector (shared across sources) */}
          <div className="space-y-2">
            <Label htmlFor="chip">Chip Type</Label>
            <select
              id="chip"
              className={SELECT_CLASS}
              value={selectedChip}
              onChange={(e) => setSelectedChip(e.target.value as ChipType)}
            >
              {CHIP_OPTIONS.map((c) => (
                <option key={c.type} value={c.type}>
                  {c.label}
                  {c.capacityBytes ? ` — ${c.capacityBytes} B` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {mode === "reader" && bridge.card?.chip && bridge.card.chip !== "UNKNOWN"
                ? `Auto-detected from the tapped tag (${CHIP_SPECS[bridge.card.chip].label}).`
                : chipSpec.secure
                  ? "NTAG424 DNA supports SDM cryptographic authentication (Phase 2)."
                  : `Capacity ${chipSpec.capacityBytes ?? "?"} B. UID binding is identical across NTAG chips.`}
            </p>
          </div>

          {/* Computed TagId Preview */}
          {computedTagId && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Computed Tag ID (keccak256)</p>
              <code className="text-xs font-mono break-all block">{computedTagId}</code>
              <p className="text-xs text-muted-foreground">
                Stored on-chain and linked to token #{tokenId.toString()}
              </p>
            </div>
          )}

          {/* Transaction Status */}
          {(isPending || isConfirming) && (
            <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">
                    {isPending ? "Confirm in wallet..." : "Waiting for confirmation..."}
                  </p>
                  {hash && (
                    <a
                      href={getExplorerTxUrl(chainId, hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      View on Blockscout
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-500">Tag Bound Successfully!</p>
                  {hash && (
                    <a
                      href={getExplorerTxUrl(chainId, hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-500 hover:underline flex items-center gap-1 mt-1"
                    >
                      View transaction
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Transaction Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {error.message || "Unknown error occurred"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isSuccess ? "Close" : "Cancel"}
          </Button>
          {!isSuccess && (
            <Button onClick={handleBind} disabled={!computedTagId || isPending || isConfirming}>
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Binding...
                </>
              ) : (
                "Bind Tag"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function ReaderStatusPanel({
  bridge,
  tokenDraft,
  setTokenDraft,
}: {
  bridge: ReturnType<typeof useNfcBridge>;
  tokenDraft: string;
  setTokenDraft: (v: string) => void;
}) {
  // Not connected to the bridge process at all.
  if (!bridge.wsConnected) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <WifiOff className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-500">Bridge not connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              {bridge.config.token
                ? (bridge.error ?? "Trying to reach tagit-nfc-bridge…")
                : "Paste the token printed by the bridge on startup."}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bridge-token" className="text-xs">
            Bridge token
          </Label>
          <div className="flex gap-2">
            <Input
              id="bridge-token"
              placeholder="paste token from bridge console"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => bridge.updateConfig({ token: tokenDraft.trim() })}
            >
              Connect
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The bridge auto-runs via launchd (
            <code className="font-mono">com.tagit.nfc-bridge</code>) on{" "}
            <code className="font-mono">{bridge.config.url}</code>. Token lives at{" "}
            <code className="font-mono">~/.tagit/nfc-bridge.json</code> — print it with{" "}
            <code className="font-mono">cat ~/.tagit/nfc-bridge.json</code>.
          </p>
        </div>
      </div>
    );
  }

  // Connected to bridge, but no physical reader plugged in.
  if (!bridge.readerConnected) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
        <div className="flex items-start gap-3">
          <Usb className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-500">No reader detected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Bridge is running — plug in the ACR1252U NFC reader.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Reader ready, waiting for a tap.
  if (!bridge.card) {
    return (
      <div className="rounded-lg border border-primary/50 bg-primary/10 p-6 text-center">
        <Nfc className="h-12 w-12 mx-auto mb-3 text-primary animate-pulse" />
        <p className="font-medium">Tap a tag on the reader</p>
        <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
          <Wifi className="h-3 w-3 text-green-500" />
          {bridge.readerName}
        </p>
      </div>
    );
  }

  // Tag present.
  return (
    <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Check className="h-5 w-5 text-green-500" />
        <span className="font-medium text-green-500">Tag detected</span>
        <Badge variant="secondary" className="ml-auto">
          {CHIP_SPECS[bridge.card.chip].label}
        </Badge>
      </div>
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">UID:</span>{" "}
          <code className="font-mono">{bridge.card.uid}</code>
        </p>
        {bridge.card.capacityBytes != null && (
          <p className="text-xs text-muted-foreground">Capacity {bridge.card.capacityBytes} B</p>
        )}
      </div>
    </div>
  );
}
