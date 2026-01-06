"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useBindTag } from "@tagit/contracts";
import { Loader2, Nfc, Keyboard, Check, AlertCircle, ExternalLink, Smartphone } from "lucide-react";
import { isNFCSupported, getNFCSupportStatus, readNFCTag, type NFCTagInfo } from "@/lib/nfc";
import { uidToTagId, isValidUID, formatUID, generateTestUID, truncateTagId } from "@/lib/tag-utils";
import { getBlockscoutTxUrl } from "@/lib/test-utils";

interface BindTagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: bigint;
  onSuccess?: (tagId: `0x${string}`) => void;
}

type InputMode = "manual" | "nfc";

export function BindTagModal({ open, onOpenChange, tokenId, onSuccess }: BindTagModalProps) {
  const [mode, setMode] = useState<InputMode>("manual");
  const [uidInput, setUidInput] = useState("");
  const [uidError, setUidError] = useState<string | null>(null);
  const [computedTagId, setComputedTagId] = useState<`0x${string}` | null>(null);

  // NFC scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [scannedTag, setScannedTag] = useState<NFCTagInfo | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const { bindTag, hash, isPending, isConfirming, isSuccess, error } = useBindTag();

  const nfcStatus = getNFCSupportStatus();

  // Compute tagId when UID changes
  useEffect(() => {
    if (uidInput && isValidUID(uidInput)) {
      const formatted = formatUID(uidInput);
      setUidInput(formatted);
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

  // Handle successful binding
  useEffect(() => {
    if (isSuccess && computedTagId) {
      onSuccess?.(computedTagId);
    }
  }, [isSuccess, computedTagId, onSuccess]);

  // NFC scan handler
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
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled
        return;
      }
      setNfcError(err instanceof Error ? err.message : "Failed to read NFC tag");
    }
  }, []);

  const cancelNFCScan = useCallback(() => {
    abortController?.abort();
    setIsScanning(false);
    setAbortController(null);
  }, [abortController]);

  const handleBind = () => {
    if (!computedTagId) return;
    bindTag(tokenId, computedTagId);
  };

  const handleGenerateTestUID = () => {
    setUidInput(generateTestUID());
  };

  const resetModal = () => {
    setUidInput("");
    setComputedTagId(null);
    setUidError(null);
    setNfcError(null);
    setScannedTag(null);
    setIsScanning(false);
  };

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      resetModal();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bind NFC Tag to Asset #{tokenId.toString()}</DialogTitle>
          <DialogDescription>
            Associate a physical NFC tag with this asset token. The tag UID will be hashed to create
            a unique tagId on-chain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Mode Selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "manual" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("manual")}
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
            <Button
              type="button"
              variant={mode === "nfc" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("nfc")}
              disabled={!nfcStatus.supported}
            >
              <Nfc className="h-4 w-4 mr-2" />
              NFC Scan
              {!nfcStatus.supported && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  N/A
                </Badge>
              )}
            </Button>
          </div>

          {/* Manual Entry Mode */}
          {mode === "manual" && (
            <div className="space-y-4">
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
                    onClick={handleGenerateTestUID}
                    title="Generate random test UID"
                  >
                    Random
                  </Button>
                </div>
                {uidError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {uidError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter the NFC tag&apos;s unique identifier. NTAG424 DNA tags have 7-byte UIDs.
                </p>
              </div>
            </div>
          )}

          {/* NFC Scan Mode */}
          {mode === "nfc" && (
            <div className="space-y-4">
              {!nfcStatus.supported ? (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Smartphone className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-500">NFC Not Available</p>
                      <p className="text-sm text-muted-foreground mt-1">{nfcStatus.reason}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Web NFC requires Chrome on Android with HTTPS. Use manual entry mode on
                        desktop.
                      </p>
                    </div>
                  </div>
                </div>
              ) : isScanning ? (
                <div className="rounded-lg border border-primary/50 bg-primary/10 p-6 text-center">
                  <Nfc className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
                  <p className="font-medium">Ready to Scan</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hold an NFC tag near your device
                  </p>
                  <Button variant="outline" className="mt-4" onClick={cancelNFCScan}>
                    Cancel
                  </Button>
                </div>
              ) : scannedTag ? (
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-500">Tag Scanned Successfully</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">UID:</span>{" "}
                      <code className="font-mono">{scannedTag.uid}</code>
                    </p>
                    {scannedTag.records.length > 0 && (
                      <p className="text-muted-foreground">
                        {scannedTag.records.length} NDEF record(s) found
                      </p>
                    )}
                  </div>
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

          {/* Computed TagId Preview */}
          {computedTagId && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Computed Tag ID (keccak256 hash)</p>
              <code className="text-xs font-mono break-all block">{computedTagId}</code>
              <p className="text-xs text-muted-foreground">
                This hash will be stored on-chain and linked to token #{tokenId.toString()}
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
                      href={getBlockscoutTxUrl(hash)}
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
                      href={getBlockscoutTxUrl(hash)}
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
            <Button
              onClick={handleBind}
              disabled={!computedTagId || isPending || isConfirming}
            >
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
