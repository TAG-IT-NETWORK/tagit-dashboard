"use client";

import { useEffect } from "react";
import { parseContractError, getBlockscoutTxUrl } from "@tagit/contracts";
import { Card, CardContent, Button } from "@tagit/ui";
import { Loader2, CheckCircle2, XCircle, ExternalLink, AlertTriangle } from "lucide-react";

interface TransactionStatusProps {
  /** Whether a transaction is pending (writing to chain) */
  isPending?: boolean;
  /** Whether waiting for confirmation */
  isConfirming?: boolean;
  /** Whether transaction succeeded */
  isSuccess?: boolean;
  /** Error object if transaction failed */
  error?: Error | null;
  /** Transaction hash if available */
  hash?: string;
  /** Action being performed (for error messages) */
  action?: string;
  /** Called when transaction succeeds */
  onSuccess?: () => void;
  /** Called when transaction fails */
  onError?: (error: Error) => void;
  /** Custom success message */
  successMessage?: string;
  /** Whether to show inline (compact) or full alert */
  inline?: boolean;
  /** Auto-dismiss success after ms (0 = no auto-dismiss) */
  autoDismiss?: number;
}

/**
 * TransactionStatus shows the current state of a blockchain transaction
 * with proper error parsing and user-friendly messages.
 */
export function TransactionStatus({
  isPending,
  isConfirming,
  isSuccess,
  error,
  hash,
  action,
  onSuccess,
  onError,
  successMessage = "Transaction completed successfully!",
  inline = false,
  autoDismiss = 0,
}: TransactionStatusProps) {
  // Call success/error callbacks
  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Parse error if present
  const parsedError = error ? parseContractError(error) : null;

  // Don't render anything if no state to show
  if (!isPending && !isConfirming && !isSuccess && !error) {
    return null;
  }

  // Inline compact version
  if (inline) {
    if (isPending) {
      return (
        <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Confirm in wallet...
        </span>
      );
    }

    if (isConfirming) {
      return (
        <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing...
        </span>
      );
    }

    if (isSuccess) {
      return (
        <span className="inline-flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Success
          {hash && (
            <a
              href={getBlockscoutTxUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </span>
      );
    }

    if (error && parsedError) {
      return (
        <span className="inline-flex items-center gap-2 text-destructive text-sm">
          <XCircle className="h-4 w-4" />
          {parsedError.isUserRejection ? "Cancelled" : "Failed"}
        </span>
      );
    }

    return null;
  }

  // Full card version
  if (isPending) {
    return (
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <p className="font-medium">Waiting for confirmation</p>
              <p className="text-sm text-muted-foreground">
                Please confirm the transaction in your wallet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isConfirming) {
    return (
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <p className="font-medium">Processing transaction</p>
              <p className="text-sm text-muted-foreground">
                Your transaction is being confirmed on the blockchain.
              </p>
              {hash && (
                <a
                  href={getBlockscoutTxUrl(hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-sm mt-1"
                >
                  View on Blockscout
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-600">Success</p>
              <p className="text-sm text-muted-foreground">{successMessage}</p>
              {hash && (
                <a
                  href={getBlockscoutTxUrl(hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-sm mt-1"
                >
                  View transaction
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && parsedError) {
    // User rejection - less alarming style
    if (parsedError.isUserRejection) {
      return (
        <Card className="border-muted">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Transaction cancelled</p>
                <p className="text-sm text-muted-foreground">
                  You cancelled the transaction. No changes were made.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Capability error - suggest contacting admin
    if (parsedError.isCapabilityError) {
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Permission Denied</p>
                <p className="text-sm text-muted-foreground">{parsedError.message}</p>
                <p className="text-sm text-muted-foreground mt-1 opacity-80">
                  Contact an administrator to request the required permissions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Network error - suggest switching
    if (parsedError.isNetworkError) {
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Network Error</p>
                <p className="text-sm text-muted-foreground">{parsedError.message}</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Switch Network
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Generic error
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Transaction Failed</p>
              <p className="text-sm text-muted-foreground">{parsedError.message}</p>
              {parsedError.code && parsedError.code !== "UNKNOWN" && (
                <details className="text-xs mt-2">
                  <summary className="cursor-pointer opacity-70 hover:opacity-100">
                    Error code: {parsedError.code}
                  </summary>
                  <pre className="mt-1 p-2 bg-destructive/10 rounded text-xs overflow-auto max-h-20">
                    {error.message}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

/**
 * Hook for managing transaction state in a standardized way
 */
export function useTransactionToast() {
  // This could integrate with a toast library in the future
  // For now, components use TransactionStatus directly
  return {
    showPending: () => {},
    showConfirming: () => {},
    showSuccess: () => {},
    showError: () => {},
  };
}
