"use client";

import { Component, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@tagit/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Error boundary for catching and displaying contract-related errors.
 * Catches wagmi/viem errors and provides user-friendly messages.
 */
export class ContractErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: parseContractError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Contract Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Contract Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.state.errorInfo || "An error occurred while interacting with the blockchain."}
            </p>
            {this.state.error && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Technical Details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button onClick={this.handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Parse contract errors into user-friendly messages
 */
function parseContractError(error: Error): string {
  const message = error.message.toLowerCase();

  // Common wagmi/viem errors
  if (message.includes("user rejected") || message.includes("user denied")) {
    return "Transaction was rejected. Please try again and confirm in your wallet.";
  }

  if (message.includes("insufficient funds")) {
    return "Insufficient funds to complete this transaction. Please add more ETH to your wallet.";
  }

  if (message.includes("nonce")) {
    return "Transaction nonce error. Please refresh the page and try again.";
  }

  if (message.includes("gas")) {
    return "Gas estimation failed. The transaction may revert or you may not have permission.";
  }

  if (message.includes("execution reverted")) {
    // Try to extract revert reason
    const revertMatch = message.match(/reason: ([^,\]]+)/i);
    if (revertMatch) {
      return `Transaction reverted: ${revertMatch[1]}`;
    }
    return "Transaction would revert. Check your permissions and try again.";
  }

  if (message.includes("network") || message.includes("connection")) {
    return "Network connection error. Please check your internet connection and try again.";
  }

  if (message.includes("chain") || message.includes("wrong network")) {
    return "Wrong network. Please switch to OP Sepolia in your wallet.";
  }

  if (message.includes("not connected")) {
    return "Wallet not connected. Please connect your wallet and try again.";
  }

  // Capability/permission errors
  if (message.includes("capability") || message.includes("unauthorized")) {
    return "You don't have permission to perform this action. Contact an admin to request access.";
  }

  if (message.includes("badge")) {
    return "Badge verification failed. Ensure you have the required identity badge.";
  }

  // Default fallback
  return "An unexpected error occurred. Please try again or contact support.";
}

export default ContractErrorBoundary;
