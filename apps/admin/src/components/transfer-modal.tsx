"use client";

import { useState, useEffect } from "react";
import { getAddress } from "viem";
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
} from "@tagit/ui";
import { useClaim, getExplorerTxUrl } from "@tagit/contracts";
import { useChainId } from "wagmi";
import { Loader2, Check, AlertCircle, ExternalLink, ArrowRightLeft } from "lucide-react";

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenId: bigint;
  onSuccess?: () => void;
}

export function TransferModal({ open, onOpenChange, tokenId, onSuccess }: TransferModalProps) {
  const chainId = useChainId();
  const [recipient, setRecipient] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [validatedAddress, setValidatedAddress] = useState<`0x${string}` | null>(null);

  const { claim, hash, isPending, isConfirming, isSuccess, error } = useClaim();

  // Validate address on input change
  useEffect(() => {
    if (!recipient) {
      setValidatedAddress(null);
      setAddressError(null);
      return;
    }
    try {
      const checksummed = getAddress(recipient);
      setValidatedAddress(checksummed);
      setAddressError(null);
    } catch {
      setValidatedAddress(null);
      setAddressError("Invalid Ethereum address");
    }
  }, [recipient]);

  // Call onSuccess when transaction succeeds
  useEffect(() => {
    if (isSuccess) {
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  const handleTransfer = () => {
    if (!validatedAddress) return;
    claim(tokenId, validatedAddress);
  };

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setRecipient("");
      setValidatedAddress(null);
      setAddressError(null);
    }
  }, [open]);

  const isBusy = isPending || isConfirming;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Asset #{tokenId.toString()}
          </DialogTitle>
          <DialogDescription>
            Transfer ownership of this asset to a new address. This will call{" "}
            <code className="text-xs">claim(tokenId, newOwner)</code> on-chain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Recipient Address Input */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="font-mono"
              disabled={isBusy || isSuccess}
            />
            {addressError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {addressError}
              </p>
            )}
          </div>

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
                  <p className="font-medium text-green-500">Transfer Successful!</p>
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
            <Button
              onClick={handleTransfer}
              disabled={!validatedAddress || isBusy}
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                "Transfer"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
