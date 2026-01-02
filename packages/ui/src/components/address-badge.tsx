"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";

export interface AddressBadgeProps {
  address: string;
  showCopy?: boolean;
  showEtherscan?: boolean;
  truncate?: boolean;
  className?: string;
}

function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function AddressBadge({
  address,
  showCopy = true,
  showEtherscan = true,
  truncate = true,
  className,
}: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const etherscanUrl = `https://optimism-sepolia.blockscout.com/address/${address}`;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <code className="px-2 py-1 rounded bg-muted text-sm font-mono">
        {truncate ? truncateAddress(address) : address}
      </code>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Copy address"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      {showEtherscan && (
        <a
          href={etherscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="View on Blockscout"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
